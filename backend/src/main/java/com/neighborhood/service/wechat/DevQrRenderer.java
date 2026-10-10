package com.neighborhood.service.wechat;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.enums.QrMode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.EnumMap;
import java.util.Map;

/**
 * <b>开发降级二维码渲染器 —— 不是小程序码。</b>
 *
 * <p>用途：在尚未配置微信 AppID/AppSecret 时，让服务者端能完整跑通
 * 「生成码 → 页面展示 → 扫码进主页」的开发联调链路。</p>
 *
 * <p><b>合规约束</b>：
 * <ul>
 *   <li>图片底部强制叠加醒目水印「开发占位码·非小程序码」，防止被误当成真实小程序码对外使用；</li>
 *   <li>接口返回的 {@code mode} 恒为 {@code DEV}，前端必须据此展示提示；</li>
 *   <li>正式发布前必须配置 AppID/AppSecret 并将 code-mode 切到 REAL。</li>
 * </ul>
 * </p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DevQrRenderer {

    private static final String WATERMARK = "开发占位码 · 非小程序码";

    private final QrStorage qrStorage;

    @Value("${app.storage.public-base-url:}")
    private String publicBaseUrl;

    public QrCodeResult render(String referralCode, int width) {
        int size = Math.max(280, Math.min(1280, width));
        String content = buildContent(referralCode);

        try {
            byte[] raw = encode(content, size);
            byte[] watermarked = applyWatermark(raw);

            String key = referralCode + "_" + size + "_dev.png";
            qrStorage.save(key, watermarked);

            return QrCodeResult.builder()
                    .image(watermarked)
                    .imageKey(key)
                    .mode(QrMode.DEV.name())
                    .page(null)
                    .scene(referralCode)
                    .notice("当前为开发降级模式，生成的不是真实微信小程序码，请勿对外使用。"
                            + "配置 WX_APP_ID / WX_APP_SECRET 后将自动切换为真实小程序码。")
                    .build();
        } catch (WriterException | java.io.IOException e) {
            log.error("开发降级二维码生成失败", e);
            throw BizException.of(ResultCode.SYSTEM_ERROR, "二维码生成失败");
        }
    }

    private String buildContent(String referralCode) {
        String base = (publicBaseUrl == null || publicBaseUrl.isBlank())
                ? "http://localhost:8080"
                : publicBaseUrl.replaceAll("/+$", "");
        return base + "/public/provider/" + referralCode;
    }

    private byte[] encode(String content, int size) throws WriterException, java.io.IOException {
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());
        hints.put(EncodeHintType.MARGIN, 1);
        hints.put(EncodeHintType.ERROR_CORRECTION, com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M);

        BitMatrix matrix = new QRCodeWriter()
                .encode(content, BarcodeFormat.QR_CODE, size, size, hints);

        BufferedImage image = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "PNG", out);
        return out.toByteArray();
    }

    /** 在二维码下方叠加醒目水印，确保任何情况下都不会被误认为真实小程序码。 */
    private byte[] applyWatermark(byte[] pngBytes) throws java.io.IOException {
        BufferedImage src = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(pngBytes));
        int w = src.getWidth();
        int h = src.getHeight();
        int barHeight = Math.max(28, h / 12);

        BufferedImage out = new BufferedImage(w, h + barHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, w, h + barHeight);
        g.drawImage(src, 0, 0, null);

        g.setColor(new Color(0xD9, 0x30, 0x30));
        g.fillRect(0, h, w, barHeight);
        g.setColor(Color.WHITE);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, Math.max(12, barHeight / 2)));
        int textWidth = g.getFontMetrics().stringWidth(WATERMARK);
        g.drawString(WATERMARK, Math.max(0, (w - textWidth) / 2), h + barHeight - barHeight / 4);
        g.dispose();

        ByteArrayOutputStream out2 = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(out, "PNG", out2);
        return out2.toByteArray();
    }
}