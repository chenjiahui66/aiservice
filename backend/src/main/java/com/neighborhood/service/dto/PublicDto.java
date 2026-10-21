package com.neighborhood.service.dto;

import jakarta.validation.constraints.AssertTrue;
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

        /**
         * 隐私告知确认：客户的姓名、手机号、地址属于个人信息，
         * 必须在收集前明示用途并取得同意，服务端强制校验。
         */
        @AssertTrue(message = "请先阅读并同意《隐私政策》")
        private Boolean privacyAccepted;

        /** 同意的隐私政策版本号，用于留证追溯 */
        @Size(max = 16, message = "协议版本号过长")
        private String policyVersion;

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

    // ---------------- 意见反馈 ----------------

    @Data
    public static class FeedbackRequest {

        /**
         * 反馈类型，取值须为 {@code ComplaintType} 的枚举名：
         * {@code FEEDBACK} 功能建议 / {@code COMPLAINT} 服务投诉 / {@code VIOLATION} 违规举报。
         *
         * <p>刻意用 {@code String} 接收而非直接用枚举：非法值由业务层翻译成
         * {@code 40000} 参数错误，保持与项目统一的响应信封；
         * 若直接交给 Jackson 反序列化，会抛出与信封结构不一致的 400。</p>
         */
        @NotBlank(message = "请选择反馈类型")
        @Size(max = 32)
        private String type;

        /** 反馈正文，必填。 */
        @NotBlank(message = "请填写反馈内容")
        @Size(max = 500, message = "反馈内容最多 500 字")
        private String content;

        /** 称呼，选填，仅用于回访。 */
        @Size(max = 32)
        private String customerName;

        /** 联系电话，选填，仅用于回访。 */
        @Pattern(regexp = "^$|^1[3-9]\\d{9}$", message = "手机号格式不正确")
        private String customerPhone;

        /**
         * 推广码，选填。客户从某服务者主页进入时携带，用于把反馈挂到该服务者名下。
         *
         * <p>本接口刻意<b>不接受 providerId</b>：服务者身份只来自登录 token，
         * 客户身份只来自推广码反查，客户端无从指定归属。</p>
         */
        @Size(max = 64)
        private String referralCode;

        /**
         * 隐私告知确认：反馈时填写的称呼与电话属于个人信息，需先取得明示同意。
         */
        @AssertTrue(message = "请先阅读并同意《隐私政策》")
        private Boolean privacyAccepted;

        /** 同意的隐私政策版本号，用于留证追溯 */
        @Size(max = 16, message = "协议版本号过长")
        private String policyVersion;
    }

    @Data
    public static class FeedbackResultVO {
        private Long id;
        private String status;
        private String statusLabel;
        private String createdAt;
    }
}