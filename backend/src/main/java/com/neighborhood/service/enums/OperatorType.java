package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/** 操作者类型。用于区分服务者端操作与管理员端操作，管理员操作会被独立留痕。 */
public enum OperatorType {

    PROVIDER("PROVIDER", "服务者"),
    CUSTOMER("CUSTOMER", "客户"),
    ADMIN("ADMIN", "平台管理员");

    @EnumValue
    private final String code;

    private final String label;

    OperatorType(String code, String label) {
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