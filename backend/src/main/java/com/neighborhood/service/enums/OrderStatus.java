package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;
import com.fasterxml.jackson.annotation.JsonValue;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * 订单状态机。
 *
 * <pre>
 *   待确认 PENDING_CONFIRM ──► 已预约 CONFIRMED ──► 服务中 SERVING ──► 已完成 COMPLETED
 *        │                        │                    │
 *        └────────────────────────┴────────────────────┴──────────► 已取消 CANCELLED
 * </pre>
 *
 * <p><b>所有状态变更必须走 {@link #assertCanTransitTo}，前端改状态字符串一律无效。</b></p>
 */
public enum OrderStatus {

    PENDING_CONFIRM("PENDING_CONFIRM", "待确认"),
    CONFIRMED("CONFIRMED", "已预约"),
    SERVING("SERVING", "服务中"),
    COMPLETED("COMPLETED", "已完成"),
    CANCELLED("CANCELLED", "已取消");

    @EnumValue
    @JsonValue
    private final String code;

    private final String label;

    OrderStatus(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /**
     * 允许的后继状态。
     *
     * <p>必须用方法而不是构造期字段：枚举构造器中引用其它枚举常量属于「初始化期间
     * 非法引用静态字段」，无法编译。</p>
     */
    public Set<OrderStatus> getAllowedNext() {
        return switch (this) {
            case PENDING_CONFIRM -> EnumSet.of(CONFIRMED, CANCELLED);
            case CONFIRMED -> EnumSet.of(SERVING, CANCELLED);
            case SERVING -> EnumSet.of(COMPLETED, CANCELLED);
            case COMPLETED, CANCELLED -> EnumSet.noneOf(OrderStatus.class);
        };
    }

    public boolean canTransitTo(OrderStatus target) {
        return target != null && getAllowedNext().contains(target);
    }

    /**
     * 校验状态流转是否合法，非法直接抛业务异常。
     *
     * @param from 当前状态
     * @param to   目标状态
     * @throws BizException 流转不合法
     */
    public static void assertCanTransitTo(OrderStatus from, OrderStatus to) {
        if (from == null || to == null) {
            throw BizException.of(ResultCode.ORDER_STATUS_TRANSITION_INVALID, "订单状态异常");
        }
        if (from == to) {
            throw BizException.of(ResultCode.ORDER_STATUS_ILLEGAL,
                    "订单已处于「" + from.getLabel() + "」状态，请勿重复操作");
        }
        if (!from.canTransitTo(to)) {
            throw BizException.of(ResultCode.ORDER_STATUS_TRANSITION_INVALID,
                    "订单当前为「" + from.getLabel() + "」，不能变更为「" + to.getLabel() + "」");
        }
    }

    public static OrderStatus fromCode(String code) {
        return Arrays.stream(values())
                .filter(s -> s.code.equals(code))
                .findFirst()
                .orElseThrow(() -> BizException.of(ResultCode.PARAM_ERROR, "未知的订单状态：" + code));
    }

    /** 是否为终态（不可再流转）。 */
    public boolean isFinal() {
        return this == COMPLETED || this == CANCELLED;
    }

    public static Map<String, String> labelMap() {
        return Arrays.stream(values()).collect(
                java.util.stream.Collectors.toMap(OrderStatus::getCode, OrderStatus::getLabel));
    }
}