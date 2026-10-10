package com.neighborhood.service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * 邻里服务管家 —— 后端启动类
 *
 * <p>核心职责边界：平台只提供工具，不代服务者履约、不抽佣、不接入支付。</p>
 *
 * <p>排除 {@link UserDetailsServiceAutoConfiguration}：本项目完全使用 JWT + 自建
 * {@code users} / {@code admin_users} 表，不使用 Spring Security 的内存默认账号。
 * 不排除的话启动时会凭空生成一个随机密码用户并打印警告，既没用又吓人。</p>
 */
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableTransactionManagement
public class NeighborhoodApplication {

    public static void main(String[] args) {
        SpringApplication.run(NeighborhoodApplication.class, args);
    }
}