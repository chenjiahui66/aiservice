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
 * 系统基础设置
 *
 * <p>对应表 {@code system_settings}。字段与 sql/schema.sql 逐列对齐，改表必须同步改本类。</p>
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("system_settings")
public class SystemSetting {

    /**
     * 设置项键名：推广指导视频的 https 直链。
     *
     * <p>留空 = 小程序「我的推广」页不显示「视频推广指导」入口。
     * 管理员在「系统基础设置」页填写，保存后小程序刷新即生效。</p>
     */
    public static final String KEY_PROMO_VIDEO_URL = "promo.video.url";

    @TableId(value = "id", type = IdType.AUTO)
    /** 主键 */
    private Long id;

    @TableField("setting_key")
    /** 配置键 */
    private String settingKey;

    @TableField("setting_value")
    /** 配置值 */
    private String settingValue;

    @TableField("description")
    /** 描述 */
    private String description;

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
