package com.neighborhood.service.enums;

import com.neighborhood.service.common.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 订单状态机单元测试。
 *
 * <p>需求要求「所有涉及状态变化的接口必须校验当前状态和允许的状态转换」，
 * 所以这层规则必须有独立于 HTTP 的单元测试兜底。</p>
 */
class OrderStatusTest {

    @Test
    @DisplayName("正常流转链路应被允许")
    void normalTransitions() {
        assertDoesNotThrow(() -> OrderStatus.assertCanTransitTo(
                OrderStatus.PENDING_CONFIRM, OrderStatus.CONFIRMED));
        assertDoesNotThrow(() -> OrderStatus.assertCanTransitTo(
                OrderStatus.CONFIRMED, OrderStatus.SERVING));
        assertDoesNotThrow(() -> OrderStatus.assertCanTransitTo(
                OrderStatus.SERVING, OrderStatus.COMPLETED));
    }

    @Test
    @DisplayName("任意未完成状态都可以取消")
    void cancelAllowedFromUnfinished() {
        assertTrue(OrderStatus.PENDING_CONFIRM.canTransitTo(OrderStatus.CANCELLED));
        assertTrue(OrderStatus.CONFIRMED.canTransitTo(OrderStatus.CANCELLED));
        assertTrue(OrderStatus.SERVING.canTransitTo(OrderStatus.CANCELLED));
    }

    @Test
    @DisplayName("跳过中间状态应被拒绝")
    void skippingStatesRejected() {
        assertThrows(BizException.class, () -> OrderStatus.assertCanTransitTo(
                OrderStatus.PENDING_CONFIRM, OrderStatus.COMPLETED));
        assertThrows(BizException.class, () -> OrderStatus.assertCanTransitTo(
                OrderStatus.PENDING_CONFIRM, OrderStatus.SERVING));
        assertThrows(BizException.class, () -> OrderStatus.assertCanTransitTo(
                OrderStatus.CONFIRMED, OrderStatus.COMPLETED));
    }

    @Test
    @DisplayName("不能回退到更早的状态")
    void noBackwardTransitions() {
        assertThrows(BizException.class, () -> OrderStatus.assertCanTransitTo(
                OrderStatus.SERVING, OrderStatus.CONFIRMED));
        assertThrows(BizException.class, () -> OrderStatus.assertCanTransitTo(
                OrderStatus.COMPLETED, OrderStatus.SERVING));
    }

    @Test
    @DisplayName("终态不可再变更")
    void terminalStatesAreFinal() {
        assertTrue(OrderStatus.COMPLETED.isFinal());
        assertTrue(OrderStatus.CANCELLED.isFinal());
        assertTrue(OrderStatus.COMPLETED.getAllowedNext().isEmpty());
        assertTrue(OrderStatus.CANCELLED.getAllowedNext().isEmpty());

        for (OrderStatus target : OrderStatus.values()) {
            assertFalse(OrderStatus.COMPLETED.canTransitTo(target));
            assertFalse(OrderStatus.CANCELLED.canTransitTo(target));
        }
    }

    @Test
    @DisplayName("重复提交同一状态应被拒绝")
    void sameStatusRejected() {
        BizException e = assertThrows(BizException.class, () ->
                OrderStatus.assertCanTransitTo(OrderStatus.CONFIRMED, OrderStatus.CONFIRMED));
        assertEquals(42002, e.getCode());
    }

    @Test
    @DisplayName("流转异常的错误码为 42003")
    void illegalTransitionCode() {
        BizException e = assertThrows(BizException.class, () ->
                OrderStatus.assertCanTransitTo(OrderStatus.PENDING_CONFIRM, OrderStatus.COMPLETED));
        assertEquals(42003, e.getCode());
    }

    @Test
    @DisplayName("null 状态应被拒绝而不是 NPE")
    void nullRejected() {
        assertThrows(BizException.class, () -> OrderStatus.assertCanTransitTo(null, OrderStatus.CONFIRMED));
        assertThrows(BizException.class, () ->
                OrderStatus.assertCanTransitTo(OrderStatus.CONFIRMED, null));
    }

    @Test
    @DisplayName("按 code 解析，未知 code 报参数错误")
    void fromCode() {
        assertEquals(OrderStatus.COMPLETED, OrderStatus.fromCode("COMPLETED"));
        BizException e = assertThrows(BizException.class, () -> OrderStatus.fromCode("NOT_A_STATUS"));
        assertEquals(40000, e.getCode());
    }
}