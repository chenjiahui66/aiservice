package com.neighborhood.service.common;

import lombok.Getter;

/**
 * 统一业务错误码。
 *
 * <p>分段规则：
 * <ul>
 *   <li>400xx 通用 / 参数</li>
 *   <li>401xx 认证与授权</li>
 *   <li>410xx 推广码与服务者</li>
 *   <li>420xx 订单</li>
 *   <li>430xx 客户</li>
 *   <li>440xx 服务项目</li>
 *   <li>450xx 微信小程序能力</li>
 * </ul>
 */
@Getter
public enum ResultCode {

    SUCCESS(0, "操作成功"),

    // ---------- 通用 ----------
    PARAM_ERROR(40000, "参数错误"),
    NOT_FOUND(40400, "资源不存在"),
    SYSTEM_ERROR(50000, "系统繁忙，请稍后重试"),

    // ---------- 认证与授权 ----------
    UNAUTHORIZED(40100, "登录状态已失效，请重新登录"),
    FORBIDDEN(40300, "无权访问该资源"),
    TOKEN_INVALID(40101, "登录凭证无效"),
    LOGIN_FAILED(40102, "账号或密码不正确"),
    ACCOUNT_DISABLED(40103, "账号已被停用"),
    USERNAME_EXISTS(40104, "该手机号已注册"),
    PASSWORD_TOO_WEAK(40105, "密码长度需为 6~20 位"),

    // ---------- 推广码与服务者 ----------
    REFERRAL_CODE_NOT_FOUND(41001, "推广码不存在"),
    REFERRAL_CODE_DISABLED(41002, "该推广码已停用，请联系服务者"),
    REFERRAL_CODE_BROKEN(41003, "推广码无效"),
    PROVIDER_NOT_FOUND(41004, "服务者不存在"),
    PROVIDER_PENDING_AUDIT(41005, "服务者尚未通过审核，暂时无法展示主页"),
    PROVIDER_AUDIT_REJECTED(41006, "服务者审核未通过"),
    PROVIDER_DISABLED(41007, "该服务者已暂停服务"),
    HOMEPAGE_DISABLED(41008, "该服务主页已关闭"),

    // ---------- 订单 ----------
    ORDER_NOT_FOUND(42001, "订单不存在"),
    ORDER_STATUS_ILLEGAL(42002, "订单当前状态不支持该操作"),
    ORDER_STATUS_TRANSITION_INVALID(42003, "订单状态流转不合法"),
    ORDER_SLOT_UNAVAILABLE(42004, "该预约时间段不可用"),
    ORDER_DATE_TOO_FAR(42005, "预约日期超出可预约范围"),

    // ---------- 客户 ----------
    CUSTOMER_NOT_FOUND(43001, "客户不存在"),

    // ---------- 服务项目 ----------
    SERVICE_ITEM_NOT_FOUND(44001, "服务项目不存在"),
    SERVICE_ITEM_DISABLED(44002, "服务项目已停用"),

    // ---------- 微信小程序能力 ----------
    WECHAT_NOT_CONFIGURED(45001, "小程序能力尚未配置，无法生成真实小程序码"),
    WECHAT_CODE_FAILED(45002, "小程序码生成失败，请稍后重试"),
    WECHAT_ACCESS_TOKEN_FAILED(45003, "获取微信 access_token 失败"),

    // ---------- 冲突 ----------
    DUPLICATED(40900, "数据已存在，请勿重复提交");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}