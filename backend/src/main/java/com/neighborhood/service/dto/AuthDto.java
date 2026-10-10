package com.neighborhood.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** 认证相关 DTO：服务者注册/登录、管理员登录。 */
public final class AuthDto {

    private AuthDto() {
    }

    @Data
    public static class RegisterRequest {
        /** 登录名，本期统一用手机号 */
        @NotBlank(message = "手机号不能为空")
        @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
        private String phone;

        @NotBlank(message = "密码不能为空")
        @Size(min = 6, max = 20, message = "密码长度需为 6~20 位")
        private String password;

        @NotBlank(message = "称呼不能为空")
        @Size(max = 20, message = "称呼长度不能超过 20 个字")
        private String realName;

        @Size(max = 100, message = "服务区域长度不能超过 100 个字")
        private String serviceArea;
    }

    @Data
    public static class LoginRequest {
        @NotBlank(message = "账号不能为空")
        private String username;

        @NotBlank(message = "密码不能为空")
        private String password;
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class LoginResponse {
        private String token;
        private String tokenType = "Bearer";
        /** 服务者端返回 providerId；管理员端为 null */
        private Long providerId;
        private String displayName;
        private String username;
        /** 审核状态，服务者端登录后前端据此跳转 */
        private String auditStatus;
        private String auditRemark;
        private Long expiresInSeconds;
    }
}