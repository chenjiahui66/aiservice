package com.neighborhood.service.controller;

import com.neighborhood.service.common.ConsentContext;
import com.neighborhood.service.common.Result;
import com.neighborhood.service.dto.AuthDto;
import com.neighborhood.service.dto.OrderDto;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.security.DataScope;
import com.neighborhood.service.service.ConsentService;
import com.neighborhood.service.service.OrderService;
import com.neighborhood.service.service.ProviderAuthService;
import com.neighborhood.service.service.ReferralCodeService;
import com.neighborhood.service.service.ServiceItemService;
import com.neighborhood.service.service.ServicePageService;
import com.neighborhood.service.dto.PublicDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * 服务者端接口（需 ROLE_PROVIDER）。
 *
 * <p>本组接口<b>一律不接受 providerId 参数</b>：归属全部取自 token。
 * 即便攻击者手工拼上 {@code ?providerId=999}，也不会影响任何查询结果。</p>
 */
@Tag(name = "02-服务者端", description = "我的主页、推广码、今日台账、订单、客户")
@RestController
@RequestMapping("/api/provider")
@RequiredArgsConstructor
public class ProviderController {

    private final ProviderAuthService providerAuthService;
    private final ServicePageService servicePageService;
    private final ServiceItemService serviceItemService;
    private final ReferralCodeService referralCodeService;
    private final OrderService orderService;
    private final ConsentService consentService;

    // ---------------- 资料 ----------------

    @Operation(summary = "提交协议同意记录",
            description = "服务者在登录后补充同意《用户服务协议》《隐私政策》时调用。"
                    + "记录含同意时间、协议版本、客户端 IP 与设备标识，可用于合规核查。")
    @PostMapping("/consent")
    public Result<Object> consent(@Valid @RequestBody AuthDto.ConsentRequest request,
                                   HttpServletRequest servletRequest) {
        consentService.record(
                DataScope.currentProviderId(),
                ConsentService.USER_TYPE_PROVIDER,
                request.getSubjectType(),
                null,
                request.getPolicyVersion(),
                Boolean.TRUE.equals(request.getAgreed()),
                ConsentContext.from(servletRequest));
        return Result.ok("已记录您的同意");
    }

    @Operation(summary = "我的服务者资料（含审核状态）")
    @GetMapping("/profile")
    public Result<ProviderDto.ProfileVO> profile() {
        return Result.ok(providerAuthService.getProfile(DataScope.currentProviderId()));
    }

    @Operation(summary = "更新我的服务者资料")
    @PutMapping("/profile")
    public Result<ProviderDto.ProfileVO> updateProfile(
            @Valid @RequestBody ProviderDto.ProfileUpdateRequest request) {
        return Result.ok(providerAuthService.updateProfile(DataScope.currentProviderId(), request));
    }

    // ---------------- 服务主页 ----------------

    @Operation(summary = "获取我的服务主页配置")
    @GetMapping("/page")
    public Result<ProviderDto.ServicePageVO> myPage() {
        return Result.ok(servicePageService.getMine(DataScope.currentProviderId()));
    }

    @Operation(summary = "保存我的服务主页配置")
    @PutMapping("/page")
    public Result<ProviderDto.ServicePageVO> savePage(
            @Valid @RequestBody ProviderDto.ServicePageVO request) {
        return Result.ok(servicePageService.update(DataScope.currentProviderId(), request));
    }

    // ---------------- 推广中心 ----------------

    @Operation(summary = "我的专属推广码信息")
    @GetMapping("/referral")
    public Result<ProviderDto.ReferralInfoVO> referral() {
        return Result.ok(referralCodeService.buildInfo(DataScope.currentProviderId()));
    }

    @Operation(summary = "生成 / 重新生成小程序码",
            description = "重新生成只刷新二维码图片，不改变推广码与服务者的归属关系。")
    @PostMapping("/referral/qr")
    public Result<Object> generateQr(@Valid @RequestBody(required = false) ProviderDto.QrRequest request) {
        var result = referralCodeService.generateQr(
                DataScope.currentProviderId(),
                request == null ? 430 : request.getWidth(),
                request == null ? null : request.getChannel());
        // 不回传二进制，前端用 imageKey 再取图片，避免响应体过大
        return Result.ok(java.util.Map.of(
                "imageKey", result.getImageKey(),
                "mode", result.getMode(),
                "notice", result.getNotice(),
                "imageUrl", "/api/provider/referral/qr/" + result.getImageKey()));
    }

