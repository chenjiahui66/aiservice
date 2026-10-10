package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.PublicDto;
import com.neighborhood.service.entity.Customer;
import com.neighborhood.service.entity.Order;
import com.neighborhood.service.entity.OrderLog;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ReferralCode;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.enums.OrderAction;
import com.neighborhood.service.enums.OrderSource;
import com.neighborhood.service.enums.OrderStatus;
import com.neighborhood.service.enums.OperatorType;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OrderLogMapper;
import com.neighborhood.service.mapper.OrderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 客户预约创建。
 *
 * <p><b>安全核心</b>：订单归属完全由服务端依据推广码反查得出。
 * {@link PublicDto.BookingRequest} 里刻意<b>没有 providerId 字段</b>，
 * 因此客户端无从通过伪造参数把订单挂到别人名下。</p>
 *
 * <p>校验顺序刻意设计为「先验码，再验人，最后才写库」——
 * 无效推广码、停用服务者、停用项目都不会产生任何脏数据。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private static final DateTimeFormatter ORDER_NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final ReferralCodeService referralCodeService;
    private final ProviderService providerService;
    private final ServiceItemService serviceItemService;
    private final PublicHomeService publicHomeService;
    private final CustomerMapper customerMapper;
    private final OrderMapper orderMapper;
    private final OrderLogMapper orderLogMapper;

    @Transactional(rollbackFor = Exception.class)
    public PublicDto.BookingResultVO createBooking(PublicDto.BookingRequest request) {
        // 1) 推广码：格式 / 存在 / 启用
        ReferralCode code = referralCodeService.requireActiveByCode(request.getReferralCode());

        // 2) 服务者：必须已过审且未被停用（此时下单校验，可能与展示主页时状态已变化）
        Provider provider = providerService.getByProviderId(code.getProviderId());
        providerService.assertCanAcceptOrder(provider);

        // 3) 服务项目：必须属于「平台模板或该服务者」且处于启用状态
        ServiceItem item = serviceItemService.requireOrderable(request.getServiceItemId(), provider.getId());

        // 4) 预约时间规则
        validateBookingRules(item, request.getBookingDate(), request.getBookingSlot());

        // 5) 客户档案（同一服务者下按手机号归并）
        Customer customer = findOrCreateCustomer(provider.getId(), request);

        // 6) 写订单
        Order order = new Order();
        order.setOrderNo(generateOrderNo());
        order.setProviderId(provider.getId());
        order.setCustomerId(customer.getId());
        order.setReferralCodeId(code.getId());
        order.setServiceItemId(item.getId());
        order.setServiceName(item.getName());
        order.setCustomerName(request.getCustomerName());
        order.setCustomerPhone(request.getCustomerPhone());
        order.setCommunity(request.getCommunity());
        order.setAddress(request.getAddress());
        order.setBookingDate(request.getBookingDate());
        order.setBookingSlot(request.getBookingSlot());
        order.setQuantity(1);
        order.setServiceDesc(request.getServiceDesc());
        order.setCustomerRemark(request.getRemark());
        order.setStatus(OrderStatus.PENDING_CONFIRM);
        order.setSource(OrderSource.QR_CODE);
        order.setChannel(request.getChannel() != null ? request.getChannel() : code.getChannel());
        orderMapper.insert(order);

        // 7) 订单创建日志
        writeLog(order, OrderAction.CREATE, null, OrderStatus.PENDING_CONFIRM,
                "客户通过推广码提交预约", OperatorType.CUSTOMER, null, request.getCustomerName());

        // 8) 客户统计
        touchCustomer(customer, request.getBookingDate());

        // 9) 推广码真实预约量
        referralCodeService.markBooking(code.getId());

        log.info("创建订单 {} 归属服务者 {}（推广码 {}）", order.getOrderNo(), provider.getId(), code.getReferralCode());

        PublicDto.BookingResultVO vo = new PublicDto.BookingResultVO();
        vo.setOrderNo(order.getOrderNo());
        vo.setStatus(order.getStatus().getCode());
        vo.setStatusLabel(order.getStatus().getLabel());
        vo.setProviderDisplayName(provider.getRealName());
        vo.setMessage("预约已提交，服务者确认后会与你联系");
        return vo;
    }

    // ------------------------------------------------------------------

    private void validateBookingRules(ServiceItem item, LocalDate bookingDate, String slot) {
        JsonNode rules = publicHomeService.parseBookingRules(item.getBookingRules());

        // 预约日期不能早于今天
        if (bookingDate.isBefore(LocalDate.now())) {
            throw BizException.of(ResultCode.PARAM_ERROR, "预约日期不能早于今天");
        }

        // 最多提前预约天数
        int advanceDays = rules.path("advanceDays").asInt(7);
        if (bookingDate.isAfter(LocalDate.now().plusDays(advanceDays))) {
            throw BizException.of(ResultCode.ORDER_DATE_TOO_FAR,
                    "最多可预约 " + advanceDays + " 天以内的服务");
        }

        // 最早提前小时数
        int minHours = rules.path("minAdvanceHours").asInt(0);
        if (minHours > 0 && bookingDate.isEqual(LocalDate.now())
                && slotStartTime(slot) != null
                && slotStartTime(slot).isBefore(LocalTime.now().plusHours(minHours))) {
            throw BizException.of(ResultCode.ORDER_SLOT_UNAVAILABLE,
                    "该时间段已临近开始，请选择更晚的时间段");
        }

        // 休息日（约定 closedDays 为 0=周日）
        List<Integer> closedDays = new ArrayList<>();
        rules.path("closedDays").forEach(n -> closedDays.add(n.asInt()));
        if (closedDays.contains(bookingDate.getDayOfWeek().getValue() % 7)) {
            throw BizException.of(ResultCode.ORDER_SLOT_UNAVAILABLE, "该日期为休息日，请另选日期");
        }

        // 时间段白名单
        JsonNode slots = rules.path("slots");
        if (slots.isArray() && !slots.isEmpty()) {
            boolean allowed = false;
            for (JsonNode s : slots) {
                if (s.asText().equals(slot)) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                throw BizException.of(ResultCode.ORDER_SLOT_UNAVAILABLE, "该时间段不在可预约范围内");
            }
        }
    }

    private LocalTime slotStartTime(String slot) {
        if (slot == null || !slot.contains("-")) {
            return null;
        }
        try {
            return LocalTime.parse(slot.substring(0, 5));
        } catch (Exception e) {
            return null;
        }
    }

    private Customer findOrCreateCustomer(Long providerId, PublicDto.BookingRequest request) {
        Customer existing = customerMapper.selectOne(Wrappers.<Customer>lambdaQuery()
                .eq(Customer::getProviderId, providerId)
                .eq(Customer::getPhone, request.getCustomerPhone())
                .last("LIMIT 1"));
        if (existing != null) {
            // 顺带补全客户可能未填的地址信息
            Customer update = new Customer();
            update.setId(existing.getId());
            if (existing.getCommunity() == null && request.getCommunity() != null) {
                update.setCommunity(request.getCommunity());
            }
            if ((existing.getAddress() == null || existing.getAddress().isBlank()) && request.getAddress() != null) {
                update.setAddress(request.getAddress());
            }
            if (update.getId() != null) {
                customerMapper.updateById(update);
            }
            return existing;
        }

        Customer customer = new Customer();
        customer.setProviderId(providerId);
        customer.setName(request.getCustomerName());
        customer.setPhone(request.getCustomerPhone());
        customer.setCommunity(request.getCommunity());
        customer.setAddress(request.getAddress());
        customer.setOrderCount(0);
        customerMapper.insert(customer);
        return customer;
    }

    private void touchCustomer(Customer customer, LocalDate bookingDate) {
        LocalDateTime at = bookingDate.atStartOfDay();
        Customer update = new Customer();
        update.setId(customer.getId());
        update.setOrderCount((customer.getOrderCount() == null ? 0 : customer.getOrderCount()) + 1);
        if (customer.getFirstServiceAt() == null) {
            update.setFirstServiceAt(at);
        }
        update.setLastServiceAt(at);
        customerMapper.updateById(update);
    }

    /** 业务订单号：时间戳 + 短随机，够用且可读；唯一性由唯一索引兜底。 */
    private String generateOrderNo() {
        return "NB" + LocalDateTime.now().format(ORDER_NO_FORMAT)
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    private void writeLog(Order order, OrderAction action, OrderStatus from, OrderStatus to,
                          String remark, OperatorType operatorType, Long operatorId, String operatorName) {
        OrderLog log = new OrderLog();
        log.setOrderId(order.getId());
        log.setProviderId(order.getProviderId());
        log.setAction(action);
        log.setFromStatus(from);
        log.setToStatus(to);
        log.setRemark(remark);
        log.setOperatorType(operatorType);
        log.setOperatorId(operatorId);
        log.setOperatorName(operatorName);
        orderLogMapper.insert(log);
    }
}
