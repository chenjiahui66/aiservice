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
 * 用户协议 / 隐私政策同意记录。
 *
 * <p>对应表 {@code user_consents}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 *
 * <p>这张表是合规留证：微信审核要求收集个人信息前必须取得用户明示同意，
 * 出了争议要能证明「谁、何时、在哪、就哪个版本同意了哪份文件」。
 * 因此每次同意动作都新增一条，而不是更新旧记录。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("user_consents")
public class UserConsent {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("user_id")
    /** 服务者ID；匿名客户下单时为 null */
    private Long userId;

    @TableField("user_type")
    /** 主体类型：PROVIDER / CUSTOMER */
    private String userType;

    @TableField("subject_type")
    /** 同意对象：AGREEMENT（服务协议）/ PRIVACY（隐私政策） */
    private String subjectType;

    @TableField("subject_id")
    /** 关联业务ID（如订单号），可为空 */
    private String subjectId;

    @TableField("policy_version")
    /** 协议版本号，如 v1.0 */
    private String policyVersion;

    @TableField("agreed")
    /** 1=同意 0=拒绝 */
    private Integer agreed;

    @TableField("client_ip")
    /** 同意时的客户端 IP */
    private String clientIp;

    @TableField("user_agent")
    /** 同意时的客户端标识 */
    private String userAgent;

    @TableField("agreed_at")
    /** 同意时间 */
    private LocalDateTime agreedAt;

    @TableField(value = "created_at", fill = FieldFill.INSERT)
    /** 创建时间（自动填充） */
    private LocalDateTime createdAt;

    @TableLogic
    /** 逻辑删除 */
    private Integer deleted;
}
