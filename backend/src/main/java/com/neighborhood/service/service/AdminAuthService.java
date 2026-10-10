package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.AuthDto;
import com.neighborhood.service.entity.AdminUser;
import com.neighborhood.service.entity.OperationLog;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.enums.OperatorType;
import com.neighborhood.service.mapper.AdminUserMapper;
import com.neighborhood.service.mapper.OperationLogMapper;
import com.neighborhood.service.security.JwtProperties;
import com.neighborhood.service.security.JwtTokenProvider;
import com.neighborhood.service.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 平台管理员登录 + 操作日志。
 *
 * <p>管理员使用与业务服务者<b>完全独立</b>的账号体系（admin_users 表）、
 * 独立签名密钥和独立路由前缀，不存在「服务者账号被提升为管理员」的路径。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminAuthService {

    private final AdminUserMapper adminUserMapper;
    private final OperationLogMapper operationLogMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;

    public AuthDto.LoginResponse login(AuthDto.LoginRequest req) {
        AdminUser admin = adminUserMapper.selectOne(Wrappers.<AdminUser>lambdaQuery()
                .eq(AdminUser::getUsername, req.getUsername())
                .last("LIMIT 1"));

        // 账号不存在与密码错误返回同一错误码，避免账号枚举
        if (admin == null || !passwordEncoder.matches(req.getPassword(), admin.getPasswordHash())) {
            throw BizException.of(ResultCode.LOGIN_FAILED);
        }
        if (admin.getStatus() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.ACCOUNT_DISABLED);
        }

        AdminUser update = new AdminUser();
        update.setId(admin.getId());
        update.setLastLoginAt(LocalDateTime.now());
        adminUserMapper.updateById(update);

        AuthDto.LoginResponse resp = new AuthDto.LoginResponse();
        resp.setToken(jwtTokenProvider.generateAdminToken(admin.getId(), admin.getUsername(), admin.getRealName()));
        resp.setProviderId(null);
        resp.setDisplayName(admin.getRealName());
        resp.setUsername(admin.getUsername());
        resp.setExpiresInSeconds(jwtProperties.getAdminExpireMinutes() * 60);

        log.info("管理员登录: {}", admin.getUsername());
        // ⚠️ 登录时 SecurityContext 还是空的，不能走 requireAdminId()，
        //    必须显式把操作者塞进去，否则这条日志永远写不进去。
        writeLoginLog(admin);
        return resp;
    }

    /** 登录日志：操作者尚未建立认证上下文，需显式指定。 */
    private void writeLoginLog(AdminUser admin) {
        try {
            OperationLog opLog = new OperationLog();
            opLog.setOperatorType(OperatorType.ADMIN);
            opLog.setOperatorId(admin.getId());
            opLog.setOperatorName(admin.getRealName() != null ? admin.getRealName() : admin.getUsername());
            opLog.setModule("认证");
            opLog.setAction("登录");
            opLog.setTargetId(String.valueOf(admin.getId()));
            opLog.setDetail(admin.getUsername());
            operationLogMapper.insert(opLog);
        } catch (Exception e) {
            log.error("写入登录日志失败: {}", admin.getUsername(), e);
        }
    }

    /**
     * 记录平台操作日志。
     *
     * <p>需求要求「重要操作应保留日志」，这里统一提供入口，
     * 由控制器在关键动作（审核、启停、违规处理）处调用。</p>
     */
    public void writeLog(String module, String action, String detail) {
        writeLog(module, action, null, detail, null);
    }

    public void writeLog(String module, String action, String targetId, String detail) {
        writeLog(module, action, targetId, detail, null);
    }

    /**
     * 记录平台操作日志。
     *
     * <p>需求要求「重要操作应保留日志」，这里统一提供入口，
     * 由控制器在关键动作（审核、启停、违规处理）处调用。</p>
     */
    public void writeLog(String module, String action, String targetId, String detail, String ip) {
        try {
            OperationLog opLog = new OperationLog();
            opLog.setOperatorType(OperatorType.ADMIN);
            // 登录场景走 writeLoginLog，这里只会出现在已认证的请求中
            opLog.setOperatorId(SecurityUtils.requireAdminId());
            opLog.setOperatorName(SecurityUtils.currentOperatorName());
            opLog.setModule(module);
            opLog.setAction(action);
            opLog.setTargetId(targetId);
            opLog.setDetail(detail);
            opLog.setIp(ip);
            operationLogMapper.insert(opLog);
        } catch (Exception e) {
            // 日志失败不能影响主业务，但必须告警
            log.error("写入操作日志失败: {}/{}", module, action, e);
        }
    }

    public void writeLogFromRequest(String module, String action, String targetId, String detail,
                                    HttpServletRequest request) {
        writeLog(module, action, targetId, detail, clientIp(request));
    }

    public static String clientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
