package com.neighborhood.service.config;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.entity.AdminUser;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.AdminUserMapper;
import com.neighborhood.service.mapper.ServiceItemMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 首启动初始化。
 *
 * <p><b>为什么不在 SQL 里写管理员账号</b>：密码散列一旦写进 seed.sql 就等于把凭据提交进 Git。
 * 这里改为从环境变量读取，仅在管理员不存在时创建一次，并把随机密码打到启动日志里。</p>
 */
@Slf4j
@Order(1)
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final AdminUserMapper adminUserMapper;
    private final ServiceItemMapper serviceItemMapper;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.enabled:false}")
    private boolean bootstrapEnabled;

    @Value("${app.bootstrap.admin-username:admin}")
    private String adminUsername;

    @Value("${app.bootstrap.admin-password:}")
    private String adminPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensureDefaultAdmin();
        ensureServiceTemplates();
    }

    private void ensureDefaultAdmin() {
        Long exists = adminUserMapper.selectCount(
                Wrappers.<AdminUser>lambdaQuery().eq(AdminUser::getUsername, adminUsername));
        if (exists != null && exists > 0) {
            log.info("管理员账号已存在，跳过初始化: {}", adminUsername);
            return;
        }
        if (!bootstrapEnabled) {
            log.warn("未找到管理员账号 {}，且 app.bootstrap.enabled=false，请手动创建或配置 ADMIN_PASSWORD", adminUsername);
            return;
        }
        if (!StringUtils.hasText(adminPassword)) {
            log.error("未配置 ADMIN_PASSWORD，无法创建管理员账号 {}", adminUsername);
            return;
        }

        AdminUser admin = new AdminUser();
        admin.setUsername(adminUsername);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setRealName("平台管理员");
        admin.setStatus(EnabledStatus.ENABLED);
        adminUserMapper.insert(admin);

        log.warn("""
                ┌──────────────────────────────────────────────────────┐
                │ 已创建平台管理员账号: {}                              │
                │ 该账号密码来自环境变量 ADMIN_PASSWORD，仅此一次提示   │
                │ 生产环境请立即登录后台修改密码                        │
                └──────────────────────────────────────────────────────┘""", adminUsername);
    }

    /** 平台默认服务项目模板。sql/seed.sql 已插入时这里不会重复创建。 */
    private void ensureServiceTemplates() {
        Long exists = serviceItemMapper.selectCount(
                Wrappers.<ServiceItem>lambdaQuery()
                        .eq(ServiceItem::getProviderId, 0L)
                        .eq(ServiceItem::getName, "上门代扔垃圾"));
        if (exists != null && exists > 0) {
            return;
        }
        ServiceItem item = new ServiceItem();
        item.setProviderId(0L);
        item.setName("上门代扔垃圾");
        item.setDescription("按预约时间上门收取生活垃圾并带至指定投放点。不含大件、装修垃圾、危险废弃物。");
        item.setUnitDesc("次");
        item.setPriceDesc("参考价 10~30 元/次，按数量与距离协商");
        item.setFormFields("""
                [{"key":"customerName","label":"客户称呼","type":"text","required":true,"maxLength":20},
                 {"key":"customerPhone","label":"联系电话","type":"phone","required":true,"maxLength":11},
                 {"key":"community","label":"所在小区","type":"text","required":true,"maxLength":60},
                 {"key":"address","label":"详细服务地址","type":"textarea","required":true,"maxLength":200},
                 {"key":"bookingDate","label":"预约日期","type":"date","required":true},
                 {"key":"bookingSlot","label":"预约时间段","type":"slot","required":true},
                 {"key":"quantity","label":"服务数量","type":"number","required":true,"min":1,"max":20},
                 {"key":"remark","label":"特殊备注","type":"textarea","required":false,"maxLength":200}]""");
        item.setBookingRules("""
                {"advanceDays":7,"minAdvanceHours":2,
                 "slots":["09:00-11:00","11:00-13:00","14:00-16:00","16:00-18:00"],
                 "closedDays":[0,6]}""");
        item.setNotes("不接收大件垃圾、装修垃圾、危险废弃物、液体及活体；请提前将垃圾装袋并放置在约定地点。");
        item.setSortOrder(10);
        item.setEnabled(EnabledStatus.ENABLED);
        serviceItemMapper.insert(item);

        log.info("已创建平台默认服务项目模板: {}", item.getName());
    }
}