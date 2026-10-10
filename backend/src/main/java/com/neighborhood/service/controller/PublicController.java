package com.neighborhood.service.controller;

import com.neighborhood.service.common.Result;
import com.neighborhood.service.dto.PublicDto;
import com.neighborhood.service.service.BookingService;
import com.neighborhood.service.service.PublicHomeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 客户扫码入口（匿名可访问）。
 *
 * <p>所有入口只认推广码。刻意不提供任何 {@code providerId} 形式的查询参数，
 * 客户侧不存在「猜 id 就能看别人主页 / 下单到别人名下」的路径。</p>
 */
@Tag(name = "01-公开接口(客户扫码)", description = "客户扫码进入服务主页、查看服务项目、提交预约")
@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
@Validated
public class PublicController {

    private final PublicHomeService publicHomeService;
    private final BookingService bookingService;

    @Operation(summary = "按推广码查询服务主页",
            description = "referralCode 来自小程序码 scene 参数。后端依次校验码有效性、服务者审核状态与主页启用状态。")
    @GetMapping("/provider/home")
    public Result<PublicDto.ProviderHomeVO> home(
            @RequestParam("referralCode") @NotBlank(message = "缺少推广码") String referralCode) {
        return Result.ok(publicHomeService.getHomeByReferralCode(referralCode));
    }

    @Operation(summary = "客户提交预约",
            description = "订单归属完全由服务端依据 referralCode 反查得出，请求体中不存在 providerId 字段。")
    @PostMapping("/bookings")
    public Result<PublicDto.BookingResultVO> book(@Valid @RequestBody PublicDto.BookingRequest request) {
        return Result.ok(bookingService.createBooking(request));
    }
}