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

    /**
     * 「我的服务类目」管理列表的一行。
     *
     * <p>服务者能选的类目<b>只有平台后台维护的那批</b>，本 VO 给出的就是这批，
     * 外加「我是否在提供」的勾选状态。</p>
     */
    @Data
    public static class MyServiceItemVO {
        /** 平台模板 id —— 勾选 / 取消都用它 */
        private Long templateId;
        /** 服务者自己派生出的那条记录 id；从未勾选过为 null */
        private Long myItemId;
        private String name;
        private String description;
        private String iconUrl;
        private String unitDesc;
        private String priceDesc;
        private String notes;
        private Integer sortOrder;
        /** 平台是否仍在启用这个类目；停用后不能再勾选 */
        private Boolean platformEnabled;
        /** 我当前是否在提供这一项 */
        private Boolean selected;
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
        /**
         * 推广指导视频的 https 直链，由管理员在「系统基础设置」里配置。
         *
         * <p>为空表示还没配置，小程序据此**不显示**「视频推广指导」入口 ——
         * 免得服务者点开一个播不出来的东西。</p>
         */
        private String promoVideoUrl;
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