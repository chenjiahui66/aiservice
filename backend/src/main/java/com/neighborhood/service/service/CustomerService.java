package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.PageResult;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.CustomerDto;
import com.neighborhood.service.dto.OrderDto;
import com.neighborhood.service.entity.Customer;
import com.neighborhood.service.entity.Order;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OrderMapper;
import com.neighborhood.service.security.DataScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 客户台账。
 *
 * <p>客户按「服务者—客户」关系维护：同一个手机号在不同服务者下各存一份记录，
 * 且<b>服务者之间互相不可见</b>。因此本服务所有查询都必须带
 * {@code provider_id = 当前 token 中的 providerId}。</p>
 */
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerMapper customerMapper;
    private final OrderMapper orderMapper;
    private final OrderService orderService;

    public PageResult<CustomerDto.CustomerVO> page(CustomerDto.CustomerQuery query) {
        Long providerId = DataScope.currentProviderId();

        LambdaQueryWrapper<Customer> w = Wrappers.<Customer>lambdaQuery()
                .eq(Customer::getProviderId, providerId);
        if (StringUtils.hasText(query.getKeyword())) {
            String kw = query.getKeyword().trim();
            w.and(x -> x.like(Customer::getName, kw).or().like(Customer::getPhone, kw));
        }
        w.orderByDesc(Customer::getLastServiceAt).orderByDesc(Customer::getId);

        int pageNum = query.getPage() == null || query.getPage() < 1 ? 1 : query.getPage();
        int size = query.getSize() == null || query.getSize() < 1 ? 20 : Math.min(query.getSize(), 100);

        Page<Customer> page = customerMapper.selectPage(new Page<>(pageNum, size), w);
        return PageResult.of(page, CustomerService::toVO);
    }

    /** 客户详情 + 该客户在本服务者名下的历史订单。 */
    public CustomerDto.CustomerDetailVO detail(Long customerId) {
        Long providerId = DataScope.currentProviderId();
        Customer customer = requireOwned(customerId, providerId);

        CustomerDto.CustomerDetailVO vo = new CustomerDto.CustomerDetailVO();
        vo.setCustomer(toVO(customer));

        List<Order> orders = orderMapper.selectList(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId)
                .eq(Order::getCustomerId, customerId)
                .orderByDesc(Order::getBookingDate)
                .orderByDesc(Order::getId));
        vo.setOrders(orders.stream().map(orderService::toVO).toList());
        return vo;
    }

    public CustomerDto.CustomerVO update(Long customerId, CustomerDto.CustomerUpdateRequest req) {
        Long providerId = DataScope.currentProviderId();
        Customer customer = requireOwned(customerId, providerId);

        Customer update = new Customer();
        update.setId(customer.getId());
        if (req.getName() != null && !req.getName().isBlank()) {
            update.setName(req.getName());
        }
        if (StringUtils.hasText(req.getPhone())) {
            update.setPhone(req.getPhone());
        }
        if (req.getCommunity() != null) {
            update.setCommunity(req.getCommunity());
        }
        if (req.getAddress() != null) {
            update.setAddress(req.getAddress());
        }
        if (req.getRemark() != null) {
            update.setRemark(req.getRemark());
        }
        if (req.getNextServiceAt() != null) {
            update.setNextServiceAt(req.getNextServiceAt());
        }
        customerMapper.updateById(update);
        return toVO(customerMapper.selectById(customer.getId()));
    }

    private Customer requireOwned(Long customerId, Long providerId) {
        if (customerId == null) {
            throw BizException.of(ResultCode.CUSTOMER_NOT_FOUND);
        }
        Customer customer = customerMapper.selectById(customerId);
        DataScope.assertOwnedByQuery(customer == null ? null : customer.getProviderId());
        return customer;
    }

    public static CustomerDto.CustomerVO toVO(Customer c) {
        CustomerDto.CustomerVO vo = new CustomerDto.CustomerVO();
        if (c == null) {
            return vo;
        }
        vo.setId(c.getId());
        vo.setName(c.getName());
        vo.setPhone(c.getPhone());
        vo.setCommunity(c.getCommunity());
        vo.setAddress(c.getAddress());
        vo.setRemark(c.getRemark());
        vo.setFirstServiceAt(c.getFirstServiceAt());
        vo.setLastServiceAt(c.getLastServiceAt());
        vo.setNextServiceAt(c.getNextServiceAt());
        vo.setOrderCount(c.getOrderCount());
        vo.setCreatedAt(c.getCreatedAt());
        return vo;
    }
}
