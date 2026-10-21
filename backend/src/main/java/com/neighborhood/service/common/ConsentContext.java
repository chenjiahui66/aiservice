package com.neighborhood.service.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 同意留证所需的客户端上下文。
 *
 * <p>IP 与 User-Agent 由服务端从请求里取，<b>不接受</b>客户端上报，
 * 否则留证就等于让用户自己填证据，没有意义。</p>
 *
 * @param clientIp  客户端 IP
 * @param userAgent 客户端标识
 */
public record ConsentContext(String clientIp, String userAgent) {

    /** 无客户端上下文（单元测试、非 Web 调用时使用）。 */
    public static ConsentContext empty() {
        return new ConsentContext(null, null);
    }

    public static ConsentContext of(String clientIp, String userAgent) {
        String ua = userAgent;
        if (ua != null && ua.length() > 500) {
            ua = ua.substring(0, 500);
        }
        return new ConsentContext(clientIp, ua);
    }

    /**
     * 从请求里取客户端信息。
     *
     * <p>IP 取 X-Forwarded-For 的第一个值：本项目在网关 nginx 之后，
     * 直接用 remoteAddr 只会拿到网关容器 IP，没有留证价值。</p>
     */
    public static ConsentContext from(HttpServletRequest request) {
        if (request == null) {
            return empty();
        }
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        } else {
            ip = ip.split(",")[0].trim();
        }
        return of(ip, request.getHeader("User-Agent"));
    }
}
