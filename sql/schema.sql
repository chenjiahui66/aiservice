-- =====================================================================
-- 邻里服务管家 —— 数据库初始化脚本
-- MySQL 8.0+ / InnoDB / utf8mb4
--
-- 设计约定：
--   1. 所有属于服务者的业务数据表都带 provider_id，用于强制数据隔离。
--   2. 业务表统一带 created_at / updated_at / deleted(逻辑删除)。
--   3. 高频查询字段（provider_id + 业务维度）建立复合索引。
--   4. 本脚本可重复执行：全部使用 CREATE TABLE IF NOT EXISTS / INSERT IGNORE。
--
-- ⚠️ 合规声明：以下资质与平台审核事项尚未核实，正式上线前必须逐项确认。
--    见 docs/上线前资质与审核清单.md
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `neighborhood`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `neighborhood`;

-- ---------------------------------------------------------------------
-- 1. users —— 服务者登录账号（小程序端身份）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`      VARCHAR(50)  NOT NULL COMMENT '登录名（手机号）',
  `password_hash` VARCHAR(100) NOT NULL COMMENT 'BCrypt 密码散列',
  `nickname`      VARCHAR(50)  NOT NULL COMMENT '昵称',
  `avatar_url`    VARCHAR(500) NULL     COMMENT '头像地址',
  `phone`         VARCHAR(20)  NULL     COMMENT '手机号',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '账号状态 1正常 2禁用',
  `last_login_at` DATETIME     NULL     COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0正常 1删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_phone` (`phone`),
  KEY `idx_users_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务者登录账号';

-- ---------------------------------------------------------------------
-- 2. providers —— 服务者档案与审核状态
--    一条 users 对应一条 providers（1:1）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `providers` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT UNSIGNED NOT NULL COMMENT '关联 users.id',
  `real_name`    VARCHAR(50)  NOT NULL COMMENT '服务者姓名/称呼',
  `service_area` VARCHAR(255) NULL     COMMENT '服务区域',
  `audit_status` TINYINT      NOT NULL DEFAULT 0 COMMENT '审核状态 0待审核 1通过 2驳回 3暂停',
  `audit_remark` VARCHAR(500) NULL     COMMENT '审核意见/驳回原因',
  `audited_by`   BIGINT UNSIGNED NULL   COMMENT '审核管理员 admin_users.id',
  `audited_at`   DATETIME     NULL     COMMENT '审核时间',
  `enabled`      TINYINT      NOT NULL DEFAULT 1 COMMENT '是否启用 1启用 0停用',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`      TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_providers_user` (`user_id`),
  KEY `idx_providers_audit` (`audit_status`, `enabled`),
  KEY `idx_providers_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务者档案';

