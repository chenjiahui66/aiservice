package com.neighborhood.service.security;

import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;

/**
 * 数据归属校验工具。
 *
 * <p>需求第八条要求：禁止通过修改订单 ID / 客户 ID 越权读取其他服务者的数据。
 * 所有按 id 读取的详情、修改、删除操作都必须过一遍
 * {@link #assertOwned}，而不是把 providerId 当查询条件用完就算完。</p>
 */
public final class DataScope {

    private DataScope() {
    }

    /** 当前登录服务者的 providerId（只来自 token）。 */
    public static Long currentProviderId() {
        return SecurityUtils.requireProviderId();
    }

    /**
     * 断言目标资源归属于当前服务者。
     *
     * <p>刻意不区分「资源不存在」与「不属于你」，统一抛
     * {@link BizException#accessDenied()}，避免攻击者用错误码探测他人资源是否存在。</p>
     *
     * @throws BizException 归属不匹配或资源为空
     */
    public static void assertOwned(Long ownerProviderId, Object resource) {
        if (resource == null || ownerProviderId == null || !ownerProviderId.equals(currentProviderId())) {
            throw BizException.accessDenied();
        }
    }

    /**
     * 按 id 查出资源后校验归属。
     *
     * @param loaded 由 id 查出的资源（可能为 null）
     */
    public static void assertOwnedByQuery(Long ownerProviderId) {
        if (ownerProviderId == null || !ownerProviderId.equals(currentProviderId())) {
            throw BizException.accessDenied();
        }
    }

    /** 平台管理员专用：不经过服务者隔离校验。 */
    public static Long currentAdminId() {
        return SecurityUtils.requireAdminId();
    }

    /** 确保当前操作者是服务者（管理员访问服务者业务数据一律拒绝）。 */
    public static void requireProviderRole() {
        AuthPrincipal principal = SecurityUtils.getPrincipal();
        if (principal == null) {
            throw BizException.of(ResultCode.UNAUTHORIZED);
        }
        if (!principal.isProvider()) {
            throw BizException.accessDenied();
        }
    }
}