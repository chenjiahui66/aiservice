package com.neighborhood.service.service;

import com.neighborhood.service.common.ConsentContext;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.entity.UserConsent;
import com.neighborhood.service.mapper.UserConsentMapper;
import com.neighborhood.service.mapper.UserMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * 协议同意留证测试。
 *
 * <p>微信审核要求「收集手机号等个人信息前必须取得用户授权同意」。
 * 光有小程序上的勾选框不够 —— 出了争议要能证明「谁、何时、在哪、就哪个版本
 * 同意了哪份文件」。这些断言就是在守住这条证据链，任何一条被改回去都要让测试变红。</p>
 */
class ConsentServiceTest {

    @Test
    @DisplayName("服务者同意时，服务协议与隐私政策各留一条记录，并回写当前同意状态")
    void providerAgreementRecordsBothSubjects() {
        UserConsentMapper consentMapper = mock(UserConsentMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        ConsentService service = new ConsentService(consentMapper, userMapper);

        service.recordProviderAgreement(25L, "v1.0",
                ConsentContext.of("203.0.113.9", "MicroMessenger/8.0"));

        ArgumentCaptor<UserConsent> captor = ArgumentCaptor.forClass(UserConsent.class);
        verify(consentMapper, times(2)).insert(captor.capture());
        List<UserConsent> records = captor.getAllValues();

        assertEquals(2, records.size());
        assertEquals(ConsentService.SUBJECT_AGREEMENT, records.get(0).getSubjectType());
        assertEquals(ConsentService.SUBJECT_PRIVACY, records.get(1).getSubjectType());
        for (UserConsent r : records) {
            assertEquals(ConsentService.USER_TYPE_PROVIDER, r.getUserType());
            assertEquals(25L, r.getUserId());
            assertEquals("v1.0", r.getPolicyVersion());
            assertEquals(1, r.getAgreed());
            assertEquals("203.0.113.9", r.getClientIp());
            assertNotNull(r.getAgreedAt());
        }

        // 当前同意状态要回写到 users，登录后能一眼看到
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).updateById(userCaptor.capture());
        assertEquals(25L, userCaptor.getValue().getId());
        assertEquals("v1.0", userCaptor.getValue().getPolicyVersion());
        assertNotNull(userCaptor.getValue().getConsentAt());
    }

    @Test
    @DisplayName("客户端没带协议版本时按当前版本记录，不留空 —— 否则留证指向不明的版本")
    void versionFallsBackToCurrent() {
        UserConsentMapper consentMapper = mock(UserConsentMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        ConsentService service = new ConsentService(consentMapper, userMapper);

        service.recordProviderAgreement(25L, null, ConsentContext.empty());

        ArgumentCaptor<UserConsent> captor = ArgumentCaptor.forClass(UserConsent.class);
        verify(consentMapper, times(2)).insert(captor.capture());
        for (UserConsent r : captor.getAllValues()) {
            assertEquals(ConsentService.CURRENT_POLICY_VERSION, r.getPolicyVersion());
        }
    }

    @Test
    @DisplayName("客户下单的隐私同意记在订单号上，匿名主体没有 userId")
    void customerConsentLinkedToOrder() {
        UserConsentMapper consentMapper = mock(UserConsentMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        ConsentService service = new ConsentService(consentMapper, userMapper);

        service.recordCustomerPrivacy("NO20261021000001", "v1.0",
                ConsentContext.of("198.51.100.7", "Mozilla/5.0"));

        ArgumentCaptor<UserConsent> captor = ArgumentCaptor.forClass(UserConsent.class);
        verify(consentMapper).insert(captor.capture());
        UserConsent record = captor.getValue();

        assertEquals(ConsentService.USER_TYPE_CUSTOMER, record.getUserType());
        assertEquals(ConsentService.SUBJECT_PRIVACY, record.getSubjectType());
        assertEquals("NO20261021000001", record.getSubjectId());
        assertEquals(null, record.getUserId());
        assertEquals(1, record.getAgreed());
    }

    @Test
    @DisplayName("User-Agent 超长时截断，避免写库超长报错")
    void longUserAgentIsTruncated() {
        UserConsentMapper consentMapper = mock(UserConsentMapper.class);
        UserMapper userMapper = mock(UserMapper.class);
        ConsentService service = new ConsentService(consentMapper, userMapper);

        String longUa = "x".repeat(900);
        service.record(25L, ConsentService.USER_TYPE_PROVIDER,
                ConsentService.SUBJECT_PRIVACY, null, "v1.0", true,
                ConsentContext.of("1.2.3.4", longUa));

        ArgumentCaptor<UserConsent> captor = ArgumentCaptor.forClass(UserConsent.class);
        verify(consentMapper).insert(captor.capture());
        assertEquals(500, captor.getValue().getUserAgent().length());
    }
}
