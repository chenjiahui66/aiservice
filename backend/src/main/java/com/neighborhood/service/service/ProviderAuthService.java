package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ConsentContext;
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
 * <p>注册即通过：不再有人工审核环节，服务者注册完就能登录、就能对外接单。
 * 出问题的服务者由平台在后台「停用」处理（{@code providers.enabled=DISABLED}
 * 会同时禁用登录账号、让推广码立即失效），后台另有「服务者状态管理」可随时启停。</p>
 *
 * <p>注册 / 登录时都会把账号手机号作为「对外联系电话」的默认值写进服务主页 ——
 * 服务者几乎不会主动去「编辑主页」里填电话，而客户看不到电话就打不了电话，
 * 所以这一步由后端兜底。服务者之后想换成别的号码，在「编辑主页」里改即可，
 * 后端不会覆盖他已经改过的号码。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProviderAuthService {

    private final UserMapper userMapper;
    private final ProviderMapper providerMapper;
    private final ServicePageMapper servicePageMapper;
    private final ReferralCodeMapper referralCodeMapper;
    private final ConsentService consentService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final JwtProperties jwtProperties;
    private final ReferralCodeGenerator generator;

    // ------------------------------------------------------------------
    // 注册
    // ------------------------------------------------------------------

    @Transactional(rollbackFor = Exception.class)
    public AuthDto.LoginResponse register(AuthDto.RegisterRequest req, ConsentContext ctx) {
        requireConsent(req.getConsentAgreed());

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
        // 注册即通过：不再走人工审核，服务者注册完直接能登录用。
        // 需要处置时由平台在后台「停用」，不必在注册链路上卡人。
        provider.setAuditStatus(AuditStatus.APPROVED);
        provider.setAuditedAt(LocalDateTime.now());
        provider.setEnabled(EnabledStatus.ENABLED);

        try {
            userMapper.insert(user);
            provider.setUserId(user.getId());
            providerMapper.insert(provider);
        } catch (DuplicateKeyException e) {
            throw BizException.of(ResultCode.USERNAME_EXISTS);
        }

        // 默认服务主页骨架。
        // ⚠️ 主页默认「开启」而不是关闭：注册的同时就分配了推广码（见下方 seedReferralCode），
        // 如果主页默认关闭，服务者拿到的二维码必然让客户撞上 41008「该服务主页已关闭」，
        // 而「开启主页」开关藏在「编辑主页」里，服务者通常根本不知道要去点开 —— 死结。
        ServicePage page = new ServicePage();
        page.setProviderId(provider.getId());
        page.setDisplayName(req.getRealName());
        page.setServiceArea(req.getServiceArea());
        page.setContactVisible(EnabledStatus.ENABLED);
        page.setEnabled(EnabledStatus.ENABLED);
        // 对外联系电话直接用注册手机号：服务者一般不会主动去填，
        // 不自动带上，客户在主页上就打不了电话。
        page.setContactPhone(req.getPhone());
        servicePageMapper.insert(page);

        // 注册即分配推广码，保证「注册后立刻能拿到自己的码」
        seedReferralCode(provider.getId());

        // 合规留证：手机号属于个人信息，注册时已明示并取得同意，这里落一条可核查的记录
        consentService.recordProviderAgreement(user.getId(), req.getPolicyVersion(), ctx);

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

    /**
     * 把账号手机号作为「对外联系电话」的默认值写进服务主页。
     *
     * <p>规则：主页没有电话才写，已经有号码就不动（不覆盖服务者自己改过的号码）。
     * 主页整条记录都没有时，补一条默认开启的。</p>
     *
     * <p>调用方负责兜住异常：本方法属于「锦上添花」，不该把登录/注册主流程带崩。</p>
     */
    private void bindContactPhone(Provider provider, String phone) {
        if (phone == null || phone.isBlank()) {
            return;
        }
        try {
            ServicePage page = servicePageMapper.selectOne(Wrappers.<ServicePage>lambdaQuery()
                    .eq(ServicePage::getProviderId, provider.getId())
                    .last("LIMIT 1"));
            if (page == null) {
                ServicePage created = new ServicePage();
                created.setProviderId(provider.getId());
                created.setDisplayName(provider.getRealName());
                created.setServiceArea(provider.getServiceArea());
                created.setContactVisible(EnabledStatus.ENABLED);
                created.setEnabled(EnabledStatus.ENABLED);
                created.setContactPhone(phone);
                servicePageMapper.insert(created);
                return;
            }
            if (page.getContactPhone() == null || page.getContactPhone().isBlank()) {
                ServicePage update = new ServicePage();
                update.setId(page.getId());
                update.setContactPhone(phone);
                servicePageMapper.updateById(update);
                log.info("服务者 {} 的主页电话已绑定账号手机号", provider.getId());
            }
        } catch (Exception e) {
            log.warn("服务者 {} 的主页电话绑定失败（不影响登录）: {}", provider.getId(), e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // 登录
    // ------------------------------------------------------------------

    public AuthDto.LoginResponse login(AuthDto.ProviderLoginRequest req, ConsentContext ctx) {
        requireConsent(req.getConsentAgreed());

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

        // 历史数据补齐：本次改造之前注册的服务者，主页里没有对外电话。
        // 登录时顺手把账号手机号绑上，省得再让服务者自己去「编辑主页」里填一遍。
        // 补电话失败绝不阻断登录 —— 登录是主流程，这里只是兜底。
        bindContactPhone(provider, user.getPhone());

        User update = new User();
        update.setId(user.getId());
        update.setLastLoginAt(LocalDateTime.now());
        userMapper.updateById(update);

        // 合规留证：登录页同样要求明示同意（登录即以手机号识别账号）。
        // 每次登录记一条，协议更新后可证明用户是就新版同意的。
        consentService.recordProviderAgreement(user.getId(), req.getPolicyVersion(), ctx);

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

    /**
     * 校验用户是否已明示同意《用户服务协议》和《隐私政策》。
     *
     * <p>⚠️ DTO 上的 {@code @AssertTrue} <b>不能</b>单独依赖：JSR-380 规定
     * {@code @AssertTrue} 对 null 值判定为<b>合法</b>，所以「整个字段不传」
     * 能绕过注解校验 —— 而「不传」正是恶意客户端的做法。
     * 这里再显式判一次，null 与 false 一律拒绝。</p>
     */
    private void requireConsent(Boolean consentAgreed) {
        if (!Boolean.TRUE.equals(consentAgreed)) {
            throw BizException.of(ResultCode.PARAM_ERROR,
                    "请先阅读并同意《用户服务协议》和《隐私政策》");
        }
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
