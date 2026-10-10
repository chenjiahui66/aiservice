package com.neighborhood.service.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * JWT 签发与解析。
 *
 * <p><b>双密钥设计</b>：服务者端与管理员端使用不同密钥、不同 issuer。
 * 即便攻击者拿到服务者 token，也无法用它访问管理员接口——
 * 管理员端接口校验 issuer/密钥时必然失败。这是「平台管理员权限与普通服务者严格区分」
 * 的第一道物理防线，第二道是服务层的 providerId 归属校验。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    private static final String CLAIM_PROVIDER_ID = "pid";
    private static final String CLAIM_USERNAME = "un";
    private static final String CLAIM_DISPLAY_NAME = "dn";
    private static final String CLAIM_ROLE = "role";

    private final JwtProperties jwtProperties;

    /** 为服务者签发 token。 */
    public String generateProviderToken(Long userId, Long providerId, String username, String displayName) {
        return generate(userId, providerId, username, displayName,
                AuthPrincipal.Role.PROVIDER.name(),
                jwtProperties.getProviderSecret(),
                jwtProperties.getProviderIssuer(),
                jwtProperties.getProviderExpireMinutes());
    }

    /** 为管理员签发 token。管理员没有 providerId。 */
    public String generateAdminToken(Long adminId, String username, String realName) {
        return generate(adminId, null, username, realName,
                AuthPrincipal.Role.ADMIN.name(),
                jwtProperties.getAdminSecret(),
                jwtProperties.getAdminIssuer(),
                jwtProperties.getAdminExpireMinutes());
    }

    private String generate(Long subjectId, Long providerId, String username, String displayName,
                            String role, String secret, String issuer, long expireMinutes) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(String.valueOf(subjectId))
                .claim(CLAIM_PROVIDER_ID, providerId)
                .claim(CLAIM_USERNAME, username)
                .claim(CLAIM_DISPLAY_NAME, displayName)
                .claim(CLAIM_ROLE, role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expireMinutes, ChronoUnit.MINUTES)))
                .signWith(secretKey(secret))
                .compact();
    }

    /**
     * 解析并验证 token。先按服务者密钥验签，失败再按管理员密钥验签。
     *
     * @return 登录主体
     * @throws JwtException token 非法或过期
     */
    public AuthPrincipal parse(String token) {
        JwtException providerError;
        try {
            return parseWith(token, jwtProperties.getProviderSecret(), jwtProperties.getProviderIssuer());
        } catch (ExpiredJwtException e) {
            throw e;
        } catch (JwtException | IllegalArgumentException e) {
            providerError = e instanceof JwtException j ? j : new JwtException("token 非法");
        }

        try {
            return parseWith(token, jwtProperties.getAdminSecret(), jwtProperties.getAdminIssuer());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("token 校验失败: {}", providerError.getMessage());
            throw providerError;
        }
    }

    private AuthPrincipal parseWith(String token, String secret, String expectedIssuer) {
        Claims claims = Jwts.parser()
                .verifyWith(secretKey(secret))
                .requireIssuer(expectedIssuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        Long userId = Long.valueOf(claims.getSubject());
        Long providerId = claims.get(CLAIM_PROVIDER_ID, Number.class) == null
                ? null
                : claims.get(CLAIM_PROVIDER_ID, Number.class).longValue();
        String username = claims.get(CLAIM_USERNAME, String.class);
        String displayName = claims.get(CLAIM_DISPLAY_NAME, String.class);
        String role = claims.get(CLAIM_ROLE, String.class);

        AuthPrincipal.Role r = AuthPrincipal.Role.valueOf(role);
        // 服务者 token 必须带 providerId，否则无法做数据隔离，直接视为非法
        if (r == AuthPrincipal.Role.PROVIDER && providerId == null) {
            throw new JwtException("服务者凭证缺少归属信息");
        }
        return new AuthPrincipal(userId, providerId, username, displayName, r);
    }

    private SecretKey secretKey(String secret) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT 密钥未配置或长度不足 32 字节，拒绝启动");
        }
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** 从 Authorization 头中剥离 Bearer 前缀。 */
    public String resolveToken(String header) {
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        String token = header.substring(7).trim();
        return token.isEmpty() ? null : token;
    }
}