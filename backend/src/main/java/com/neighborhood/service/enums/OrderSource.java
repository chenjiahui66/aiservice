package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/** 订单来源。首版不接入支付，因此不存在「已支付」这类来源。 */
public enum OrderSource {

    /** 客户扫描推广码在小程序端提交 */
    QR_CODE("QR_CODE", "扫码预约"),
    /** 服务者手动记单（电话/微信/线下沟通） */
    MANUAL("MANUAL", "手动创建");

    @EnumValue
    private final String code;

    private final String label;

    OrderSource(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }
}