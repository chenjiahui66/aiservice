package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.PageResult;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.AdminDto;
import com.neighborhood.service.dto.OrderDto;
import com.neighborhood.service.entity.Complaint;
import com.neighborhood.service.entity.OperationLog;
import com.neighborhood.service.entity.Order;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.entity.ServicePage;
import com.neighborhood.service.entity.SystemSetting;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.enums.AuditStatus;
import com.neighborhood.service.enums.ComplaintStatus;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.enums.OrderStatus;
import com.neighborhood.service.mapper.ComplaintMapper;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OperationLogMapper;
import com.neighborhood.service.mapper.OrderMapper;
import com.neighborhood.service.mapper.ProviderMapper;
import com.neighborhood.service.mapper.ServiceItemMapper;
import com.neighborhood.service.mapper.ServicePageMapper;
import com.neighborhood.service.mapper.SystemSettingMapper;
import com.neighborhood.service.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 平台管理端服务。
 *
 * <p>边界要求：管理员「不能通过普通业务页面随意修改服务者的业务记录」。
 * 因此本服务只提供<b>审核、启停、配置、查询</b>四类能力，
 * 不提供任何修改 orders / customers 业务字段的入口。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final ProviderMapper providerMapper;
    private final UserMapper userMapper;
    private final OrderMapper orderMapper;
    private final CustomerMapper customerMapper;
    private final ServiceItemMapper serviceItemMapper;
    private final ServicePageMapper servicePageMapper;
    private final ComplaintMapper complaintMapper;
    private final OperationLogMapper operationLogMapper;
    private final SystemSettingMapper systemSettingMapper;
    private final ReferralCodeService referralCodeService;
    private final OrderService orderService;

    // ==================================================================
    // 概览：全部来自真实 count 查询
    // ==================================================================

    public AdminDto.DashboardVO dashboard() {
        AdminDto.DashboardVO vo = new AdminDto.DashboardVO();

        vo.setTotalProviders(providerMapper.selectCount(null));
        vo.setPendingAuditProviders(countProviders(AuditStatus.PENDING, null));
        vo.setApprovedProviders(countProviders(AuditStatus.APPROVED, null));
        vo.setDisabledProviders(countProviders(null, EnabledStatus.DISABLED));
        vo.setTotalUsers(userMapper.selectCount(null));

        vo.setTotalOrders(orderMapper.selectCount(null));
        vo.setPendingConfirmOrders(countOrders(OrderStatus.PENDING_CONFIRM));
        vo.setServingOrders(countOrders(OrderStatus.SERVING));
        vo.setCompletedOrders(countOrders(OrderStatus.COMPLETED));
        vo.setCancelledOrders(countOrders(OrderStatus.CANCELLED));
        vo.setTotalCustomers(customerMapper.selectCount(null));
        vo.setPendingComplaints(complaintMapper.selectCount(Wrappers.<Complaint>lambdaQuery()
                .eq(Complaint::getStatus, ComplaintStatus.PENDING)));
        vo.setTotalVisits(totalVisits());

        // 近 7 日订单趋势
        List<AdminDto.TrendPoint> trend = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusDays(i);
            long count = orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                    .eq(Order::getBookingDate, d));
            AdminDto.TrendPoint p = new AdminDto.TrendPoint();
            p.setDate(d.toString());
            p.setCount(count);
            trend.add(p);
        }
        vo.setOrderTrend(trend);
        return vo;
    }

    private long totalVisits() {
        List<Provider> providers = providerMapper.selectList(null);
        long sum = 0;
        for (Provider p : providers) {
            sum += referralCodeService.totalVisits(p.getId());
        }
        return sum;
    }

    private long countProviders(AuditStatus audit, EnabledStatus enabled) {
        return providerMapper.selectCount(Wrappers.<Provider>lambdaQuery()
                .eq(audit != null, Provider::getAuditStatus, audit)
                .eq(enabled != null, Provider::getEnabled, enabled));
    }

    private long countOrders(OrderStatus status) {
        return orderMapper.selectCount(Wrappers.<Order>lambdaQuery().eq(Order::getStatus, status));
    }

    // ==================================================================
    // 服务者管理
    // ==================================================================

    public PageResult<AdminDto.ProviderListVO> providers(AdminDto.ProviderQuery query) {
        LambdaQueryWrapper<Provider> w = Wrappers.<Provider>lambdaQuery();
        if (StringUtils.hasText(query.getKeyword())) {
            String kw = query.getKeyword().trim();
            w.and(x -> x.like(Provider::getRealName, kw).or().like(Provider::getServiceArea, kw));
        }
        if (StringUtils.hasText(query.getAuditStatus())) {
            w.eq(Provider::getAuditStatus, AuditStatus.valueOf(query.getAuditStatus()));
        }
        if (StringUtils.hasText(query.getEnabled())) {
            w.eq(Provider::getEnabled, EnabledStatus.valueOf(query.getEnabled()));
        }
        w.orderByDesc(Provider::getId);

        int pageNum = query.getPage() == null || query.getPage() < 1 ? 1 : query.getPage();
        int size = query.getSize() == null || query.getSize() < 1 ? 20 : Math.min(query.getSize(), 100);

        Page<Provider> page = providerMapper.selectPage(new Page<>(pageNum, size), w);
        return PageResult.of(page, this::toProviderListVO);
    }

    private AdminDto.ProviderListVO toProviderListVO(Provider p) {
        AdminDto.ProviderListVO vo = new AdminDto.ProviderListVO();
        vo.setId(p.getId());
        vo.setUserId(p.getUserId());
        vo.setRealName(p.getRealName());
        vo.setServiceArea(p.getServiceArea());
        vo.setAuditStatus(p.getAuditStatus() == null ? null : p.getAuditStatus().name());
        vo.setAuditStatusLabel(p.getAuditStatus() == null ? null : p.getAuditStatus().getLabel());
        vo.setEnabled(p.getEnabled() == null ? null : p.getEnabled().name());
        ServicePage page = findServicePage(p.getId());
        vo.setPageEnabled(page != null && page.getEnabled() == EnabledStatus.ENABLED);
        vo.setOrderCount(orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, p.getId())));
        vo.setCustomerCount(customerMapper.selectCount(Wrappers.<com.neighborhood.service.entity.Customer>lambdaQuery()
                .eq(com.neighborhood.service.entity.Customer::getProviderId, p.getId())));
        User u = userMapper.selectById(p.getUserId());
        vo.setPhone(u == null ? null : u.getPhone());
        // 协议同意状态：留证要有人能看得到，否则出了争议只能去翻库
        vo.setConsentAt(u == null ? null : u.getConsentAt());
        vo.setPolicyVersion(u == null ? null : u.getPolicyVersion());
        var ref = referralCodeService.findByProviderId(p.getId());
        vo.setReferralCode(ref == null ? null : ref.getReferralCode());
        vo.setCreatedAt(p.getCreatedAt());
        vo.setAuditedAt(p.getAuditedAt());
        return vo;
    }

    /** 服务者审核详情（含其服务项目与推广码）。 */
    public AdminDto.ProviderListVO providerDetail(Long providerId) {
        Provider p = providerMapper.selectById(providerId);
        if (p == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        return toProviderListVO(p);
    }

    /**
     * 审核服务者。
     *
     * <p>审核通过代表平台已允许该服务者对外提供服务，因此会顺带开启其服务主页：
     * 客户扫码走的是推广码，推广码在注册时就已分配，如果主页仍是关闭状态，
     * 客户扫到的只会是 41008「该服务主页已关闭」，而服务者自己往往不知道要去开这个开关。</p>
     *
     * <p>服务者平时自己关掉主页（「暂时不干了」）不受影响 —— 管理员不点审核，主页就保持他关的状态；
     * 只有管理员主动点「审核通过」时才重新打开。管理后台「服务者状态管理」页另有主页开关可随时调整。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public AdminDto.ProviderListVO audit(Long providerId, AdminDto.AuditRequest req) {
        Provider p = providerMapper.selectById(providerId);
        if (p == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }

        AuditStatus target = Boolean.TRUE.equals(req.getApproved()) ? AuditStatus.APPROVED : AuditStatus.REJECTED;
        Provider update = new Provider();
        update.setId(providerId);
        update.setAuditStatus(target);
        update.setAuditRemark(req.getRemark());
        update.setAuditedBy(com.neighborhood.service.security.SecurityUtils.requireAdminId());
        update.setAuditedAt(LocalDateTime.now());
        if (req.getToggleEnabled() != null) {
            update.setEnabled(req.getToggleEnabled() ? EnabledStatus.ENABLED : EnabledStatus.DISABLED);
        }
        providerMapper.updateById(update);

        if (target == AuditStatus.APPROVED) {
            enableHomepageIfClosed(providerId);
        }

        log.info("管理员审核服务者 {} -> {}，意见：{}", providerId, target, req.getRemark());
        return toProviderListVO(providerMapper.selectById(providerId));
    }

    /** 查服务者的主页记录；没有主页记录返回 null。 */
    private ServicePage findServicePage(Long providerId) {
        return servicePageMapper.selectOne(Wrappers.<ServicePage>lambdaQuery()
                .eq(ServicePage::getProviderId, providerId)
                .last("LIMIT 1"));
    }

    /** 开启服务主页；主页不存在或本来就开着则不动。 */
    private void enableHomepageIfClosed(Long providerId) {
        ServicePage page = findServicePage(providerId);
        if (page == null || page.getEnabled() == EnabledStatus.ENABLED) {
            return;
        }
        ServicePage update = new ServicePage();
        update.setId(page.getId());
        update.setEnabled(EnabledStatus.ENABLED);
        servicePageMapper.updateById(update);
        log.info("审核通过，服务者 {} 的主页已自动开启", providerId);
    }

    /** 启用 / 停用服务者。停用后其推广码将无法再被客户访问与下单。 */
    @Transactional(rollbackFor = Exception.class)
    public AdminDto.ProviderListVO toggleProvider(Long providerId, AdminDto.StatusRequest req) {
        Provider p = providerMapper.selectById(providerId);
        if (p == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        Provider update = new Provider();
        update.setId(providerId);
        update.setEnabled(Boolean.TRUE.equals(req.getEnabled()) ? EnabledStatus.ENABLED : EnabledStatus.DISABLED);
        update.setAuditRemark(req.getReason());
        providerMapper.updateById(update);

        // 账号级同步禁用，避免「后台停了但还能登录」的漏洞
        if (Boolean.FALSE.equals(req.getEnabled())) {
            User u = new User();
            u.setId(p.getUserId());
            u.setStatus(EnabledStatus.DISABLED);
            userMapper.updateById(u);
        } else {
            User u = new User();
            u.setId(p.getUserId());
            u.setStatus(EnabledStatus.ENABLED);
            userMapper.updateById(u);
        }
        return toProviderListVO(providerMapper.selectById(providerId));
    }

    /**
     * 开启 / 关闭服务主页。
     *
     * <p>主页开关决定客户扫码能不能看到内容：关闭时客户扫推广码只会拿到
     * 41008「该服务主页已关闭」。正常情况下服务者自己在小程序里控制这个开关，
     * 这里给管理员留一个兜底入口，用来处理「服务者自己没开」或「服务者联系不上了」的情况。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public AdminDto.ProviderListVO toggleHomepage(Long providerId, AdminDto.PageRequest req) {
        Provider p = providerMapper.selectById(providerId);
        if (p == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        ServicePage page = findServicePage(providerId);
        if (page == null) {
            throw BizException.of(ResultCode.SYSTEM_ERROR, "该服务者尚未初始化服务主页");
        }
        boolean enable = Boolean.TRUE.equals(req.getEnabled());
        if (page.getEnabled() != (enable ? EnabledStatus.ENABLED : EnabledStatus.DISABLED)) {
            ServicePage update = new ServicePage();
            update.setId(page.getId());
            update.setEnabled(enable ? EnabledStatus.ENABLED : EnabledStatus.DISABLED);
            servicePageMapper.updateById(update);
            log.info("管理员{}服务者 {} 的服务主页", enable ? "开启" : "关闭", providerId);
        }
        return toProviderListVO(providerMapper.selectById(providerId));
    }

    // ==================================================================
    // 服务项目（平台模板）
    // ==================================================================

    public List<AdminDto.ServiceItemVO> serviceItems() {
        return serviceItemMapper.selectList(Wrappers.<ServiceItem>lambdaQuery()
                        .eq(ServiceItem::getProviderId, 0L)
                        .orderByAsc(ServiceItem::getSortOrder))
                .stream().map(this::toItemVO).toList();
    }

    private AdminDto.ServiceItemVO toItemVO(ServiceItem i) {
        AdminDto.ServiceItemVO vo = new AdminDto.ServiceItemVO();
        vo.setId(i.getId());
        vo.setTemplateId(i.getTemplateId());
        vo.setName(i.getName());
        vo.setDescription(i.getDescription());
        vo.setIconUrl(i.getIconUrl());
        vo.setUnitDesc(i.getUnitDesc());
        vo.setPriceDesc(i.getPriceDesc());
        vo.setFormFields(i.getFormFields());
        vo.setBookingRules(i.getBookingRules());
        vo.setNotes(i.getNotes());
        vo.setSortOrder(i.getSortOrder());
        vo.setEnabled(i.getEnabled() == null ? null : i.getEnabled().name());
        return vo;
    }

    public AdminDto.ServiceItemVO saveServiceItem(Long id, AdminDto.ServiceItemSaveRequest req) {
        ServiceItem item = id == null ? new ServiceItem() : serviceItemMapper.selectById(id);
        if (item == null) {
            throw BizException.of(ResultCode.SERVICE_ITEM_NOT_FOUND);
        }
        if (id == null) {
            item.setProviderId(0L);
        }
        item.setName(req.getName());
        item.setDescription(req.getDescription());
        item.setIconUrl(req.getIconUrl());
        item.setUnitDesc(req.getUnitDesc());
        item.setPriceDesc(req.getPriceDesc());
        item.setFormFields(req.getFormFields());
        item.setBookingRules(req.getBookingRules());
        item.setNotes(req.getNotes());
        if (req.getSortOrder() != null) {
            item.setSortOrder(req.getSortOrder());
        }
        if (req.getEnabled() != null) {
            item.setEnabled(req.getEnabled() ? EnabledStatus.ENABLED : EnabledStatus.DISABLED);
        }
        if (id == null) {
            serviceItemMapper.insert(item);
        } else {
            serviceItemMapper.updateById(item);
        }
        return toItemVO(serviceItemMapper.selectById(item.getId()));
    }

    // ==================================================================
    // 全平台订单查询（只读）
    // ==================================================================

    public PageResult<OrderDto.OrderVO> allOrders(OrderDto.OrderQuery query, String keyword) {
        LambdaQueryWrapper<Order> w = Wrappers.<Order>lambdaQuery();
        if (query.getDateFrom() != null) {
            w.ge(Order::getBookingDate, query.getDateFrom());
        }
        if (query.getDateTo() != null) {
            w.le(Order::getBookingDate, query.getDateTo());
        }
        if (StringUtils.hasText(query.getStatus())) {
            w.eq(Order::getStatus, OrderStatus.fromCode(query.getStatus()));
        }
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            w.and(x -> x.like(Order::getCustomerName, kw)
                    .or().like(Order::getCustomerPhone, kw)
                    .or().like(Order::getOrderNo, kw));
        }
        w.orderByDesc(Order::getId);

        int pageNum = query.getPage() == null || query.getPage() < 1 ? 1 : query.getPage();
        int size = query.getSize() == null || query.getSize() < 1 ? 20 : Math.min(query.getSize(), 100);

        Page<Order> page = orderMapper.selectPage(new Page<>(pageNum, size), w);
        return PageResult.of(page, orderService::toVO);
    }

    // ==================================================================
    // 投诉 / 反馈 / 违规
    // ==================================================================

    public PageResult<Map<String, Object>> complaints(String status, int pageNum, int size) {
        LambdaQueryWrapper<Complaint> w = Wrappers.<Complaint>lambdaQuery();
        if (StringUtils.hasText(status)) {
            w.eq(Complaint::getStatus, ComplaintStatus.valueOf(status));
        }
        w.orderByDesc(Complaint::getId);
        Page<Complaint> page = complaintMapper.selectPage(new Page<>(Math.max(1, pageNum), Math.min(Math.max(1, size), 100)), w);
        return PageResult.of(page, c -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", c.getId());
            m.put("providerId", c.getProviderId());
            m.put("orderId", c.getOrderId());
            m.put("customerName", c.getCustomerName());
            m.put("customerPhone", c.getCustomerPhone());
            m.put("type", c.getType() == null ? null : c.getType().name());
            m.put("content", c.getContent());
            m.put("status", c.getStatus() == null ? null : c.getStatus().name());
            m.put("handleRemark", c.getHandleRemark());
            m.put("createdAt", c.getCreatedAt());
            return m;
        });
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> handleComplaint(Long id, ComplaintStatus status, String remark) {
        Complaint c = complaintMapper.selectById(id);
        if (c == null) {
            throw BizException.of(ResultCode.NOT_FOUND, "记录不存在");
        }
        Complaint update = new Complaint();
        update.setId(id);
        update.setStatus(status);
        update.setHandleRemark(remark);
        update.setHandledBy(com.neighborhood.service.security.SecurityUtils.requireAdminId());
        update.setHandledAt(LocalDateTime.now());
        // 状态条件保护，避免两名管理员并发处理同一条
        UpdateWrapper<Complaint> uw = new UpdateWrapper<>();
        uw.eq("id", id).eq("status", c.getStatus().name())
                .set("status", status.name())
                .set("handle_remark", remark)
                .set("handled_by", update.getHandledBy())
                .set("handled_at", update.getHandledAt());
        complaintMapper.update(null, uw);
        return Map.of("id", id, "status", status.name());
    }

    // ==================================================================
    // 操作日志 / 系统设置
    // ==================================================================

    public PageResult<AdminDto.OperationLogVO> operationLogs(int pageNum, int size) {
        Page<OperationLog> page = operationLogMapper.selectPage(
                new Page<>(Math.max(1, pageNum), Math.min(Math.max(1, size), 100)),
                Wrappers.<OperationLog>lambdaQuery().orderByDesc(OperationLog::getId));
        return PageResult.of(page, l -> {
            AdminDto.OperationLogVO vo = new AdminDto.OperationLogVO();
            vo.setId(l.getId());
            vo.setOperatorType(l.getOperatorType() == null ? null : l.getOperatorType().name());
            vo.setOperatorName(l.getOperatorName());
            vo.setModule(l.getModule());
            vo.setAction(l.getAction());
            vo.setTargetId(l.getTargetId());
            vo.setDetail(l.getDetail());
            vo.setIp(l.getIp());
            vo.setCreatedAt(l.getCreatedAt());
            return vo;
        });
    }

    public List<SystemSetting> settings() {
        return systemSettingMapper.selectList(Wrappers.<SystemSetting>lambdaQuery()
                .orderByAsc(SystemSetting::getSettingKey));
    }

    public SystemSetting saveSetting(String key, String value) {
        SystemSetting s = systemSettingMapper.selectOne(Wrappers.<SystemSetting>lambdaQuery()
                .eq(SystemSetting::getSettingKey, key).last("LIMIT 1"));
        if (s == null) {
            s = new SystemSetting();
            s.setSettingKey(key);
            s.setSettingValue(value);
            systemSettingMapper.insert(s);
        } else {
            SystemSetting update = new SystemSetting();
            update.setId(s.getId());
            update.setSettingValue(value);
            systemSettingMapper.updateById(update);
        }
        return systemSettingMapper.selectOne(Wrappers.<SystemSetting>lambdaQuery()
                .eq(SystemSetting::getSettingKey, key).last("LIMIT 1"));
    }
}
