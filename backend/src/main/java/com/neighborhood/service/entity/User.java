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
 * 服务者登录账号
 *
 * <p>对应表 {@code users}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("users")
public class User {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("username")
    /** 登录名（手机号） */
    private String username;

    @TableField("password_hash")
    /** BCrypt 密码散列 */
    private String passwordHash;

    @TableField("nickname")
    /** 昵称 */
    private String nickname;

    @TableField("avatar_url")
    /** 头像地址 */
    private String avatarUrl;

    @TableField("phone")
    /** 手机号 */
    private String phone;

    @TableField("status")
    /** 账号状态 */
    private EnabledStatus status;

    @TableField("last_login_at")
    /** 最后登录时间 */
    private LocalDateTime lastLoginAt;

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
