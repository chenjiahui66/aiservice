package com.neighborhood.service.controller;

import com.neighborhood.service.common.PageResult;
import com.neighborhood.service.common.Result;
import com.neighborhood.service.dto.CustomerDto;
import com.neighborhood.service.dto.OrderDto;
import com.neighborhood.service.service.CustomerService;
import com.neighborhood.service.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 客户台账接口（需 ROLE_PROVIDER）。
 *
 * <p>客户按「服务者—客户」关系维护，本组所有接口的数据范围都限定在
 * 当前 token 对应服务者名下，服务者之间互相不可见。</p>
 */
@Tag(name = "03-客户台账", description = "我的客户档案与历史服务记录")
@RestController
@RequestMapping("/api/provider/customers")
@RequiredArgsConstructor
public class CustomerController {

    private final CustomerService customerService;

    @Operation(summary = "客户列表")
    @GetMapping
    public Result<PageResult<CustomerDto.CustomerVO>> list(CustomerDto.CustomerQuery query) {
        return Result.ok(customerService.page(query));
    }

    @Operation(summary = "客户详情（含历史订单）")
    @GetMapping("/{customerId}")
    public Result<CustomerDto.CustomerDetailVO> detail(@PathVariable Long customerId) {
        return Result.ok(customerService.detail(customerId));
    }

    @Operation(summary = "更新客户资料与复购计划")
    @PutMapping("/{customerId}")
    public Result<CustomerDto.CustomerVO> update(@PathVariable Long customerId,
                                                 @Valid @RequestBody CustomerDto.CustomerUpdateRequest request) {
        return Result.ok(customerService.update(customerId, request));
    }
}
