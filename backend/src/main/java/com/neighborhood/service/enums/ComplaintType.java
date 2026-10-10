package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/** 投诉/反馈/违规类型。 */
public enum ComplaintType {

    COMPLAINT("COMPLAINT", "客户投诉"),
    FEEDBACK("FEEDBACK", "用户反馈"),
    VIOLATION("VIOLATION", "违规举报");

    @EnumValue
    private final String code;

    private final String label;

    ComplaintType(String code, String label) {
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