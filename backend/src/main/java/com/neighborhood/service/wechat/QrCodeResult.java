package com.neighborhood.service.wechat;

import lombok.Builder;
import lombok.Data;

/** 小程序码生成结果。 */
@Data
@Builder
public class QrCodeResult {

    /** 图片二进制（仅用于即时响应；数据库只存 imageKey） */
    private byte[] image;

    /** 存储 Key / 相对路径，数据库中只保存该值 */
    private String imageKey;

    /** 本次使用的生成方式，前端据此提示是否真实小程序码 */
    private String mode;

    /** 小程序码指向的页面 */
    private String page;

    /** 携带的场景参数（= referral_code） */
    private String scene;

    /** 面向用户的说明文案，DEV 模式下必须包含明确的非真实提示 */
    private String notice;

    public boolean isReal() {
        return "REAL".equals(mode);
    }
}