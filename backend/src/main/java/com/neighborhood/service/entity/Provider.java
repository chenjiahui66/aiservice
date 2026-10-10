package com.neighborhood.service.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import com.neighborhood.service.enums.AuditStatus;
import com.neighborhood.service.enums.EnabledStatus;
import java.time.LocalDateTime;

/**
 * 服务者档案与审核状态
 *
 * <p>对应表 {@code providers}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("providers")
public class Provider {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("user_id")
    /** 关联 users.id */
    private Long userId;

    @TableField("real_name")
    /** 服务者姓名/称呼 */
    private String realName;

    @TableField("service_area")
    /** 服务区域 */
    private String serviceArea;

    @TableField("audit_status")
    /** 审核状态 */
    private AuditStatus auditStatus;

    @TableField("audit_remark")
    /** 审核意见/驳回原因 */
    private String auditRemark;

    @TableField("audited_by")
    /** 审核管理员 id */
    private Long auditedBy;

    @TableField("audited_at")
    /** 审核时间 */
    private LocalDateTime auditedAt;

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
