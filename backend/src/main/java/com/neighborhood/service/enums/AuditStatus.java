package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/**
 * 服务者审核状态。
 *
 * <p>只有 {@link #APPROVED} 且 {@code enabled=ENABLED} 的服务者，
 * 其公开主页才可被访问、才可接收新预约。</p>
 */
public enum AuditStatus {

    PENDING(0, "待审核"),
    APPROVED(1, "已通过"),
    REJECTED(2, "已驳回"),
    SUSPENDED(3, "已暂停");

    @EnumValue
    private final int value;

    private final String label;

    AuditStatus(int value, String label) {
        this.value = value;
        this.label = label;
    }

    public int getValue() {
        return value;
    }

    public String getLabel() {
        return label;
    }

    /** 是否已通过审核（不代表账号未被停用）。 */
    public boolean isApproved() {
        return this == APPROVED;
    }
}