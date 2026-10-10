package com.neighborhood.service.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/** 公开侧（客户扫码进入）DTO：服务主页查询与预约提交。 */
public final class PublicDto {

    private PublicDto() {
    }

    // ---------------- 服务主页 ----------------

    @Data
    public static class ProviderHomeVO {
        /** 推广码（回传给预约接口，决定订单归属） */
        private String referralCode;
        private Long providerId;
        private String displayName;
        private String avatarUrl;
        private String intro;
        private String serviceArea;
        private String availableTime;
        private String priceDesc;
        private String serviceRules;
        /** 联系方式是否对外展示；为 false 时 contactPhone 返回 null */
        private Boolean contactVisible;
        private String contactPhone;
        private java.util.List<ServiceItemVO> serviceItems;
        /** 服务者提醒语，例如「本人提供，非平台代运营」 */
        private String disclaimer;
    }

    @Data
    public static class ServiceItemVO {
        private Long id;
        private String name;
        private String description;
        private String iconUrl;
        private String unitDesc;
        private String priceDesc;
        /** 配置化表单字段定义（JSON 字符串），前端据此渲染表单 */
        private String formFields;
        /** 可预约时间规则（JSON 字符串） */
        private String bookingRules;
        private String notes;
    }

    // ---------------- 预约 ----------------

    @Data
    public static class BookingRequest {
        /**
         * 推广码 —— <b>订单归属的唯一依据</b>。
         * 本接口刻意不接受 providerId，服务端必须依据本字段反查归属。
         */
        @NotBlank(message = "缺少推广码，无法确定服务者")
        private String referralCode;

        @NotNull(message = "请选择服务项目")
        private Long serviceItemId;

        @NotBlank(message = "客户称呼不能为空")
        @Size(max = 20, message = "客户称呼过长")
        private String customerName;

        @NotBlank(message = "联系电话不能为空")
        @Pattern(regexp = "^1[3-9]\\d{9}$|^[0-9]{7,8}$", message = "联系电话格式不正确")
        private String customerPhone;

        @Size(max = 60, message = "小区名称过长")
        private String community;

        @NotBlank(message = "详细地址不能为空")
        @Size(max = 200, message = "详细地址过长")
        private String address;

        @NotNull(message = "请选择预约日期")
        @FutureOrPresent(message = "预约日期不能早于今天")
        private LocalDate bookingDate;

        @NotBlank(message = "请选择预约时间段")
        private String bookingSlot;

        @Size(max = 20, message = "服务内容说明过长")
        private String serviceDesc;

        @Size(max = 200, message = "备注过长")
        private String remark;

        /** 隐私告知确认 */
        private Boolean privacyAccepted;

        /** 推广渠道标记，由小程序端如实上报 */
        @Size(max = 32)
        private String channel;
    }

    @Data
    public static class BookingResultVO {
        private String orderNo;
        private String status;
        private String statusLabel;
        private String providerDisplayName;
        private String message;
    }
}