package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/** 投诉处理状态。 */
public enum ComplaintStatus {

    PENDING("PENDING", "待处理"),
    PROCESSING("PROCESSING", "处理中"),
    CLOSED("CLOSED", "已关闭");

    @EnumValue
    private final String code;

    private final String label;

    ComplaintStatus(String code, String label) {
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