package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.PageResult;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.OrderDto;
import com.neighborhood.service.entity.Customer;
import com.neighborhood.service.entity.Order;
import com.neighborhood.service.entity.OrderLog;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.enums.OrderAction;
import com.neighborhood.service.enums.OrderSource;
import com.neighborhood.service.enums.OrderStatus;
import com.neighborhood.service.enums.OperatorType;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OrderLogMapper;
import com.neighborhood.service.mapper.OrderMapper;
import com.neighborhood.service.mapper.ServiceItemMapper;
import com.neighborhood.service.security.AuthPrincipal;
import com.neighborhood.service.security.DataScope;
import com.neighborhood.service.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * 服务者端订单服务。
 *
 * <p>三条硬规则，缺一不可：
 * <ol>
 *   <li><b>归属来自 token</b>：providerId 一律取 {@link SecurityUtils#requireProviderId()}，
 *       绝不接受参数传入；</li>
 *   <li><b>按 id 操作必校验归属</b>：详情/更新/删除都先查后比对，越权与不存在返回同一错误；</li>
 *   <li><b>状态流转原子化</b>：UPDATE 语句自带 {@code status = 当前状态} 条件，
 *       并发双击「确认」只有一次会成功，不会出现两笔重复流转。</li>
 * </ol>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final DateTimeFormatter ORDER_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final OrderMapper orderMapper;
    private final OrderLogMapper orderLogMapper;
    private final CustomerMapper customerMapper;
    private final ServiceItemMapper serviceItemMapper;

    // ==================================================================
    // 今日工作台账
    // ==================================================================

    /**
     * 按日期查看工作台账。支持切换到明天及未来日期。
     *
     * <p>统计与列表在同一次查询口径下产生，避免「数字和列表对不上」。</p>
     */
    public OrderDto.BoardVO board(LocalDate date) {
        Long providerId = DataScope.currentProviderId();
        LocalDate target = date == null ? LocalDate.now() : date;

        List<Order> orders = orderMapper.selectList(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId)
                .eq(Order::getBookingDate, target)
                .orderByAsc(Order::getBookingSlot)
                .orderByAsc(Order::getId));

        OrderDto.BoardVO vo = new OrderDto.BoardVO();
        vo.setDate(target);
        vo.setTotalCount(orders.size());
        vo.setPendingConfirmCount(countStatus(orders, OrderStatus.PENDING_CONFIRM));
        vo.setPendingServiceCount(countStatus(orders, OrderStatus.CONFIRMED) + countStatus(orders, OrderStatus.SERVING));
        vo.setCompletedCount(countStatus(orders, OrderStatus.COMPLETED));
        vo.setCancelledCount(countStatus(orders, OrderStatus.CANCELLED));
        vo.setTasks(orders.stream().map(this::toVO).toList());
        return vo;
    }

    private int countStatus(List<Order> orders, OrderStatus status) {
        return (int) orders.stream().filter(o -> o.getStatus() == status).count();
    }

    // ==================================================================
    // 列表 / 详情
    // ==================================================================

    public PageResult<OrderDto.OrderVO> page(OrderDto.OrderQuery query) {
        Long providerId = DataScope.currentProviderId();

        LambdaQueryWrapper<Order> w = Wrappers.<Order>lambdaQuery()
                // 数据隔离第一道：查询条件强制带上 provider_id
                .eq(Order::getProviderId, providerId);

        if (query.getDateFrom() != null) {
            w.ge(Order::getBookingDate, query.getDateFrom());
        }
        if (query.getDateTo() != null) {
            w.le(Order::getBookingDate, query.getDateTo());
        }
        if (StringUtils.hasText(query.getStatus())) {
            try {
                w.eq(Order::getStatus, OrderStatus.fromCode(query.getStatus()));
            } catch (BizException e) {
                throw e;
            }
        }
        if (query.getServiceItemId() != null) {
            w.eq(Order::getServiceItemId, query.getServiceItemId());
        }
        if (StringUtils.hasText(query.getKeyword())) {
            String kw = query.getKeyword().trim();
            w.and(x -> x.like(Order::getCustomerName, kw).or().like(Order::getCustomerPhone, kw));
        }

        w.orderByDesc(Order::getBookingDate).orderByDesc(Order::getId);

        int pageNum = query.getPage() == null || query.getPage() < 1 ? 1 : query.getPage();
        int size = query.getSize() == null || query.getSize() < 1 ? 20 : Math.min(query.getSize(), 100);

        Page<Order> page = orderMapper.selectPage(new Page<>(pageNum, size), w);
        return PageResult.of(page, this::toVO);
    }

    /**
     * 订单详情。**先按 id 查，再校验归属**——
     * 只用 provider_id 做查询条件会让「不存在的 id」和「别人的 id」返回不同的响应，可被用来探测。
     */
    public OrderDto.OrderVO detail(Long orderId) {
        Long providerId = DataScope.currentProviderId();
        Order order = requireOwned(orderId, providerId);

        OrderDto.OrderVO vo = toVO(order);
        vo.setLogs(orderLogMapper.selectList(Wrappers.<OrderLog>lambdaQuery()
                        .eq(OrderLog::getOrderId, order.getId())
                        .orderByAsc(OrderLog::getId))
                .stream().map(this::logToVO).toList());
        return vo;
    }

    private Order requireOwned(Long orderId, Long providerId) {
        if (orderId == null) {
            throw BizException.of(ResultCode.ORDER_NOT_FOUND);
        }
        Order order = orderMapper.selectById(orderId);
        // 数据隔离第二道：归属不匹配或不存在，抛同一个错误
        DataScope.assertOwnedByQuery(order == null ? null : order.getProviderId());
        return order;
    }

    // ==================================================================
    // 状态流转
    // ==================================================================

    public OrderDto.OrderVO confirm(Long orderId, OrderDto.StatusChangeRequest req) {
        return transit(orderId, OrderStatus.CONFIRMED, OrderAction.CONFIRM,
                req == null ? null : req.getRemark(), "confirmed_at", LocalDateTime.now());
    }

    public OrderDto.OrderVO start(Long orderId, OrderDto.StatusChangeRequest req) {
        return transit(orderId, OrderStatus.SERVING, OrderAction.START,
                req == null ? null : req.getRemark(), "started_at", LocalDateTime.now());
    }

    public OrderDto.OrderVO complete(Long orderId, OrderDto.StatusChangeRequest req) {
        return transit(orderId, OrderStatus.COMPLETED, OrderAction.COMPLETE,
                req == null ? null : req.getRemark(), "completed_at", LocalDateTime.now());
    }

    /**
     * 统一状态流转。
     *
     * <p>UPDATE 语句带 {@code status = fromStatus} 条件实现乐观锁：
     * 并发提交只有一条会更新成功，另一条 affectedRows=0 → 判为状态已变更。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public OrderDto.OrderVO transit(Long orderId, OrderStatus target, OrderAction action,
                                    String remark, String timeColumn, LocalDateTime now) {
        Long providerId = DataScope.currentProviderId();
        Order order = requireOwned(orderId, providerId);
        OrderStatus from = order.getStatus();

        // 状态机校验（非法流转直接拒绝，不给前端「先改再说」的机会）
        OrderStatus.assertCanTransitTo(from, target);

        UpdateWrapper<Order> uw = new UpdateWrapper<>();
        uw.eq("id", orderId)
                .eq("provider_id", providerId)
                .eq("status", from.getCode())
                .set("status", target.getCode())
                .set(timeColumn, now);
        if (OrderStatus.CANCELLED == target) {
            uw.set("cancel_reason", remark).set("cancelled_at", now);
        }
        int affected = orderMapper.update(null, uw);
        if (affected == 0) {
            throw BizException.of(ResultCode.ORDER_STATUS_ILLEGAL, "订单状态已被更新，请刷新后重试");
        }

        AuthPrincipal principal = SecurityUtils.getPrincipal();
        OrderLog orderLog = new OrderLog();
        orderLog.setOrderId(orderId);
        orderLog.setProviderId(providerId);
        orderLog.setAction(action);
        orderLog.setFromStatus(from);
        orderLog.setToStatus(target);
        orderLog.setRemark(remark);
        orderLog.setOperatorType(OperatorType.PROVIDER);
        orderLog.setOperatorId(principal == null ? null : principal.getUserId());
        orderLog.setOperatorName(SecurityUtils.currentOperatorName());
        orderLogMapper.insert(orderLog);

        if (target == OrderStatus.COMPLETED) {
            touchCustomerAfterComplete(order);
        }

        log.info("订单 {} 状态 {} -> {}，操作人 {}", order.getOrderNo(), from.getCode(), target.getCode(),
                SecurityUtils.currentOperatorName());
        return detail(orderId);
    }

    public OrderDto.OrderVO cancel(Long orderId, OrderDto.CancelRequest req) {
        return transit(orderId, OrderStatus.CANCELLED, OrderAction.CANCEL, req.getReason(),
                "cancelled_at", LocalDateTime.now());
    }

    private void touchCustomerAfterComplete(Order order) {
        if (order.getCustomerId() == null) {
            return;
        }
        Customer customer = customerMapper.selectById(order.getCustomerId());
        if (customer == null) {
            return;
        }
        Customer update = new Customer();
        update.setId(customer.getId());
        update.setLastServiceAt(LocalDateTime.now());
        // 简单复购提示：下次服务时间默认设为 7 天后，服务者可自行调整
        update.setNextServiceAt(LocalDateTime.now().plusDays(7));
        customerMapper.updateById(update);
    }

    public OrderDto.OrderVO updateNote(Long orderId, OrderDto.NoteUpdateRequest req) {
        Long providerId = DataScope.currentProviderId();
        Order order = requireOwned(orderId, providerId);
        if (order.getStatus().isFinal()) {
            throw BizException.of(ResultCode.ORDER_STATUS_ILLEGAL, "已结束的订单不能再修改备注");
        }
        Order update = new Order();
        update.setId(orderId);
        update.setProviderNote(req.getProviderNote());
        orderMapper.updateById(update);

        OrderLog noteLog = new OrderLog();
        noteLog.setOrderId(orderId);
        noteLog.setProviderId(providerId);
        noteLog.setAction(OrderAction.UPDATE_NOTE);
        noteLog.setFromStatus(order.getStatus());
        noteLog.setToStatus(order.getStatus());
        noteLog.setRemark(req.getProviderNote());
        noteLog.setOperatorType(OperatorType.PROVIDER);
        noteLog.setOperatorName(SecurityUtils.currentOperatorName());
        orderLogMapper.insert(noteLog);

        return detail(orderId);
    }

    // ==================================================================
    // 手动记单
    // ==================================================================

    /** 电话 / 微信 / 线下沟通产生的预约统一录入系统。 */
    @Transactional(rollbackFor = Exception.class)
    public OrderDto.OrderVO createManual(Long providerId, OrderDto.ManualOrderRequest req) {
        DataScope.assertOwnedByQuery(providerId);

        LocalDate bookingDate = req.getBookingDate() == null ? LocalDate.now() : req.getBookingDate();

        String serviceName = req.getServiceName();
        Long serviceItemId = req.getServiceItemId();
        if (serviceItemId != null) {
            ServiceItem item = serviceItemMapper.selectById(serviceItemId);
            if (item == null) {
                throw BizException.of(ResultCode.SERVICE_ITEM_NOT_FOUND);
            }
            if (item.getProviderId() != 0L && !item.getProviderId().equals(providerId)) {
                throw BizException.accessDenied();
            }
            serviceName = item.getName();
        }
        if (!StringUtils.hasText(serviceName)) {
            throw BizException.of(ResultCode.PARAM_ERROR, "请填写服务项目名称");
        }

        // 客户归并
        Customer customer = customerMapper.selectOne(Wrappers.<Customer>lambdaQuery()
                .eq(Customer::getProviderId, providerId)
                .eq(Customer::getPhone, req.getCustomerPhone())
                .last("LIMIT 1"));
        if (customer == null) {
            customer = new Customer();
            customer.setProviderId(providerId);
            customer.setName(req.getCustomerName());
            customer.setPhone(req.getCustomerPhone());
            customer.setCommunity(req.getCommunity());
            customer.setAddress(req.getAddress());
            customer.setOrderCount(0);
            customerMapper.insert(customer);
        }

        boolean confirmed = Boolean.TRUE.equals(req.getConfirmed());
        Order order = new Order();
        order.setOrderNo(generateOrderNo());
        order.setProviderId(providerId);
        order.setCustomerId(customer.getId());
        order.setReferralCodeId(null);
        order.setServiceItemId(serviceItemId);
        order.setServiceName(serviceName);
        order.setCustomerName(req.getCustomerName());
        order.setCustomerPhone(req.getCustomerPhone());
        order.setCommunity(req.getCommunity());
        order.setAddress(req.getAddress());
        order.setBookingDate(bookingDate);
        order.setBookingSlot(req.getBookingSlot());
        order.setQuantity(req.getQuantity() == null ? 1 : req.getQuantity());
        order.setServiceDesc(req.getServiceDesc());
        order.setCustomerRemark(req.getCustomerRemark());
        order.setStatus(confirmed ? OrderStatus.CONFIRMED : OrderStatus.PENDING_CONFIRM);
        order.setSource(OrderSource.MANUAL);
        order.setChannel("MANUAL");
        if (confirmed) {
            order.setConfirmedAt(LocalDateTime.now());
        }
        orderMapper.insert(order);

        OrderLog createLog = new OrderLog();
        createLog.setOrderId(order.getId());
        createLog.setProviderId(providerId);
        createLog.setAction(OrderAction.CREATE);
        createLog.setFromStatus(null);
        createLog.setToStatus(order.getStatus());
        createLog.setRemark("服务者手动创建");
        createLog.setOperatorType(OperatorType.PROVIDER);
        createLog.setOperatorName(SecurityUtils.currentOperatorName());
        orderLogMapper.insert(createLog);

        Customer cu = new Customer();
        cu.setId(customer.getId());
        cu.setOrderCount((customer.getOrderCount() == null ? 0 : customer.getOrderCount()) + 1);
        if (customer.getFirstServiceAt() == null) {
            cu.setFirstServiceAt(bookingDate.atStartOfDay());
        }
        cu.setLastServiceAt(bookingDate.atStartOfDay());
        customerMapper.updateById(cu);

        return detail(order.getId());
    }

    private String generateOrderNo() {
        return "NB" + LocalDateTime.now().format(ORDER_NO_FORMAT)
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    // ==================================================================
    // VO 装配
    // ==================================================================

    public OrderDto.OrderVO toVO(Order o) {
        OrderDto.OrderVO vo = new OrderDto.OrderVO();
        vo.setId(o.getId());
        vo.setOrderNo(o.getOrderNo());
        vo.setCustomerId(o.getCustomerId());
        vo.setCustomerName(o.getCustomerName());
        vo.setCustomerPhone(o.getCustomerPhone());
        vo.setCommunity(o.getCommunity());
        vo.setAddress(o.getAddress());
        vo.setServiceName(o.getServiceName());
        vo.setQuantity(o.getQuantity());
        vo.setServiceDesc(o.getServiceDesc());
        vo.setCustomerRemark(o.getCustomerRemark());
        vo.setProviderNote(o.getProviderNote());
        vo.setBookingDate(o.getBookingDate());
        vo.setBookingSlot(o.getBookingSlot());
        vo.setStatus(o.getStatus() == null ? null : o.getStatus().getCode());
        vo.setStatusLabel(o.getStatus() == null ? null : o.getStatus().getLabel());
        vo.setSource(o.getSource() == null ? null : o.getSource().getCode());
        vo.setChannel(o.getChannel());
        vo.setCancelReason(o.getCancelReason());
        vo.setConfirmedAt(o.getConfirmedAt());
        vo.setStartedAt(o.getStartedAt());
        vo.setCompletedAt(o.getCompletedAt());
        vo.setCreatedAt(o.getCreatedAt());
        return vo;
    }

    private OrderDto.OrderLogVO logToVO(OrderLog l) {
        OrderDto.OrderLogVO vo = new OrderDto.OrderLogVO();
        vo.setAction(l.getAction() == null ? null : l.getAction().getCode());
        vo.setActionLabel(l.getAction() == null ? null : l.getAction().getLabel());
        vo.setFromStatus(l.getFromStatus() == null ? null : l.getFromStatus().getCode());
        vo.setToStatus(l.getToStatus() == null ? null : l.getToStatus().getCode());
        vo.setRemark(l.getRemark());
        vo.setOperatorType(l.getOperatorType() == null ? null : l.getOperatorType().getCode());
        vo.setOperatorName(l.getOperatorName());
        vo.setCreatedAt(l.getCreatedAt());
        return vo;
    }
}
