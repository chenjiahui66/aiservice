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
 * 个人服务主页
 *
 * <p>对应表 {@code service_pages}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("service_pages")
public class ServicePage {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("provider_id")
    /** 所属服务者 */
    private Long providerId;

    @TableField("display_name")
    /** 主页显示名称 */
    private String displayName;

    @TableField("avatar_url")
    /** 头像 */
    private String avatarUrl;

    @TableField("intro")
    /** 个人介绍 */
    private String intro;

    @TableField("service_area")
    /** 服务区域 */
    private String serviceArea;

    @TableField("available_time")
    /** 可预约时间描述 */
    private String availableTime;

    @TableField("price_desc")
    /** 价格说明 */
    private String priceDesc;

    @TableField("service_rules")
    /** 服务规则 */
    private String serviceRules;

    @TableField("contact_visible")
    /** 是否对外展示联系方式 */
    private EnabledStatus contactVisible;

    @TableField("contact_phone")
    /** 对外联系电话 */
    private String contactPhone;

    @TableField("enabled")
    /** 主页启用状态 */
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
