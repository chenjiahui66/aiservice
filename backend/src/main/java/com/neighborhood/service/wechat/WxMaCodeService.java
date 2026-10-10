package com.neighborhood.service.wechat;

/**
 * 小程序码生成能力。
 *
 * <p><b>平台能力封装原则</b>：小程序码依赖微信官方接口，属于平台专属能力，
 * 不得假设能直接跨端运行。业务层只依赖本接口，不直接接触微信 SDK / HTTP。</p>
 */
public interface WxMaCodeService {

    /**
     * 为指定推广码生成小程序码。
     *
     * @param referralCode 推广码，将作为 scene 参数下发
     * @param width        像素宽度
     * @return 生成结果，失败时抛 {@code BizException}
     */
    QrCodeResult generate(String referralCode, int width);

    /** 当前生效的生成方式：REAL / DEV。 */
    String currentMode();
}