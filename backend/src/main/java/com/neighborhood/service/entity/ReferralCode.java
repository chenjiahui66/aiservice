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
import com.neighborhood.service.enums.QrMode;
import java.time.LocalDateTime;

/**
 * 服务者专属推广码
 *
 * <p>对应表 {@code referral_codes}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("referral_codes")
public class ReferralCode {

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("provider_id")
    /** 所属服务者 */
    private Long providerId;

    @TableField("referral_code")
    /** 推广码（随机不可预测，全局唯一） */
    private String referralCode;

    @TableField("status")
    /** 状态 */
    private EnabledStatus status;

    @TableField("qr_image_key")
    /** 小程序码图片存储 Key（不存二进制） */
    private String qrImageKey;

    @TableField("qr_scene_page")
    /** 小程序码指向页面 */
    private String qrScenePage;

    @TableField("qr_generated_at")
    /** 小程序码最近生成时间 */
    private LocalDateTime qrGeneratedAt;

    @TableField("qr_mode")
    /** 生成方式 REAL/DEV */
    private QrMode qrMode;

    @TableField("channel")
    /** 推广渠道标记 */
    private String channel;

    @TableField("visit_count")
    /** 真实主页访问次数 */
    private Integer visitCount;

    @TableField("booking_count")
    /** 通过该码产生的订单数 */
    private Integer bookingCount;

    @TableField("last_visit_at")
    /** 最近访问时间 */
    private LocalDateTime lastVisitAt;

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
