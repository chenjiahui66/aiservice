package com.neighborhood.service.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import com.neighborhood.service.enums.ComplaintStatus;
import com.neighborhood.service.enums.ComplaintType;
import java.time.LocalDateTime;

/**
 * 投诉与违规处理
 *
 * <p>对应表 {@code complaints}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("complaints")
public class Complaint {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("provider_id")
    /** 被投诉/被反馈的服务者 */
    private Long providerId;

    @TableField("order_id")
    /** 关联订单 */
    private Long orderId;

    @TableField("customer_name")
    /** 客户称呼 */
    private String customerName;

    @TableField("customer_phone")
    /** 客户电话 */
    private String customerPhone;

    @TableField("type")
    /** 类型 */
    private ComplaintType type;

    @TableField("content")
    /** 内容 */
    private String content;

    @TableField("status")
    /** 处理状态 */
    private ComplaintStatus status;

    @TableField("handle_remark")
    /** 处理结果 */
    private String handleRemark;

    @TableField("handled_by")
    /** 处理人 */
    private Long handledBy;

    @TableField("handled_at")
    /** 处理时间 */
    private LocalDateTime handledAt;

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
