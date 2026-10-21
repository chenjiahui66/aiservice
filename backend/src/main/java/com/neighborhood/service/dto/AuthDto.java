package com.neighborhood.service.dto;

import jakarta.validation.constraints.AssertTrue;
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

        /**
         * 是否已阅读并同意《用户服务协议》和《隐私政策》。
         *
         * <p>用 {@code @AssertTrue} 而不是 {@code @NotNull}：不传（null）同样判定为未同意，
         * 必须显式勾选才能注册。手机号属于个人信息，微信审核要求明示同意后才可收集。</p>
         */
        @AssertTrue(message = "请先阅读并同意《用户服务协议》和《隐私政策》")
        private Boolean consentAgreed;

        /** 同意的协议版本号，由前端带上，便于留证追溯 */
        @Size(max = 16, message = "协议版本号过长")
        private String policyVersion;
    }

    @Data
    public static class LoginRequest {
        @NotBlank(message = "账号不能为空")
        private String username;

        @NotBlank(message = "密码不能为空")
        private String password;
    }

    /**
     * 服务者登录请求。
     *
     * <p>与管理员登录分开：管理员端不收集用户个人信息，不需要协议同意；
     * 服务者端登录同样要明示同意（登录即使用手机号识别账号）。</p>
     */
    @Data
    public static class ProviderLoginRequest {
        @NotBlank(message = "账号不能为空")
        private String username;

        @NotBlank(message = "密码不能为空")
        private String password;

        @AssertTrue(message = "请先阅读并同意《用户服务协议》和《隐私政策》")
        private Boolean consentAgreed;

        @Size(max = 16, message = "协议版本号过长")
        private String policyVersion;
    }

    /** 单独提交一次协议同意（登录后补充同意、协议更新后重新同意）。 */
    @Data
    public static class ConsentRequest {
        @NotBlank(message = "请指定同意对象")
        private String subjectType;

        @Size(max = 16, message = "协议版本号过长")
        private String policyVersion;

        @AssertTrue(message = "必须明确同意后才能提交")
        private Boolean agreed;
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