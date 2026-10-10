package com.neighborhood.service.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * 客户台账（服务者—客户关系）
 *
 * <p>对应表 {@code customers}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("customers")
public class Customer {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("provider_id")
    /** 所属服务者（数据隔离关键） */
    private Long providerId;

    @TableField("name")
    /** 客户称呼 */
    private String name;

    @TableField("phone")
    /** 联系电话 */
    private String phone;

    @TableField("community")
    /** 所在小区 */
    private String community;

    @TableField("address")
    /** 默认服务地址 */
    private String address;

    @TableField("remark")
    /** 客户备注 */
    private String remark;

    @TableField("first_service_at")
    /** 首次服务时间 */
    private LocalDateTime firstServiceAt;

    @TableField("last_service_at")
    /** 最近服务时间 */
    private LocalDateTime lastServiceAt;

    @TableField("next_service_at")
    /** 下次计划服务时间 */
    private LocalDateTime nextServiceAt;

    @TableField("order_count")
    /** 累计订单数 */
    private Integer orderCount;

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
