package com.neighborhood.service.common;

import lombok.Getter;

/**
 * 业务异常。所有可预期的业务失败都应抛出该异常，由全局异常处理器统一转成 {@link Result}。
 *
 * <p>严禁用 {@code RuntimeException} 裸抛业务失败——那样会退化成 50000，前端无法区分处理。</p>
 */
@Getter
public class BizException extends RuntimeException {

    private final int code;

    public BizException(ResultCode resultCode) {
        super(resultCode.getMessage());
        this.code = resultCode.getCode();
    }

    public BizException(ResultCode resultCode, String customMessage) {
        super(customMessage);
        this.code = resultCode.getCode();
    }

    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }

    // ---------- 便捷工厂 ----------
    public static BizException of(ResultCode resultCode) {
        return new BizException(resultCode);
    }

    public static BizException of(ResultCode resultCode, String customMessage) {
        return new BizException(resultCode, customMessage);
    }

    // ---------- 数据越权专用 ----------
    /**
     * 资源不属于当前登录主体时统一抛此异常。
     * 刻意不区分「不存在」与「无权限」，避免通过错误码探测他人资源是否存在。
     */
    public static BizException accessDenied() {
        return new BizException(ResultCode.FORBIDDEN, "无权访问该数据");
    }
}