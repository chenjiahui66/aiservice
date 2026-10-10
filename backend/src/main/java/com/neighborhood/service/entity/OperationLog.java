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
import java.time.LocalDateTime;

/**
 * 平台操作日志
 *
 * <p>对应表 {@code operation_logs}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("operation_logs")
public class OperationLog {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("operator_type")
    /** 操作者类型 */
    private OperatorType operatorType;

    @TableField("operator_id")
    /** 操作者 id */
    private Long operatorId;

    @TableField("operator_name")
    /** 操作者名称 */
    private String operatorName;

    @TableField("module")
    /** 模块 */
    private String module;

    @TableField("action")
    /** 动作 */
    private String action;

    @TableField("target_id")
    /** 操作对象 id */
    private String targetId;

    @TableField("detail")
    /** 详情 */
    private String detail;

    @TableField("ip")
    /** IP */
    private String ip;

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
