package com.neighborhood.service.security;

import lombok.Getter;

/**
 * 登录主体。服务者与管理员共用同一个载体，靠 {@link #role} 与
 * {@link #providerId} 做权限区分。
 *
 * <p><b>关键点</b>：{@code providerId} 来自服务端签发的 token，
 * 而不是前端请求参数——所有业务查询都用它做数据隔离过滤。</p>
 */
@Getter
public class AuthPrincipal {

    public enum Role {
        /** 服务者（小程序端） */
        PROVIDER,
        /** 平台管理员（Web 后台端） */
        ADMIN,
        /** 匿名访客（客户扫码进入公开主页） */
        CUSTOMER
    }

    private final Long userId;
    private final Long providerId;
    private final String username;
    private final String displayName;
    private final Role role;

    public AuthPrincipal(Long userId, Long providerId, String username, String displayName, Role role) {
        this.userId = userId;
        this.providerId = providerId;
        this.username = username;
        this.displayName = displayName;
        this.role = role;
    }

    public boolean isProvider() {
        return role == Role.PROVIDER;
    }

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}