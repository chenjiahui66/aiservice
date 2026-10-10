-- =====================================================================
-- 邻里服务管家 —— 初始化参考数据（可重复执行）
--
-- ⚠️ 本脚本只写入「平台默认配置」类参考数据，**不写入任何虚构的业务数据**。
--    管理员账号由应用启动时的 DataInitializer 创建（密码取环境变量，
--    不落在 SQL 里，避免明文口令进 Git）。
-- =====================================================================

USE `neighborhood`;

-- ---------------------------------------------------------------------
-- 平台默认服务项目模板（provider_id = 0 表示平台模板）
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `service_items`
  (`provider_id`, `template_id`, `name`, `description`, `unit_desc`, `price_desc`,
   `form_fields`, `booking_rules`, `notes`, `sort_order`, `enabled`, `created_at`, `updated_at`, `deleted`)
VALUES
  (0, NULL, '上门代扔垃圾',
   '按预约时间上门收取生活垃圾并带至指定投放点。默认含普通生活垃圾，不含大件、装修垃圾、危险废弃物。',
   '次', '参考价 10~30 元/次，按数量与距离协商',
   '[{"key":"customerName","label":"客户称呼","type":"text","required":true,"maxLength":20,"placeholder":"如：张先生"},
     {"key":"customerPhone","label":"联系电话","type":"phone","required":true,"maxLength":11},
     {"key":"community","label":"所在小区","type":"text","required":true,"maxLength":60},
     {"key":"address","label":"详细服务地址","type":"textarea","required":true,"maxLength":200},
     {"key":"bookingDate","label":"预约日期","type":"date","required":true},
     {"key":"bookingSlot","label":"预约时间段","type":"slot","required":true},
     {"key":"serviceItemId","label":"服务项目","type":"serviceItem","required":true},
     {"key":"quantity","label":"服务数量","type":"number","required":true,"min":1,"max":20},
     {"key":"serviceDesc","label":"服务内容说明","type":"textarea","required":false,"maxLength":200},
     {"key":"remark","label":"特殊备注","type":"textarea","required":false,"maxLength":200}]',
   '{"advanceDays":7,"minAdvanceHours":2,"slots":["09:00-11:00","11:00-13:00","14:00-16:00","16:00-18:00"],"closedDays":[0,6]}',
   '不接收大件垃圾、装修垃圾、危险废弃物、液体及活体；请提前将垃圾装袋并放置在约定地点。',
   10, 1, NOW(), NOW(), 0),

  (0, NULL, '上门取件寄件',
   '按预约时间上门取件，可协助打包并送至代收点。',
   '件', '参考价 5 元/件，10 件以上可协商',
   '[{"key":"customerName","label":"客户称呼","type":"text","required":true,"maxLength":20},
     {"key":"customerPhone","label":"联系电话","type":"phone","required":true,"maxLength":11},
     {"key":"community","label":"所在小区","type":"text","required":true,"maxLength":60},
     {"key":"address","label":"详细服务地址","type":"textarea","required":true,"maxLength":200},
     {"key":"bookingDate","label":"预约日期","type":"date","required":true},
     {"key":"bookingSlot","label":"预约时间段","type":"slot","required":true},
     {"key":"serviceItemId","label":"服务项目","type":"serviceItem","required":true},
     {"key":"quantity","label":"取件数量","type":"number","required":true,"min":1,"max":50},
     {"key":"serviceDesc","label":"物品说明","type":"textarea","required":false,"maxLength":200}]',
   '{"advanceDays":7,"minAdvanceHours":2,"slots":["09:00-11:00","14:00-16:00","16:00-18:00"],"closedDays":[0,6]}',
   '仅协助取件与送达，不代为填写寄递单，不承运违禁物品。',
   20, 1, NOW(), NOW(), 0);

-- ---------------------------------------------------------------------
-- 系统基础设置
-- ---------------------------------------------------------------------
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `description`, `created_at`, `updated_at`, `deleted`)
VALUES
  ('platform.name',            '邻里服务管家', '平台名称',                    NOW(), NOW(), 0),
  ('platform.contact_phone',   '',             '平台客服电话（空则不展示）',  NOW(), NOW(), 0),
  ('order.auto_confirm',       'false',        '新预约是否自动确认（false=需服务者手动确认）', NOW(), NOW(), 0),
  ('booking.advance_days',     '7',            '最多可提前预约的天数',        NOW(), NOW(), 0),
  ('booking.min_advance_hours','2',            '最少提前预约小时数',          NOW(), NOW(), 0),
  ('page.default_size',        '20',           '分页默认每页条数',            NOW(), NOW(), 0),
  -- 合规占位：以下内容尚未核实，正式上线前必须人工确认后填写，程序不据此做「已合规」判断
  ('compliance.qualification_verified', 'false', '⚠️ 资质与平台类目审核是否已核实（未核实前保持 false）', NOW(), NOW(), 0);