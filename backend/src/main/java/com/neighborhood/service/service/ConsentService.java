package com.neighborhood.service.service;

import com.neighborhood.service.common.ConsentContext;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.entity.UserConsent;
import com.neighborhood.service.mapper.UserConsentMapper;
import com.neighborhood.service.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 用户协议 / 隐私政策同意的记录与留证。
 *
 * <p>微信小程序审核明确要求：收集手机号等个人信息前，必须明示告知并取得用户授权同意。
 * 后端的作用是<b>把这次同意变成可核查的记录</b> —— 小程序上的勾选框是入口，
 * 真正能应对核查的是这张表。</p>
 *
 * <p>三条规则：</p>
 * <ol>
 *   <li>每次同意动作<b>新增</b>一条记录，不覆盖旧记录 —— 协议更新后要能证明用户就新版重新同意过；</li>
 *   <li>IP 与 User-Agent 由服务端从请求里取，不接受客户端上报；</li>
 *   <li>同时把「当前生效的同意状态」回写到 users 表，方便查询与后台展示。</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConsentService {

    /** 主体类型：服务者 */
    public static final String USER_TYPE_PROVIDER = "PROVIDER";
    /** 主体类型：客户（匿名扫码下单） */
    public static final String USER_TYPE_CUSTOMER = "CUSTOMER";
    /** 同意对象：用户服务协议 */
    public static final String SUBJECT_AGREEMENT = "AGREEMENT";
    /** 同意对象：隐私政策 */
    public static final String SUBJECT_PRIVACY = "PRIVACY";

    /** 当前协议版本。协议内容有实质变更时递增，前端会带上自己读到的版本号。 */
    public static final String CURRENT_POLICY_VERSION = "v1.0";

    private final UserConsentMapper consentMapper;
    private final UserMapper userMapper;

    /**
     * 服务者同意《用户服务协议》与《隐私政策》。
     *
     * <p>两条记录都写：审核要求「明确告知收集用户信息的使用目的、方式和用途」，
     * 用户服务协议与隐私政策是两份文件，各自留证更清楚。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void recordProviderAgreement(Long userId, String policyVersion, ConsentContext ctx) {
        String version = normalizeVersion(policyVersion);
        record(userId, USER_TYPE_PROVIDER, SUBJECT_AGREEMENT, null, version, true, ctx);
        record(userId, USER_TYPE_PROVIDER, SUBJECT_PRIVACY, null, version, true, ctx);

        User update = new User();
        update.setId(userId);
        update.setConsentAt(LocalDateTime.now());
        update.setPolicyVersion(version);
        userMapper.updateById(update);
    }

    /** 客户（匿名扫码下单）同意《隐私政策》。 */
    @Transactional(rollbackFor = Exception.class)
    public void recordCustomerPrivacy(String orderId, String policyVersion, ConsentContext ctx) {
        record(null, USER_TYPE_CUSTOMER, SUBJECT_PRIVACY, orderId,
                normalizeVersion(policyVersion), true, ctx);
    }

    /**
     * 写一条同意记录。
     *
     * <p>协议版本以<b>客户端读到的版本</b>为准：客户端没带就记当前版本。
     * 不强制与服务器版本一致，避免「后端升了协议、小程序还没发版」直接把用户挡在门外。</p>
     */
    public void record(Long userId,
                       String userType,
                       String subjectType,
                       String subjectId,
                       String policyVersion,
                       boolean agreed,
                       ConsentContext ctx) {
        UserConsent entity = new UserConsent();
        entity.setUserId(userId);
        entity.setUserType(userType);
        entity.setSubjectType(subjectType);
        entity.setSubjectId(subjectId);
        entity.setPolicyVersion(policyVersion);
        entity.setAgreed(agreed ? 1 : 0);
        entity.setClientIp(ctx == null ? null : ctx.clientIp());
        entity.setUserAgent(ctx == null ? null : ctx.userAgent());
        entity.setAgreedAt(LocalDateTime.now());
        consentMapper.insert(entity);

        log.info("记录协议同意: userType={} userId={} subject={} version={} ip={}",
                userType, userId, subjectType, policyVersion, entity.getClientIp());
    }

    private String normalizeVersion(String version) {
        if (version == null || version.isBlank()) {
            return CURRENT_POLICY_VERSION;
        }
        return version.length() > 16 ? version.substring(0, 16) : version;
    }
}
