package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.AuthDto;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ReferralCode;
import com.neighborhood.service.entity.ServicePage;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.enums.AuditStatus;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.enums.QrMode;
import com.neighborhood.service.mapper.ProviderMapper;
import com.neighborhood.service.mapper.ReferralCodeMapper;
import com.neighborhood.service.mapper.ServicePageMapper;
import com.neighborhood.service.mapper.UserMapper;
import com.neighborhood.service.referral.ReferralCodeGenerator;
import com.neighborhood.service.security.JwtProperties;
import com.neighborhood.service.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 服务者注册 / 登录 / 资料维护。
 *
 * <p>注册后账号处于「待审核」，默认不能公开展示主页、不能接收预约——
 * 审核通过才由平台侧开启，不存在「新注册即可接单」的旁路。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProviderAuthService {

    private final UserMapper userMapper;
    private final ProviderMapper providerMapper;
    private final ServicePageMapper servicePageMapper;
    private final ReferralCodeMapper referralCodeMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;
    private final ReferralCodeGenerator generator;

    // ------------------------------------------------------------------
    // 注册
    // ------------------------------------------------------------------

    @Transactional(rollbackFor = Exception.class)
    public AuthDto.LoginResponse register(AuthDto.RegisterRequest req) {
        Long exists = userMapper.selectCount(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, req.getPhone()));
        if (exists != null && exists > 0) {
            throw BizException.of(ResultCode.USERNAME_EXISTS);
        }

        User user = new User();
        user.setUsername(req.getPhone());
        user.setPhone(req.getPhone());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setNickname(req.getRealName());
        user.setStatus(EnabledStatus.ENABLED);

        Provider provider = new Provider();
        provider.setRealName(req.getRealName());
        provider.setServiceArea(req.getServiceArea());
        provider.setAuditStatus(AuditStatus.PENDING);
        provider.setEnabled(EnabledStatus.ENABLED);

        try {
            userMapper.insert(user);
            provider.setUserId(user.getId());
            providerMapper.insert(provider);
        } catch (DuplicateKeyException e) {
            throw BizException.of(ResultCode.USERNAME_EXISTS);
        }

        // 默认服务主页骨架：服务者填内容后才能对外展示
        ServicePage page = new ServicePage();
        page.setProviderId(provider.getId());
        page.setDisplayName(req.getRealName());
        page.setServiceArea(req.getServiceArea());
        page.setContactVisible(EnabledStatus.ENABLED);
        page.setEnabled(EnabledStatus.DISABLED);
        servicePageMapper.insert(page);

        // 注册即分配推广码，保证「注册后立刻能拿到自己的码」
        seedReferralCode(provider.getId());

        log.info("新服务者注册: phone={} providerId={}", maskPhone(req.getPhone()), provider.getId());

        AuthDto.LoginResponse resp = new AuthDto.LoginResponse();
        resp.setToken(issue(user, provider));
        resp.setProviderId(provider.getId());
        resp.setDisplayName(provider.getRealName());
        resp.setUsername(user.getUsername());
        resp.setAuditStatus(provider.getAuditStatus().name());
        resp.setAuditRemark(provider.getAuditRemark());
        resp.setExpiresInSeconds(jwtProperties.getProviderExpireMinutes() * 60);
        return resp;
    }

    /**
     * 注册即分配推广码，保证「注册后立刻能拿到自己的专属码」。
     * 失败不阻断注册：服务者后续可在小程序端重新获取。
     */
    private void seedReferralCode(Long providerId) {
        try {
            ReferralCode code = new ReferralCode();
            code.setProviderId(providerId);
            code.setReferralCode(generator.generate());
            code.setStatus(EnabledStatus.ENABLED);
            code.setQrMode(QrMode.DEV);
            code.setVisitCount(0);
            code.setBookingCount(0);
            code.setChannel("DIRECT");
            referralCodeMapper.insert(code);
        } catch (DuplicateKeyException e) {
            log.warn("推广码唯一键冲突，稍后由服务者端重新获取");
        }
    }

    // ------------------------------------------------------------------
    // 登录
    // ------------------------------------------------------------------

    public AuthDto.LoginResponse login(AuthDto.LoginRequest req) {
        User user = userMapper.selectOne(Wrappers.<User>lambdaQuery()
                .eq(User::getUsername, req.getUsername())
                .last("LIMIT 1"));

        // 用户不存在与密码错误返回同一错误码，避免账号枚举
        if (user == null || !passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw BizException.of(ResultCode.LOGIN_FAILED);
        }
        if (user.getStatus() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.ACCOUNT_DISABLED);
        }

        Provider provider = providerMapper.selectOne(Wrappers.<Provider>lambdaQuery()
                .eq(Provider::getUserId, user.getId())
                .last("LIMIT 1"));
        if (provider == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        if (provider.getEnabled() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.PROVIDER_DISABLED);
        }

        User update = new User();
        update.setId(user.getId());
        update.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(update);

        AuthDto.LoginResponse resp = new AuthDto.LoginResponse();
        resp.setToken(issue(user, provider));
        resp.setProviderId(provider.getId());
        resp.setDisplayName(provider.getRealName());
        resp.setUsername(user.getUsername());
        resp.setAuditStatus(provider.getAuditStatus().name());
        resp.setAuditRemark(provider.getAuditRemark());
        resp.setExpiresInSeconds(jwtProperties.getProviderExpireMinutes() * 60);
        return resp;
    }

    private String issue(User user, Provider provider) {
        return jwtTokenProvider.generateProviderToken(
                user.getId(), provider.getId(), user.getUsername(), provider.getRealName());
    }

    // ------------------------------------------------------------------
    // 资料
    // ------------------------------------------------------------------

    public ProviderDto.ProfileVO getProfile(Long providerId) {
        Provider provider = providerMapper.selectById(providerId);
        if (provider == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        User user = userMapper.selectById(provider.getUserId());

        ProviderDto.ProfileVO vo = new ProviderDto.ProfileVO();
        vo.setProviderId(provider.getId());
        vo.setUserId(provider.getUserId());
        vo.setRealName(provider.getRealName());
        vo.setServiceArea(provider.getServiceArea());
        vo.setAuditStatus(provider.getAuditStatus() == null ? null : provider.getAuditStatus().name());
        vo.setAuditStatusLabel(provider.getAuditStatus() == null ? null : provider.getAuditStatus().getLabel());
        vo.setAuditRemark(provider.getAuditRemark());
        vo.setAuditedAt(provider.getAuditedAt());
        vo.setEnabled(provider.getEnabled() == null ? null : provider.getEnabled().name());
        if (user != null) {
            vo.setNickname(user.getNickname());
            vo.setAvatarUrl(user.getAvatarUrl());
            vo.setPhone(user.getPhone());
        }
        return vo;
    }

    public ProviderDto.ProfileVO updateProfile(Long providerId, ProviderDto.ProfileUpdateRequest req) {
        Provider provider = providerMapper.selectById(providerId);
        if (provider == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }

        if (req.getRealName() != null && !req.getRealName().isBlank()) {
            Provider up = new Provider();
            up.setId(providerId);
            up.setRealName(req.getRealName());
            providerMapper.updateById(up);

            User uu = new User();
            uu.setId(provider.getUserId());
            uu.setNickname(req.getRealName());
            userMapper.updateById(uu);
        }
        if (req.getServiceArea() != null) {
            Provider up = new Provider();
            up.setId(providerId);
            up.setServiceArea(req.getServiceArea());
            providerMapper.updateById(up);
        }
        if (req.getNickname() != null || req.getAvatarUrl() != null) {
            User uu = new User();
            uu.setId(provider.getUserId());
            uu.setNickname(req.getNickname());
            uu.setAvatarUrl(req.getAvatarUrl());
            userMapper.updateById(uu);
        }
        return getProfile(providerId);
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return "***";
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }
}