    @Operation(summary = "获取小程序码图片")
    @GetMapping(value = "/referral/qr/{imageKey}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> qrImage(@PathVariable String imageKey) {
        // 只允许读自己码的图片
        var info = referralCodeService.buildInfo(DataScope.currentProviderId());
        if (info.getQrImageKey() == null || !info.getQrImageKey().equals(imageKey)) {
            return ResponseEntity.notFound().build();
        }
        byte[] image = referralCodeService.readQrImage(imageKey);
        if (image == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "max-age=300")
                .contentType(MediaType.IMAGE_PNG)
                .body(image);
    }

    @Operation(summary = "推广统计（全部为真实数据）")
    @GetMapping("/referral/stats")
    public Result<ProviderDto.ReferralStatsVO> referralStats() {
        return Result.ok(referralCodeService.buildStats(DataScope.currentProviderId()));
    }

    @Operation(summary = "我可提供的服务项目（配置化，非硬编码）")
    @GetMapping("/service-items")
    public Result<java.util.List<PublicDto.ServiceItemVO>> serviceItems() {
        return Result.ok(serviceItemService.listOfferedBy(DataScope.currentProviderId())
                .stream().map(serviceItemService::toVO).toList());
    }

    // ---------------- 今日工作台账 ----------------

    @Operation(summary = "工作台账", description = "date 省略时为今天；支持切换明天及未来日期。")
    @GetMapping("/board")
    public Result<OrderDto.BoardVO> board(
            @RequestParam(value = "date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return Result.ok(orderService.board(date));
    }

    // ---------------- 订单 ----------------

    @Operation(summary = "订单列表", description = "支持按日期、状态、客户关键词、服务项目筛选。")
    @GetMapping("/orders")
    public Result<com.neighborhood.service.common.PageResult<OrderDto.OrderVO>> orders(OrderDto.OrderQuery query) {
        return Result.ok(orderService.page(query));
    }

    @Operation(summary = "订单详情（含状态流转记录）")
    @GetMapping("/orders/{orderId}")
    public Result<OrderDto.OrderVO> orderDetail(@PathVariable Long orderId) {
        return Result.ok(orderService.detail(orderId));
    }

    @Operation(summary = "手动新增订单", description = "电话/微信/线下沟通的预约统一录入。")
    @PostMapping("/orders")
    public Result<OrderDto.OrderVO> createManual(
            @Valid @RequestBody OrderDto.ManualOrderRequest request) {
        return Result.ok(orderService.createManual(DataScope.currentProviderId(), request));
    }

    @Operation(summary = "确认预约", description = "待确认 → 已预约。非法流转由后端状态机拒绝。")
    @PostMapping("/orders/{orderId}/confirm")
    public Result<OrderDto.OrderVO> confirm(@PathVariable Long orderId,
                                             @RequestBody(required = false) OrderDto.StatusChangeRequest req) {
        return Result.ok(orderService.confirm(orderId, req));
    }

    @Operation(summary = "开始服务", description = "已预约 → 服务中。")
    @PostMapping("/orders/{orderId}/start")
    public Result<OrderDto.OrderVO> start(@PathVariable Long orderId,
                                           @RequestBody(required = false) OrderDto.StatusChangeRequest req) {
        return Result.ok(orderService.start(orderId, req));
    }

    @Operation(summary = "完成服务", description = "服务中 → 已完成，并更新客户复购计划。")
    @PostMapping("/orders/{orderId}/complete")
    public Result<OrderDto.OrderVO> complete(@PathVariable Long orderId,
                                             @RequestBody(required = false) OrderDto.StatusChangeRequest req) {
        return Result.ok(orderService.complete(orderId, req));
    }

    @Operation(summary = "取消订单", description = "必须填写取消原因。")
    @PostMapping("/orders/{orderId}/cancel")
    public Result<OrderDto.OrderVO> cancel(@PathVariable Long orderId,
                                           @Valid @RequestBody OrderDto.CancelRequest req) {
        return Result.ok(orderService.cancel(orderId, req));
    }

    @Operation(summary = "更新服务备注")
    @PutMapping("/orders/{orderId}/note")
    public Result<OrderDto.OrderVO> updateNote(@PathVariable Long orderId,
                                               @Valid @RequestBody OrderDto.NoteUpdateRequest req) {
        return Result.ok(orderService.updateNote(orderId, req));
    }
}
