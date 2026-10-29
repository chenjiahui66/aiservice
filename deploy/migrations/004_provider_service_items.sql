-- =====================================================================
-- 004_provider_service_items —— 服务者自己勾选「提供哪几项服务」
--
-- 背景：
--   服务项目之前是「平台模板对所有服务者一律可见」——不管张师傅实际做不做
--   「上门取件寄件」，他的主页上都会挂着这一项。一个人不可能提供十几项服务，
--   主页上只该出现他真正提供的那几项，分享给别人的推广码主页也该如此。
--
--   改造后：服务者从「平台后台维护的类目」里自己勾选提供哪几项，可取消、
--   也可随时加回。数据落在 service_items 表本身，不新建表：
--     provider_id = 0       平台模板（后台维护）
--     provider_id = 服务者   该服务者派生出来的记录，template_id 指向平台模板
--     enabled = 1            在提供；0 = 已取消（记录保留，可随时加回）
--
--   展示内容实时取平台模板：后台改了类目名称/价格/说明，所有服务者主页立刻同步。
--
-- 为什么不写进 sql/schema.sql：
--   schema.sql 只在数据卷首次初始化时执行一次，存量环境补不上，
--   必须走迁移目录（见 001_user_consents.sql 开头的原因说明）。
--
-- 本脚本可重复执行：用 NOT EXISTS 保证不会重复插入。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 存量服务者默认全选
--
-- 改造前所有平台模板对他们都可见，改造后不能突然少服务 ——
-- 先给存量服务者补齐「全选」，他们上线后再自己去减。
-- 新注册的服务者由后端注册流程直接勾选，不依赖本脚本。
-- ---------------------------------------------------------------------
INSERT INTO `service_items`
  (`provider_id`, `template_id`, `name`, `description`, `icon_url`, `unit_desc`, `price_desc`,
   `form_fields`, `booking_rules`, `notes`, `sort_order`, `enabled`,
   `created_at`, `updated_at`, `deleted`)
SELECT p.`id`, t.`id`, t.`name`, t.`description`, t.`icon_url`, t.`unit_desc`, t.`price_desc`,
       t.`form_fields`, t.`booking_rules`, t.`notes`, t.`sort_order`, t.`enabled`,
       NOW(), NOW(), 0
FROM `providers` p
JOIN `service_items` t
  ON t.`provider_id` = 0
 AND t.`deleted` = 0
 AND t.`enabled` = 1
WHERE p.`deleted` = 0
  AND NOT EXISTS (
    SELECT 1
    FROM (
      SELECT `provider_id`, `template_id` FROM `service_items`
    ) x
    WHERE x.`provider_id` = p.`id`
      AND x.`template_id` = t.`id`
  );
