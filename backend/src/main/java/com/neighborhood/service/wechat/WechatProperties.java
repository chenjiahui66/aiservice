package com.neighborhood.service.wechat;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** 微信小程序能力配置，对应 application.yml 的 app.wechat.*。 */
@Data
@Component
@ConfigurationProperties(prefix = "app.wechat")
public class WechatProperties {

    /** 小程序 AppID */
    private String appId;

    /** 小程序 AppSecret —— 只存在于后端环境变量，绝不下发前端、不提交 Git */
    private String appSecret;

    /** AUTO = 配了 AppID/Secret 用真实接口，否则降级；REAL = 强制真实；DEV = 强制降级 */
    private String codeMode = "AUTO";

    /** 小程序码指向的页面路径，需在小程序后台配置为合法页面 */
    private String scenePage = "pages/provider/index";

    /** access_token 本地缓存时长，微信官方建议 6600 秒并预留提前刷新余量 */
    private long accessTokenTtlSeconds = 6600L;

    public boolean hasCredentials() {
        return appId != null && !appId.isBlank()
                && appSecret != null && !appSecret.isBlank();
    }

    public boolean isRealMode() {
        return hasCredentials() && !"DEV".equalsIgnoreCase(codeMode);
    }

    public boolean isDevMode() {
        return !isRealMode();
    }
}