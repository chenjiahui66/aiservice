package com.neighborhood.service.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import com.neighborhood.service.enums.OrderSource;
import com.neighborhood.service.enums.OrderStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 预约订单
 *
 * <p>对应表 {@code orders}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("orders")
public class Order {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("order_no")
    /** 业务订单号 */
    private String orderNo;

    @TableField("provider_id")
    /** 所属服务者（数据隔离关键） */
    private Long providerId;

    @TableField("customer_id")
    /** 关联 customers.id */
    private Long customerId;

    @TableField("referral_code_id")
    /** 来源推广码记录 id */
    private Long referralCodeId;

    @TableField("service_item_id")
    /** 服务项目 id */
    private Long serviceItemId;

    @TableField("service_name")
    /** 服务名称快照 */
    private String serviceName;

    @TableField("customer_name")
    /** 客户称呼快照 */
    private String customerName;

    @TableField("customer_phone")
    /** 客户联系电话快照 */
    private String customerPhone;

    @TableField("community")
    /** 所在小区 */
    private String community;

    @TableField("address")
    /** 详细服务地址 */
    private String address;

    @TableField("booking_date")
    /** 预约日期 */
    private LocalDate bookingDate;

    @TableField("booking_slot")
    /** 预约时间段 */
    private String bookingSlot;

    @TableField("quantity")
    /** 服务数量 */
    private Integer quantity;

    @TableField("service_desc")
    /** 服务内容说明 */
    private String serviceDesc;

    @TableField("customer_remark")
    /** 客户特殊备注 */
    private String customerRemark;

    @TableField("provider_note")
    /** 服务者服务备注 */
    private String providerNote;

    @TableField("status")
    /** 订单状态 */
    private OrderStatus status;

    @TableField("cancel_reason")
    /** 取消原因 */
    private String cancelReason;

    @TableField("source")
    /** 来源 */
    private OrderSource source;

    @TableField("channel")
    /** 推广渠道 */
    private String channel;

    @TableField("confirmed_at")
    /** 确认时间 */
    private LocalDateTime confirmedAt;

    @TableField("started_at")
    /** 开始服务时间 */
    private LocalDateTime startedAt;

    @TableField("completed_at")
    /** 完成时间 */
    private LocalDateTime completedAt;

    @TableField("cancelled_at")
    /** 取消时间 */
    private LocalDateTime cancelledAt;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    /** 创建时间（自动填充） */
    private LocalDateTime createdAt;

    @TableField(value = "updated_at", fill = FieldFill.INSERT_UPDATE)
    /** 更新时间（自动填充） */
    private LocalDateTime updatedAt;

    @TableLogic
    /** 逻辑删除 */
    private Integer deleted;

}
