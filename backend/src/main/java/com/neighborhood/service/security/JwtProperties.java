package com.neighborhood.service.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** JWT 配置，对应 application.yml 的 app.jwt.*。 */
@Data
@Component
@ConfigurationProperties(prefix = "app.jwt")
public class JwtProperties {

    /** 服务者端签名密钥 */
    private String providerSecret;
    private String providerIssuer = "neighborhood-provider";
    private long providerExpireMinutes = 10080L;

    /** 管理员端签名密钥 */
    private String adminSecret;
    private String adminIssuer = "neighborhood-admin";
    private long adminExpireMinutes = 480L;

    public boolean providerSecretConfigured() {
        return providerSecret != null && providerSecret.length() >= 32;
    }

    public boolean adminSecretConfigured() {
        return adminSecret != null && adminSecret.length() >= 32;
    }
}