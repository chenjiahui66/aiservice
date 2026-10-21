-- =====================================================================
-- 001_user_consents —— 用户协议 / 隐私政策同意记录（合规留证）
--
-- 为什么需要迁移脚本，而不是只改 sql/schema.sql：
--   schema.sql 挂在 MySQL 容器的 docker-entrypoint-initdb.d 下，
--   **只在数据卷首次初始化时执行一次**。已经部署过的环境不会再跑它，
--   新增的表和列就永远补不上 —— 功能上线即报错。
--   所以存量环境必须靠 deploy/migrate.sh 执行本目录下的迁移。
--
-- 本脚本必须**可重复执行**：migrate.sh 用 schema_migrations 表去重，
--   但脚本本身也要幂等，防止执行到一半失败后重跑出问题。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 同意记录表
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_consents` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT UNSIGNED NULL     COMMENT '服务者ID；匿名客户下单时为NULL',
  `user_type`      VARCHAR(16)  NOT NULL    COMMENT '主体类型 PROVIDER=服务者 CUSTOMER=客户',
  `subject_type`   VARCHAR(16)  NOT NULL    COMMENT '同意对象 AGREEMENT=服务协议 PRIVACY=隐私政策',
  `subject_id`     VARCHAR(64)  NULL     COMMENT '关联业务ID（如订单号），可为空',
  `policy_version` VARCHAR(16)  NOT NULL    COMMENT '协议版本号，如 v1.0',
  `agreed`         TINYINT       NOT NULL    COMMENT '1=同意 0=拒绝',
  `client_ip`      VARCHAR(45)  NULL     COMMENT '同意时的客户端IP',
  `user_agent`     VARCHAR(500) NULL     COMMENT '同意时的客户端标识',
  `agreed_at`      DATETIME      NOT NULL    COMMENT '同意时间',
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted`        TINYINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_consents_user` (`user_id`, `subject_type`),
  KEY `idx_consents_agreed_at` (`agreed_at`),
  KEY `idx_consents_subject` (`subject_type`, `subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户协议与隐私政策同意记录';

-- ---------------------------------------------------------------------
-- 2. users 表补两个「当前同意状态」字段
--
-- ⚠️ MySQL 8.0 **不支持** ALTER TABLE ... ADD COLUMN IF NOT EXISTS
--    （那是 MariaDB 的语法）。这里用 information_schema 判存在性 +
--    PREPARE 动态 SQL 实现幂等。
-- ---------------------------------------------------------------------
SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `consent_at` DATETIME NULL COMMENT ''最近一次同意协议的时间'' AFTER `last_login_at`',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'consent_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `users` ADD COLUMN `policy_version` VARCHAR(16) NULL COMMENT ''最近一次同意的协议版本号'' AFTER `consent_at`',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'policy_version'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
