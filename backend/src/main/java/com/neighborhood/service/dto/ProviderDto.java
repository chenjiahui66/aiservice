package com.neighborhood.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;

/** 服务者端自身资料/主页/推广相关 DTO。 */
public final class ProviderDto {

    private ProviderDto() {
    }

    /** 我的服务者档案（含审核状态）。 */
    @Data
    public static class ProfileVO {
        private Long providerId;
        private Long userId;
        private String realName;
        private String serviceArea;
        private String auditStatus;
        private String auditStatusLabel;
        private String auditRemark;
        private LocalDateTime auditedAt;
        private String enabled;
        private String nickname;
        private String avatarUrl;
        private String phone;
    }

    @Data
    public static class ProfileUpdateRequest {
        @Size(max = 20, message = "称呼长度不能超过 20 个字")
        private String realName;

        @Size(max = 100, message = "服务区域过长")
        private String serviceArea;

        @Size(max = 20, message = "昵称过长")
        private String nickname;

        @Size(max = 500)
        private String avatarUrl;
    }

    /** 个人服务主页配置。 */
    @Data
    public static class ServicePageVO {
        private Long providerId;
        @NotBlank(message = "主页显示名称不能为空")
        @Size(max = 50, message = "主页显示名称过长")
        private String displayName;
        @Size(max = 500)
        private String avatarUrl;
        private String intro;
        @Size(max = 100, message = "服务区域过长")
        private String serviceArea;
        @Size(max = 200)
        private String availableTime;
        @Size(max = 500)
        private String priceDesc;
        private String serviceRules;
        /** 是否对外展示联系方式 */
        private Boolean contactVisible;
        @Pattern(regexp = "^$|^1[3-9]\\d{9}$|^[0-9]{7,8}$", message = "联系电话格式不正确")
        private String contactPhone;
        /** 主页启用状态；停用后推广码不可再被客户访问 */
        private Boolean enabled;
    }

    /** 推广中心信息。统计字段全部来自真实业务数据。 */
    @Data
    public static class ReferralInfoVO {
        private Long referralCodeId;
        private String referralCode;
        private String status;
        private String qrImageKey;
        private String qrImageUrl;
        private String qrMode;
        private String qrModeLabel;
        /** 生成方式说明；DEV 模式下必须提示非真实小程序码 */
        private String qrNotice;
        private String qrScenePage;
        private LocalDateTime qrGeneratedAt;
        private String channel;
        private Integer visitCount;
        private Integer bookingCount;
        private LocalDateTime createdAt;
        private LocalDateTime lastVisitAt;
        /** 可直接复制的推广文案 */
        private String shareText;
    }

    /** 推广统计（仅真实数据）。 */
    @Data
    public static class ReferralStatsVO {
        private int todayBookingCount;
        private int weekBookingCount;
        private int totalBookingCount;
        private int completedCount;
        private int pendingCount;
        private int totalCustomers;
        private double completionRate;
    }

    /** 生成/重新生成二维码。 */
    @Data
    public static class QrRequest {
        private Integer width = 430;
        @Size(max = 32)
        private String channel;
    }
}