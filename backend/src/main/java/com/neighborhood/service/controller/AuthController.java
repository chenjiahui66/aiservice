package com.neighborhood.service.controller;

import com.neighborhood.service.common.ConsentContext;
import com.neighborhood.service.common.Result;
import com.neighborhood.service.dto.AuthDto;
import com.neighborhood.service.service.AdminAuthService;
import com.neighborhood.service.service.ProviderAuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证入口。
 *
 * <p>服务者与管理员走同一个 URL 前缀但不同端点，且由不同密钥签发 token，
 * 因此服务端 token 在服务端接口上必然验签失败。</p>
 */
@Tag(name = "00-认证", description = "服务者注册/登录、管理员登录")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final ProviderAuthService providerAuthService;
    private final AdminAuthService adminAuthService;

    @Operation(summary = "服务者注册",
            description = "注册即通过，无需人工审核，注册完就能登录、就能对外接单。"
                    + "出问题的服务者由平台在后台停用处理。"
                    + "必须先明示同意《用户服务协议》和《隐私政策」，同意记录会落库留证。")
    @PostMapping("/provider/register")
    public Result<AuthDto.LoginResponse> register(@Valid @RequestBody AuthDto.RegisterRequest request,
                                                  HttpServletRequest servletRequest) {
        return Result.ok("注册成功",
                providerAuthService.register(request, ConsentContext.from(servletRequest)));
    }

    @Operation(summary = "服务者登录", description = "返回 token 与账号状态，前端据此跳转对应页面。"
            + "登录同样需要明示同意《用户服务协议》和《隐私政策》。")
    @PostMapping("/provider/login")
    public Result<AuthDto.LoginResponse> providerLogin(@Valid @RequestBody AuthDto.ProviderLoginRequest request,
                                                        HttpServletRequest servletRequest) {
        return Result.ok(providerAuthService.login(request, ConsentContext.from(servletRequest)));
    }

    @Operation(summary = "平台管理员登录", description = "管理员账号体系独立于业务用户表。")
    @PostMapping("/admin/login")
    public Result<AuthDto.LoginResponse> adminLogin(@Valid @RequestBody AuthDto.LoginRequest request) {
        return Result.ok(adminAuthService.login(request));
    }
}