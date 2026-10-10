package com.neighborhood.service.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import com.neighborhood.service.enums.OperatorType;
import com.neighborhood.service.enums.OrderAction;
import com.neighborhood.service.enums.OrderStatus;
import java.time.LocalDateTime;

/**
 * 订单操作记录
 *
 * <p>对应表 {@code order_logs}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("order_logs")
public class OrderLog {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("order_id")
    /** 订单 id */
    private Long orderId;

    @TableField("provider_id")
    /** 所属服务者 */
    private Long providerId;

    @TableField("action")
    /** 动作 */
    private OrderAction action;

    @TableField("from_status")
    /** 原状态 */
    private OrderStatus fromStatus;

    @TableField("to_status")
    /** 新状态 */
    private OrderStatus toStatus;

    @TableField("remark")
    /** 备注 */
    private String remark;

    @TableField("operator_type")
    /** 操作者类型 */
    private OperatorType operatorType;

    @TableField("operator_id")
    /** 操作者 id */
    private Long operatorId;

    @TableField("operator_name")
    /** 操作者名称 */
    private String operatorName;

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
