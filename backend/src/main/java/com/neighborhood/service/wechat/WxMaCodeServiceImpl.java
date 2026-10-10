package com.neighborhood.service.wechat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.enums.QrMode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 真实小程序码实现，调用微信官方接口。
 *
 * <p>接口：{@code POST https://api.weixin.qq.com/wxa/getwxacodeunlimit}</p>
 *
 * <p>已处理的工程细节：
 * <ul>
 *   <li>access_token 本地缓存 + 提前 5 分钟刷新，避免临界过期；用锁做单飞，防止并发击穿。</li>
 *   <li>返回体可能是图片也可能是 JSON 错误，必须先判类型再解析——直接把错误 JSON 当图片存盘
 *       是这类接口最常见的坑。</li>
 *   <li>40001 / 42001（凭证失效）自动清缓存重试一次。</li>
 *   <li>AppSecret 只从服务端配置读取，绝不下发前端、不落日志。</li>
 * </ul>
 */
@Slf4j
@Service
public class WxMaCodeServiceImpl implements WxMaCodeService {

    private static final String TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
    private static final String CODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit";
    private static final Duration TOKEN_REFRESH_MARGIN = Duration.ofMinutes(5);

    private final WechatProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final QrStorage qrStorage;
    private final DevQrRenderer devQrRenderer;

    private final ReentrantLock tokenLock = new ReentrantLock();
    private volatile String cachedToken;
    private volatile Instant tokenExpireAt = Instant.EPOCH;

    public WxMaCodeServiceImpl(WechatProperties properties,
                               ObjectMapper objectMapper,
                               QrStorage qrStorage,
                               DevQrRenderer devQrRenderer) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.qrStorage = qrStorage;
        this.devQrRenderer = devQrRenderer;
        this.restClient = RestClient.create();
    }

    @Override
    public String currentMode() {
        return properties.isRealMode() ? QrMode.REAL.name() : QrMode.DEV.name();
    }

    @Override
    public QrCodeResult generate(String referralCode, int width) {
        if (!StringUtils.hasText(referralCode)) {
            throw BizException.of(ResultCode.PARAM_ERROR, "推广码不能为空");
        }
        // 未配置微信能力时降级为开发占位码，并在返回值中明确标注
        if (properties.isDevMode()) {
            log.info("微信能力未配置，返回开发降级二维码（scene={}）", referralCode);
            return devQrRenderer.render(referralCode, width);
        }
        // 微信 scene 长度上限 32
        if (referralCode.length() > 32) {
            throw BizException.of(ResultCode.PARAM_ERROR, "推广码长度超出小程序码场景参数限制");
        }

        byte[] image = requestCodeWithRetry(referralCode, width);

        String key = referralCode + "_" + width + ".png";
        qrStorage.save(key, image);

        return QrCodeResult.builder()
                .image(image)
                .imageKey(key)
                .mode(QrMode.REAL.name())
                .page(properties.getScenePage())
                .scene(referralCode)
                .notice(QrMode.REAL.getLabel())
                .build();
    }

    private byte[] requestCodeWithRetry(String referralCode, int width) {
        try {
            return requestCode(referralCode, width);
        } catch (WechatApiException e) {
            if (e.isCredentialInvalid()) {
                log.warn("微信 access_token 失效，清缓存后重试一次: errcode={}", e.getErrcode());
                invalidateToken();
                return requestCode(referralCode, width);
            }
            throw BizException.of(ResultCode.WECHAT_CODE_FAILED,
                    "小程序码生成失败：" + e.getMessage());
        }
    }

    private byte[] requestCode(String referralCode, int width) {
        String token = getAccessToken();
        String body = """
                {"scene":"%s","page":"%s","check_path":false,"width":%d}
                """.formatted(referralCode, properties.getScenePage(), Math.max(280, Math.min(1280, width)));

        byte[] raw;
        try {
            raw = restClient.post()
                    .uri(CODE_URL + "?access_token={token}", token)
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientException e) {
            log.error("调用微信小程序码接口异常", e);
            throw BizException.of(ResultCode.WECHAT_CODE_FAILED, "微信接口调用失败，请稍后重试");
        }

        if (raw == null || raw.length == 0) {
            throw BizException.of(ResultCode.WECHAT_CODE_FAILED, "微信接口返回空内容");
        }

        // 关键：微信失败时返回 JSON 而不是图片，必须先按内容判定
        if (looksLikeJson(raw)) {
            throw parseApiError(raw);
        }
        return raw;
    }

    private boolean looksLikeJson(byte[] raw) {
        for (byte b : raw) {
            if (b == ' ' || b == '\n' || b == '\r' || b == '\t') {
                continue;
            }
            return b == '{';
        }
        return false;
    }

    private WechatApiException parseApiError(byte[] raw) {
        try {
            JsonNode node = objectMapper.readTree(raw);
            int errcode = node.path("errcode").asInt(0);
            String errmsg = node.path("errmsg").asText("未知错误");
            log.warn("微信小程序码接口返回错误: errcode={} errmsg={}", errcode, errmsg);
            return new WechatApiException(errcode, errmsg);
        } catch (Exception e) {
            return new WechatApiException(-1, "无法解析微信错误响应");
        }
    }

    // ---------------- access_token ----------------

    private String getAccessToken() {
        String token = cachedToken;
        if (token != null && Instant.now().isBefore(tokenExpireAt)) {
            return token;
        }
        tokenLock.lock();
        try {
            // 双检
            if (cachedToken != null && Instant.now().isBefore(tokenExpireAt)) {
                return cachedToken;
            }
            return fetchAccessToken();
        } finally {
            tokenLock.unlock();
        }
    }

    private String fetchAccessToken() {
        String url = TOKEN_URL + "?grant_type=client_credential&appid={appid}&secret={secret}";
        try {
            String resp = restClient.get()
                    .uri(url, properties.getAppId(), properties.getAppSecret())
                    .retrieve()
                    .body(String.class);
            JsonNode node = objectMapper.readTree(resp);
            if (node.has("access_token")) {
                String token = node.get("access_token").asText();
                long expiresIn = node.path("expires_in").asLong(7200L);
                this.cachedToken = token;
                this.tokenExpireAt = Instant.now().plusSeconds(expiresIn).minus(TOKEN_REFRESH_MARGIN);
                log.info("已刷新微信 access_token，有效期 {}s", expiresIn);
                return token;
            }
            log.error("获取微信 access_token 失败: errcode={} errmsg={}",
                    node.path("errcode").asText("-"), node.path("errmsg").asText("未知"));
            throw BizException.of(ResultCode.WECHAT_ACCESS_TOKEN_FAILED, "获取微信 access_token 失败，请检查 AppID/AppSecret");
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("获取微信 access_token 异常", e);
            throw BizException.of(ResultCode.WECHAT_ACCESS_TOKEN_FAILED, "获取微信 access_token 异常，请稍后重试");
        }
    }

    private void invalidateToken() {
        tokenLock.lock();
        try {
            this.cachedToken = null;
            this.tokenExpireAt = Instant.EPOCH;
        } finally {
            tokenLock.unlock();
        }
    }

    /** 微信接口错误。40001/42001 表示凭证失效，可刷新后重试。 */
    static class WechatApiException extends RuntimeException {
        private final int errcode;

        WechatApiException(int errcode, String message) {
            super(message);
            this.errcode = errcode;
        }

        int getErrcode() {
            return errcode;
        }

        boolean isCredentialInvalid() {
            return errcode == 40001 || errcode == 42001;
        }
    }
}