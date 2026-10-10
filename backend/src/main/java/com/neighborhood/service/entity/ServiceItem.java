package com.neighborhood.service.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import com.neighborhood.service.enums.EnabledStatus;
import java.time.LocalDateTime;

/**
 * 服务项目与平台模板
 *
 * <p>对应表 {@code service_items}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("service_items")
public class ServiceItem {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("provider_id")
    /** 0=平台模板，>0=服务者项目 */
    private Long providerId;

    @TableField("template_id")
    /** 派生自的平台模板 id */
    private Long templateId;

    @TableField("name")
    /** 服务名称 */
    private String name;

    @TableField("description")
    /** 服务说明 */
    private String description;

    @TableField("icon_url")
    /** 服务图标/图片 */
    private String iconUrl;

    @TableField("unit_desc")
    /** 单位描述 */
    private String unitDesc;

    @TableField("price_desc")
    /** 价格说明文案 */
    private String priceDesc;

    @TableField("form_fields")
    /** 配置化预约表单字段(JSON) */
    private String formFields;

    @TableField("booking_rules")
    /** 可预约时间规则(JSON) */
    private String bookingRules;

    @TableField("notes")
    /** 服务限制与注意事项 */
    private String notes;

    @TableField("sort_order")
    /** 排序 */
    private Integer sortOrder;

    @TableField("enabled")
    /** 是否启用 */
    private EnabledStatus enabled;

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
