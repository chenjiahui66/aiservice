package com.neighborhood.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 服务者端订单相关 DTO。 */
public final class OrderDto {

    private OrderDto() {
    }

    @Data
    public static class OrderVO {
        private Long id;
        private String orderNo;
        private Long customerId;
        private String customerName;
        private String customerPhone;
        private String community;
        private String address;
        private String serviceName;
        private Integer quantity;
        private String serviceDesc;
        private String customerRemark;
        private String providerNote;
        private LocalDate bookingDate;
        private String bookingSlot;
        private String status;
        private String statusLabel;
        private String source;
        private String channel;
        private String cancelReason;
        private LocalDateTime confirmedAt;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
        private LocalDateTime createdAt;
        /** 订单状态流转记录 */
        private List<OrderLogVO> logs;
    }

    @Data
    public static class OrderLogVO {
        private String action;
        private String actionLabel;
        private String fromStatus;
        private String toStatus;
        private String remark;
        private String operatorType;
        private String operatorName;
        private LocalDateTime createdAt;
    }

    /** 列表查询条件。所有字段为空时按默认顺序返回。 */
    @Data
    public static class OrderQuery {
        private LocalDate dateFrom;
        private LocalDate dateTo;
        private String status;
        /** 客户关键词：姓名或手机号 */
        private String keyword;
        private Long serviceItemId;
        private Integer page = 1;
        private Integer size = 20;
    }

    /** 今日工作台账。服务者每天使用频率最高的页面。 */
    @Data
    public static class BoardVO {
        private LocalDate date;
        private int pendingConfirmCount;
        private int pendingServiceCount;
        private int completedCount;
        private int cancelledCount;
        private int totalCount;
        /** 按预约时间排序的任务列表 */
        private List<OrderVO> tasks;
    }

    /** 服务者手动记单（电话/微信/线下沟通）。 */
    @Data
    public static class ManualOrderRequest {
        @NotBlank(message = "客户称呼不能为空")
        @Size(max = 20)
        private String customerName;

        @NotBlank(message = "联系电话不能为空")
        private String customerPhone;

        @Size(max = 60)
        private String community;

        @NotBlank(message = "详细地址不能为空")
        @Size(max = 200)
        private String address;

        private Long serviceItemId;
        @Size(max = 50)
        private String serviceName;

        private LocalDate bookingDate;
        @NotBlank(message = "预约时间段不能为空")
        private String bookingSlot;

        private Integer quantity = 1;
        @Size(max = 200)
        private String serviceDesc;
        @Size(max = 200)
        private String customerRemark;
        /** 是否直接进入「已预约」状态；false 则为待确认 */
        private Boolean confirmed = false;
    }

    /** 状态流转请求。目标状态由后端根据 action 推导，不接受前端直传状态字符串。 */
    @Data
    public static class StatusChangeRequest {
        @Size(max = 200, message = "备注过长")
        private String remark;
    }

    /** 服务备注更新 */
    @Data
    public static class NoteUpdateRequest {
        @Size(max = 500, message = "服务备注过长")
        private String providerNote;
    }

    /** 取消请求 */
    @Data
    public static class CancelRequest {
        @NotBlank(message = "请填写取消原因")
        @Size(max = 200, message = "取消原因过长")
        private String reason;
    }
}