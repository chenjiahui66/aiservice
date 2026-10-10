package com.neighborhood.service.enums;

/**
 * 小程序码生成方式。
 *
 * <p><b>合规红线</b>：{@link #DEV} 只是开发期占位实现，接口与前端都必须明确标注
 * 「非真实小程序码」，绝不允许把普通二维码当作小程序码对外发布。</p>
 */
public enum QrMode {

    /** 微信官方 wxa/getwxacode 接口生成的真实小程序码 */
    REAL("真实小程序码"),
    /** 开发期降级：本地生成的占位二维码，带明确水印，不可对外发布 */
    DEV("开发降级二维码（非真实小程序码）");

    private final String label;

    QrMode(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public boolean isReal() {
        return this == REAL;
    }
}