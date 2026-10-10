package com.neighborhood.service.security;

import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.config.MybatisPlusConfig;

/**
 * 当前登录主体工具类。
 *
 * <p>服务层获取 providerId 的**唯一**入口。任何业务代码都不允许从请求参数里取 providerId。</p>
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static AuthPrincipal getPrincipal() {
        return MybatisPlusConfig.currentPrincipal();
    }

    /**
     * 获取当前服务者的 providerId，未登录直接抛 401。
     *
     * <p>所有服务者端业务查询必须以本方法返回值作为 {@code provider_id} 过滤条件。</p>
     */
    public static Long requireProviderId() {
        AuthPrincipal principal = getPrincipal();
        if (principal == null) {
            throw BizException.of(ResultCode.UNAUTHORIZED);
        }
        if (!principal.isProvider() || principal.getProviderId() == null) {
            throw BizException.accessDenied();
        }
        return principal.getProviderId();
    }

    /** 获取当前管理员 id，未登录直接抛 401。 */
    public static Long requireAdminId() {
        AuthPrincipal principal = getPrincipal();
        if (principal == null) {
            throw BizException.of(ResultCode.UNAUTHORIZED);
        }
        if (!principal.isAdmin()) {
            throw BizException.accessDenied();
        }
        return principal.getUserId();
    }

    /** 当前操作者名称，用于日志留痕；未登录返回「系统」。 */
    public static String currentOperatorName() {
        AuthPrincipal principal = getPrincipal();
        if (principal == null) {
            return "系统";
        }
        return principal.getDisplayName() != null && !principal.getDisplayName().isBlank()
                ? principal.getDisplayName()
                : principal.getUsername();
    }
}