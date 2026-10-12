-- =====================================================================
-- 创建平台管理员（本地开发库）
--
-- ⚠️ 密码散列由项目自身的 BCryptPasswordEncoder 生成（scripts\gen-admin-hash.cmd），
--    与应用登录校验逻辑完全一致。
--
-- 生产环境**不要**用这个文件：生产管理员由 deploy.sh 通过
-- BOOTSTRAP_ADMIN_ENABLED + ADMIN_PASSWORD 在首次启动时创建，
-- 口令只存在于服务器本机的 deploy/.env，不会进入任何提交文件。
-- =====================================================================
USE `neighborhood`;

-- 幂等：已存在则更新散列与启用状态
INSERT INTO `admin_users`
  (`username`, `password_hash`, `real_name`, `status`, `created_at`, `updated_at`, `deleted`)
VALUES
  ('admin', '$2a$10$fmeIe.0q4AXz92E5S8lBi./DN0kryZV2.D.Ij4HQS0Y8og8.VuYj.', '平台管理员', 1, NOW(), NOW(), 0)
ON DUPLICATE KEY UPDATE
  `password_hash` = VALUES(`password_hash`),
  `real_name`    = VALUES(`real_name`),
  `status`       = 1,
  `deleted`      = 0,
  `updated_at`   = NOW();

SELECT id, username, real_name, status, LEFT(password_hash, 10) AS hash_prefix, created_at
FROM admin_users;