package com.neighborhood.service.config;

import com.neighborhood.service.security.JwtAuthenticationFilter;
import com.neighborhood.service.security.RestAuthHandlers;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * 安全配置。
 *
 * <p>路由分区（最重要的三条线）：
 * <ul>
 *   <li>{@code /api/public/**}  —— 客户扫码入口，匿名可访问</li>
 *   <li>{@code /api/provider/**} —— 服务者端，仅 ROLE_PROVIDER</li>
 *   <li>{@code /api/admin/**}   —— 平台后台，仅 ROLE_ADMIN</li>
 * </ul>
 * 三者互不重叠，且由不同密钥签发的 token 决定放行结果。
 * </p>
 */
@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthHandlers restAuthHandlers;
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(restAuthHandlers)
                        .accessDeniedHandler(restAuthHandlers))
                .authorizeHttpRequests(auth -> auth
                        // ---- 接口文档 ----
                        .requestMatchers("/doc.html", "/v3/api-docs/**", "/swagger-ui/**",
                                "/swagger-resources/**", "/webjars/**").permitAll()
                        // ---- 登录与注册 ----
                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/provider/register",
                                "/api/auth/provider/login",
                                "/api/auth/admin/login").permitAll()
                        // ---- 客户扫码入口（匿名） ----
                        .requestMatchers("/api/public/**").permitAll()
                        // ---- 分区授权 ----
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/provider/**").hasRole("PROVIDER")
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS：后台管理端（Vite dev server）与小程序 H5 调试需要。
     * 生产环境前端与后端同域部署时不会触发。
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}