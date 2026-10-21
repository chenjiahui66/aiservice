package com.neighborhood.service.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** 平台管理端 DTO。所有数据来自真实库表统计，不允许前端写死。 */
public final class AdminDto {

    private AdminDto() {
    }

    /** 平台概览。每一项都必须来自实际 count 查询。 */
    @Data
    public static class DashboardVO {
        private long totalProviders;
        private long pendingAuditProviders;
        private long approvedProviders;
        private long disabledProviders;
        private long totalUsers;
        private long totalOrders;
        private long pendingConfirmOrders;
        private long servingOrders;
        private long completedOrders;
        private long cancelledOrders;
        private long totalCustomers;
        private long pendingComplaints;
        private long totalVisits;
        /** 近 7 日订单量趋势 */
        private List<TrendPoint> orderTrend;
        private String wechatCodeMode;
    }

    @Data
    public static class TrendPoint {
        private String date;
        private long count;
    }

    @Data
    public static class ProviderListVO {
        private Long id;
        private Long userId;
        private String realName;
        private String phone;
        private String serviceArea;
        private String auditStatus;
        private String auditStatusLabel;
        private String enabled;
        private String referralCode;
        /**
         * 服务主页是否对外开放。
         * null = 该服务者还没有主页记录（极少见，等同于未开放）。
         */
        private Boolean pageEnabled;
        /** 最近一次同意《用户服务协议》《隐私政策》的时间；null = 从未同意过 */
        private LocalDateTime consentAt;
        /** 最近一次同意的协议版本号 */
        private String policyVersion;
        private long orderCount;
        private long customerCount;
        private LocalDateTime createdAt;
        private LocalDateTime auditedAt;
    }

    @Data
    public static class ProviderQuery {
        private String keyword;
        private String auditStatus;
        private String enabled;
        private Integer page = 1;
        private Integer size = 20;
    }

    /** 服务者审核请求。 */
    @Data
    public static class AuditRequest {
        /** true=通过，false=驳回 */
        @NotNull(message = "请选择审核结果")
        private Boolean approved;

        @Size(max = 500, message = "审核意见过长")
        private String remark;

        /** 是否同步停用/启用服务者账号 */
        private Boolean toggleEnabled;
    }

    /** 启用/停用服务者。 */
    @Data
    public static class StatusRequest {
        @NotNull(message = "请指定状态")
        private Boolean enabled;

        @Size(max = 500)
        private String reason;
    }

    /** 开启 / 关闭服务主页。 */
    @Data
    public static class PageRequest {
        @NotNull(message = "请指定主页状态")
        private Boolean enabled;

        @Size(max = 500)
        private String reason;
    }

    @Data
    public static class ServiceItemVO {
        private Long id;
        private Long templateId;
        private String name;
        private String description;
        private String iconUrl;
        private String unitDesc;
        private String priceDesc;
        private String formFields;
        private String bookingRules;
        private String notes;
        private Integer sortOrder;
        private String enabled;
    }

    @Data
    public static class ServiceItemSaveRequest {
        @Size(max = 50, message = "服务名称过长")
        private String name;

        @Size(max = 500)
        private String description;

        @Size(max = 500)
        private String iconUrl;

        @Size(max = 50)
        private String unitDesc;

        @Size(max = 100)
        private String priceDesc;

        private String formFields;
        private String bookingRules;

        @Size(max = 500)
        private String notes;

        private Integer sortOrder;
        private Boolean enabled;
    }

    /** 操作日志条目。 */
    @Data
    public static class OperationLogVO {
        private Long id;
        private String operatorType;
        private String operatorName;
        private String module;
        private String action;
        private String targetId;
        private String detail;
        private String ip;
        private LocalDateTime createdAt;
    }
}