-- ---------------------------------------------------------------------
-- 3. service_pages —— 个人服务主页（每个服务者一条）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_pages` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_id`     BIGINT UNSIGNED NOT NULL COMMENT '所属服务者',
  `display_name`    VARCHAR(50)  NOT NULL COMMENT '主页显示名称',
  `avatar_url`      VARCHAR(500) NULL     COMMENT '头像',
  `intro`           TEXT         NULL     COMMENT '个人介绍',
  `service_area`    VARCHAR(255) NULL     COMMENT '服务区域',
  `available_time`  VARCHAR(255) NULL     COMMENT '可预约时间描述',
  `price_desc`      VARCHAR(500) NULL     COMMENT '价格说明',
  `service_rules`   TEXT         NULL     COMMENT '服务规则',
  `contact_visible` TINYINT      NOT NULL DEFAULT 1 COMMENT '是否对外展示联系方式',
  `contact_phone`   VARCHAR(20)  NULL     COMMENT '对外联系电话',
  `enabled`         TINYINT      NOT NULL DEFAULT 1 COMMENT '主页启用状态',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`         TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_service_pages_provider` (`provider_id`),
  KEY `idx_service_pages_enabled` (`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='个人服务主页';

-- ---------------------------------------------------------------------
-- 4. service_items —— 服务项目
--    provider_id = 0 表示平台默认模板；> 0 表示服务者自行调整的项目
--    暂不做自定义表单设计器，但 form_fields / booking_rules 用 JSON 预留扩展空间
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_items` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_id`   BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=平台模板，>0=服务者项目',
  `template_id`   BIGINT UNSIGNED NULL     COMMENT '派生自的平台模板 id',
  `name`          VARCHAR(50)  NOT NULL COMMENT '服务名称',
  `description`   VARCHAR(500) NULL     COMMENT '服务说明',
  `icon_url`      VARCHAR(500) NULL     COMMENT '服务图标/图片',
  `unit_desc`     VARCHAR(50)  NULL     COMMENT '单位描述，如 次/袋',
  `price_desc`    VARCHAR(100) NULL     COMMENT '价格说明文案',
  `form_fields`   JSON         NULL     COMMENT '配置化预约表单字段定义',
  `booking_rules` JSON         NULL     COMMENT '可预约时间规则',
  `notes`         VARCHAR(500) NULL     COMMENT '服务限制与注意事项',
  `sort_order`    INT          NOT NULL DEFAULT 0 COMMENT '排序',
  `enabled`       TINYINT      NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_service_items_provider` (`provider_id`, `enabled`, `sort_order`),
  KEY `idx_service_items_template` (`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务项目与平台模板';

-- ---------------------------------------------------------------------
-- 5. referral_codes —— 服务者专属推广码【系统核心表】
--    - referral_code 为随机不可预测字符串，不暴露自增主键
--    - 长度 ≤ 32，可直接作为微信小程序码的 scene 参数
--    - 二维码只存存储 Key/相对路径，绝不存二进制大字段
--    - visit_count / booking_count 必须是真实统计数据
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `referral_codes` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_id`     BIGINT UNSIGNED NOT NULL COMMENT '所属服务者',
  `referral_code`   VARCHAR(32)  NOT NULL COMMENT '推广码（随机不可预测，全局唯一）',
  `status`          TINYINT      NOT NULL DEFAULT 1 COMMENT '状态 1启用 0停用',
  `qr_image_key`    VARCHAR(255) NULL     COMMENT '小程序码图片存储 Key / 相对路径',
  `qr_scene_page`   VARCHAR(128) NULL     COMMENT '小程序码指向的页面路径',
  `qr_generated_at` DATETIME     NULL     COMMENT '小程序码最近生成时间',
  `qr_mode`         VARCHAR(16)  NOT NULL DEFAULT 'DEV' COMMENT '生成方式 REAL=真实小程序码 DEV=开发降级',
  `channel`         VARCHAR(32)  NULL     COMMENT '推广渠道标记',
  `visit_count`     INT          NOT NULL DEFAULT 0 COMMENT '真实主页访问次数',
  `booking_count`   INT          NOT NULL DEFAULT 0 COMMENT '通过该码产生的订单数',
  `last_visit_at`   DATETIME     NULL     COMMENT '最近访问时间',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`         TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_referral_code` (`referral_code`),
  KEY `idx_referral_provider` (`provider_id`, `status`),
  KEY `idx_referral_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务者专属推广码';

-- ---------------------------------------------------------------------
-- 6. customers —— 客户台账（按 服务者—客户 关系维护，非全局客户）
--    同一手机号可为多个不同服务者的客户，彼此不可见
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_id`      BIGINT UNSIGNED NOT NULL COMMENT '所属服务者（数据隔离关键）',
  `name`             VARCHAR(50)  NOT NULL COMMENT '客户称呼',
  `phone`            VARCHAR(20)  NOT NULL COMMENT '联系电话',
  `community`        VARCHAR(100) NULL     COMMENT '所在小区',
  `address`          VARCHAR(255) NULL     COMMENT '默认服务地址',
  `remark`           VARCHAR(500) NULL     COMMENT '客户备注',
  `first_service_at` DATETIME     NULL     COMMENT '首次服务时间',
  `last_service_at`  DATETIME     NULL     COMMENT '最近服务时间',
  `next_service_at`  DATETIME     NULL     COMMENT '下次计划服务时间（复购计划）',
  `order_count`      INT          NOT NULL DEFAULT 0 COMMENT '累计订单数',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`          TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customers_provider_phone` (`provider_id`, `phone`),
  KEY `idx_customers_next` (`provider_id`, `next_service_at`),
  KEY `idx_customers_name` (`provider_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户台账';

-- ---------------------------------------------------------------------
-- 7. orders —— 预约订单
--    - 归属完全由后端依据 referral_code_id / provider_id 决定
--    - 客户联系方式做冗余快照，便于服务者直接联系与历史留痕
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_no`         VARCHAR(32)  NOT NULL COMMENT '业务订单号',
  `provider_id`      BIGINT UNSIGNED NOT NULL COMMENT '所属服务者（数据隔离关键）',
  `customer_id`      BIGINT UNSIGNED NULL     COMMENT '关联 customers.id',
  `referral_code_id` BIGINT UNSIGNED NULL     COMMENT '来源推广码记录 id',
  `service_item_id`  BIGINT UNSIGNED NULL     COMMENT '服务项目 id',
  `service_name`     VARCHAR(50)  NOT NULL COMMENT '服务名称快照',
  `customer_name`    VARCHAR(50)  NOT NULL COMMENT '客户称呼快照',
  `customer_phone`   VARCHAR(20)  NOT NULL COMMENT '客户联系电话快照',
  `community`        VARCHAR(100) NULL     COMMENT '所在小区',
  `address`          VARCHAR(255) NOT NULL COMMENT '详细服务地址',
  `booking_date`     DATE         NOT NULL COMMENT '预约日期',
  `booking_slot`     VARCHAR(32)  NOT NULL COMMENT '预约时间段，如 09:00-11:00',
  `quantity`         INT          NOT NULL DEFAULT 1 COMMENT '服务数量',
  `service_desc`     VARCHAR(500) NULL     COMMENT '服务内容说明',
  `customer_remark`  VARCHAR(500) NULL     COMMENT '客户特殊备注',
  `provider_note`    VARCHAR(500) NULL     COMMENT '服务者服务备注',
  `status`           VARCHAR(20)  NOT NULL DEFAULT 'PENDING_CONFIRM'
                     COMMENT 'PENDING_CONFIRM/CONFIRMED/SERVING/COMPLETED/CANCELLED',
  `cancel_reason`    VARCHAR(255) NULL     COMMENT '取消原因',
  `source`           VARCHAR(20)  NOT NULL DEFAULT 'QR_CODE'
                     COMMENT '来源 QR_CODE=扫码 MANUAL=手动创建',
  `channel`          VARCHAR(32)  NULL     COMMENT '推广渠道',
  `confirmed_at`     DATETIME     NULL,
  `started_at`       DATETIME     NULL,
  `completed_at`     DATETIME     NULL,
  `cancelled_at`     DATETIME     NULL,
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`          TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_no` (`order_no`),
  KEY `idx_orders_board` (`provider_id`, `booking_date`, `status`),
  KEY `idx_orders_customer` (`customer_id`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='预约订单';

-- ---------------------------------------------------------------------
-- 8. order_logs —— 订单操作记录（所有状态流转必须留痕）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_logs` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`      BIGINT UNSIGNED NOT NULL,
  `provider_id`   BIGINT UNSIGNED NOT NULL,
  `action`        VARCHAR(32)  NOT NULL COMMENT 'CREATE/CONFIRM/START/COMPLETE/CANCEL/UPDATE',
  `from_status`   VARCHAR(20)  NULL,
  `to_status`     VARCHAR(20)  NULL,
  `remark`        VARCHAR(500) NULL,
  `operator_type` VARCHAR(16)  NOT NULL COMMENT 'PROVIDER/CUSTOMER/ADMIN',
  `operator_id`   BIGINT UNSIGNED NULL,
  `operator_name` VARCHAR(50)  NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_order_logs_order` (`order_id`, `id`),
  KEY `idx_order_logs_provider` (`provider_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单操作记录';

-- ---------------------------------------------------------------------
-- 9. complaints —— 投诉 / 反馈 / 违规处理
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `complaints` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_id`    BIGINT UNSIGNED NULL COMMENT '被投诉/被反馈的服务者；平台级意见箱意见（无归属）允许为 NULL',
  `order_id`       BIGINT UNSIGNED NULL,
  `customer_name`  VARCHAR(50)  NULL,
  `customer_phone` VARCHAR(20)  NULL,
  `type`           VARCHAR(20)  NOT NULL COMMENT 'COMPLAINT投诉/FEEDBACK反馈/VIOLATION违规',
  `content`        TEXT         NOT NULL COMMENT '内容',
  `status`         VARCHAR(20)  NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/PROCESSING/CLOSED',
  `handle_remark`  VARCHAR(500) NULL COMMENT '处理结果',
  `handled_by`     BIGINT UNSIGNED NULL,
  `handled_at`     DATETIME     NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`        TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_complaints_provider` (`provider_id`, `status`),
  KEY `idx_complaints_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='投诉与违规处理';

-- ---------------------------------------------------------------------
-- 10. admin_users —— 平台管理员（与业务 users 表严格分离）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(50)  NOT NULL,
  `password_hash` VARCHAR(100) NOT NULL COMMENT 'BCrypt 密码散列',
  `real_name`     VARCHAR(50)  NULL,
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 2禁用',
  `last_login_at` DATETIME     NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台管理员';

-- ---------------------------------------------------------------------
-- 11. operation_logs —— 平台操作日志
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator_type` VARCHAR(16)  NOT NULL COMMENT 'ADMIN/PROVIDER',
  `operator_id`   BIGINT UNSIGNED NULL,
  `operator_name` VARCHAR(50)  NULL,
  `module`        VARCHAR(50)  NOT NULL COMMENT '模块',
  `action`        VARCHAR(50)  NOT NULL COMMENT '动作',
  `target_id`     VARCHAR(50)  NULL     COMMENT '操作对象 id',
  `detail`        VARCHAR(1000) NULL   COMMENT '详情',
  `ip`            VARCHAR(64)  NULL,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_op_logs_created` (`created_at`),
  KEY `idx_op_logs_operator` (`operator_type`, `operator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志';

-- ---------------------------------------------------------------------
-- 12. system_settings —— 系统基础设置
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(64)   NOT NULL,
  `setting_value` VARCHAR(1000) NULL,
  `description`   VARCHAR(255)  NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`       TINYINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统基础设置';

-- =====================================================================
-- 索引与约束补充说明
-- =====================================================================
-- · 数据隔离：service_pages / service_items / referral_codes / customers /
--            orders / order_logs / complaints 全部以 provider_id 为隔离维度。
-- · orders 复合索引 (provider_id, booking_date, status) 直接支撑
--   「今日工作台账」的核心查询：某服务者某天的待办/已办列表。
-- · customers 唯一键 (provider_id, phone) 保证同一服务者下客户不重复，
--   同时允许同一手机号在不同服务者下各存一份，符合「按服务者—客户关系维护」。