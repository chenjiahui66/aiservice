package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/**
 * 启用/停用状态，对应库中 TINYINT。
 *
 * <p>JSON 序列化沿用枚举名（ENABLED / DISABLED），前后端语义一致且自解释。</p>
 */
public enum EnabledStatus {

    DISABLED(0, "已停用"),
    ENABLED(1, "正常");

    @EnumValue
    private final int value;

    private final String label;

    EnabledStatus(int value, String label) {
        this.value = value;
        this.label = label;
    }

    public int getValue() {
        return value;
    }

    public String getLabel() {
        return label;
    }

    public boolean isEnabled() {
        return this == ENABLED;
    }

    public static EnabledStatus of(Integer value) {
        return value != null && value == 1 ? ENABLED : DISABLED;
    }
}