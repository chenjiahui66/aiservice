package com.neighborhood.service.controller;

import com.neighborhood.service.common.PageResult;
import com.neighborhood.service.common.Result;
import com.neighborhood.service.dto.AdminDto;
import com.neighborhood.service.dto.OrderDto;
import com.neighborhood.service.entity.SystemSetting;
import com.neighborhood.service.enums.ComplaintStatus;
import com.neighborhood.service.service.AdminAuthService;
import com.neighborhood.service.service.AdminService;
import com.neighborhood.service.wechat.WxMaCodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 平台管理端接口（需 ROLE_ADMIN）。
 *
 * <p>管理员 token 无法通过 {@code /api/provider/**} 的权限校验，反之亦然——
 * 两端由不同签名密钥隔离。管理端也不提供修改服务者业务记录的接口。</p>
 */
@Tag(name = "04-平台管理端", description = "概览、服务者审核与启停、服务项目、全平台订单、投诉、日志、设置")
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final AdminAuthService adminAuthService;
    private final WxMaCodeService wxMaCodeService;

    // ---------------- 概览 ----------------

    @Operation(summary = "平台概览", description = "所有数字均来自真实数据库统计，不使用固定值。")
    @GetMapping("/dashboard")
    public Result<AdminDto.DashboardVO> dashboard() {
        AdminDto.DashboardVO vo = adminService.dashboard();
        vo.setWechatCodeMode(wxMaCodeService.currentMode());
        return Result.ok(vo);
    }

    // ---------------- 服务者 ----------------

    @Operation(summary = "服务者列表")
    @GetMapping("/providers")
    public Result<PageResult<AdminDto.ProviderListVO>> providers(AdminDto.ProviderQuery query) {
        return Result.ok(adminService.providers(query));
    }

    @Operation(summary = "服务者审核详情")
    @GetMapping("/providers/{id}")
    public Result<AdminDto.ProviderListVO> providerDetail(@PathVariable Long id) {
        return Result.ok(adminService.providerDetail(id));
    }

    @Operation(summary = "审核服务者", description = "通过或驳回，并记录审核意见与时间。")
    @PostMapping("/providers/{id}/audit")
    public Result<AdminDto.ProviderListVO> audit(@PathVariable Long id,
                                                  @Valid @RequestBody AdminDto.AuditRequest request,
                                                  HttpServletRequest servletRequest) {
        var vo = adminService.audit(id, request);
        adminAuthService.writeLogFromRequest("服务者管理", "审核",
                String.valueOf(id),
                (request.getApproved() ? "通过" : "驳回") + "；意见：" + request.getRemark(),
                servletRequest);
        return Result.ok(vo);
    }

    @Operation(summary = "启用 / 停用服务者", description = "停用后同步禁用其登录账号，推广码立即失效。")
    @PostMapping("/providers/{id}/status")
    public Result<AdminDto.ProviderListVO> toggle(@PathVariable Long id,
                                                  @Valid @RequestBody AdminDto.StatusRequest request,
                                                  HttpServletRequest servletRequest) {
        var vo = adminService.toggleProvider(id, request);
        adminAuthService.writeLogFromRequest("服务者管理",
                Boolean.TRUE.equals(request.getEnabled()) ? "启用" : "停用",
                String.valueOf(id), request.getReason(), servletRequest);
        return Result.ok(vo);
    }

    // ---------------- 服务项目 ----------------

    @Operation(summary = "服务项目模板列表")
    @GetMapping("/service-items")
    public Result<List<AdminDto.ServiceItemVO>> serviceItems() {
        return Result.ok(adminService.serviceItems());
    }

    @Operation(summary = "新增 / 更新服务项目模板")
    @PostMapping("/service-items")
    public Result<AdminDto.ServiceItemVO> createItem(@Valid @RequestBody AdminDto.ServiceItemSaveRequest request) {
        return Result.ok(adminService.saveServiceItem(null, request));
    }

    @Operation(summary = "更新服务项目模板")
    @PutMapping("/service-items/{id}")
    public Result<AdminDto.ServiceItemVO> updateItem(@PathVariable Long id,
                                                     @Valid @RequestBody AdminDto.ServiceItemSaveRequest request) {
        return Result.ok(adminService.saveServiceItem(id, request));
    }

    // ---------------- 全平台订单（只读） ----------------

    @Operation(summary = "全平台订单查询", description = "只读。管理员不通过本接口修改服务者的业务记录。")
    @GetMapping("/orders")
    public Result<PageResult<OrderDto.OrderVO>> orders(OrderDto.OrderQuery query,
                                                       @RequestParam(required = false) String keyword) {
        return Result.ok(adminService.allOrders(query, keyword));
    }

    // ---------------- 投诉与违规 ----------------

    @Operation(summary = "投诉 / 反馈 / 违规列表")
    @GetMapping("/complaints")
    public Result<PageResult<Map<String, Object>>> complaints(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(adminService.complaints(status, page, size));
    }

    @Operation(summary = "处理投诉记录")
    @PostMapping("/complaints/{id}/handle")
    public Result<Map<String, Object>> handleComplaint(@PathVariable Long id,
                                                       @RequestParam ComplaintStatus status,
                                                       @RequestParam(required = false) String remark,
                                                       HttpServletRequest servletRequest) {
        var r = adminService.handleComplaint(id, status, remark);
        adminAuthService.writeLogFromRequest("投诉处理", "处理", String.valueOf(id), remark, servletRequest);
        return Result.ok(r);
    }

    // ---------------- 日志与设置 ----------------

    @Operation(summary = "操作日志")
    @GetMapping("/logs")
    public Result<PageResult<AdminDto.OperationLogVO>> logs(@RequestParam(defaultValue = "1") int page,
                                                            @RequestParam(defaultValue = "20") int size) {
        return Result.ok(adminService.operationLogs(page, size));
    }

    @Operation(summary = "系统基础设置")
    @GetMapping("/settings")
    public Result<List<SystemSetting>> settings() {
        return Result.ok(adminService.settings());
    }

    @Operation(summary = "更新系统基础设置")
    @PutMapping("/settings/{key}")
    public Result<SystemSetting> updateSetting(@PathVariable String key,
                                               @RequestParam String value,
                                               HttpServletRequest servletRequest) {
        var s = adminService.saveSetting(key, value);
        adminAuthService.writeLogFromRequest("系统设置", "修改", key, key + " = " + value, servletRequest);
        return Result.ok(s);
    }
}
