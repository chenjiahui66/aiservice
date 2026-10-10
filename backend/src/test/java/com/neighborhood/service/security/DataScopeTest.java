package com.neighborhood.service.security;

import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 数据归属校验单元测试。
 *
 * <p>需求第八条：「禁止通过修改订单 ID 或客户 ID 越权读取其他服务者的数据」。
 * 这条规则是整个多服务者隔离的最后一道闸门，必须有独立测试兜住。</p>
 */
class DataScopeTest {

    private static final Long MY_PROVIDER = 100L;
    private static final Long OTHER_PROVIDER = 200L;

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void loginAsProvider(Long providerId) {
        AuthPrincipal principal = new AuthPrincipal(
                1L, providerId, "13800138000", "测试服务者", AuthPrincipal.Role.PROVIDER);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @Test
    @DisplayName("未登录时取 providerId 应报未认证")
    void anonymousGetsRejected() {
        BizException e = assertThrows(BizException.class, DataScope::currentProviderId);
        assertEquals(ResultCode.UNAUTHORIZED.getCode(), e.getCode());
    }

    @Test
    @DisplayName("providerId 必须来自 token，不能来自请求参数")
    void providerIdComesFromToken() {
        loginAsProvider(MY_PROVIDER);
        assertEquals(MY_PROVIDER, DataScope.currentProviderId());
    }

    @Test
    @DisplayName("归属自己的资源应放行")
    void ownResourceAllowed() {
        loginAsProvider(MY_PROVIDER);
        assertDoesNotThrowAccess(() -> DataScope.assertOwnedByQuery(MY_PROVIDER));
    }

    @Test
    @DisplayName("访问他人资源应被拒绝")
    void othersResourceRejected() {
        loginAsProvider(MY_PROVIDER);
        BizException e = assertThrows(BizException.class,
                () -> DataScope.assertOwnedByQuery(OTHER_PROVIDER));
        assertEquals(ResultCode.FORBIDDEN.getCode(), e.getCode());
    }

    @Test
    @DisplayName("资源不存在与越权必须返回同一错误码，不能被用来探测")
    void notFoundAndForbiddenIndistinguishable() {
        loginAsProvider(MY_PROVIDER);
        BizException notFound = assertThrows(BizException.class,
                () -> DataScope.assertOwnedByQuery(null));
        BizException forbidden = assertThrows(BizException.class,
                () -> DataScope.assertOwnedByQuery(OTHER_PROVIDER));
        assertEquals(notFound.getCode(), forbidden.getCode(),
                "不存在的资源与他人资源必须返回相同错误码，否则可被用来枚举他人数据");
        assertEquals(forbidden.getMessage(), notFound.getMessage(),
                "两者提示文案也应一致");
    }

    @Test
    @DisplayName("管理员访问服务者业务接口应被拒绝")
    void adminCannotAccessProviderData() {
        AuthPrincipal admin = new AuthPrincipal(9L, null, "admin", "管理员", AuthPrincipal.Role.ADMIN);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(admin, null, List.of()));

        assertThrows(BizException.class, DataScope::currentProviderId);
        assertThrows(BizException.class, DataScope::requireProviderRole);

        // 管理员走自己的校验通道
        assertEquals(9L, DataScope.currentAdminId());
    }

    @Test
    @DisplayName("服务者不得使用管理员通道")
    void providerCannotUseAdminChannel() {
        loginAsProvider(MY_PROVIDER);
        assertThrows(BizException.class, DataScope::currentAdminId);
    }

    @Test
    @DisplayName("principal 载体区分双身份")
    void principalRoles() {
        AuthPrincipal provider = new AuthPrincipal(1L, 5L, "u", "n", AuthPrincipal.Role.PROVIDER);
        AuthPrincipal admin = new AuthPrincipal(2L, null, "a", "b", AuthPrincipal.Role.ADMIN);
        assertTrue(provider.isProvider());
        assertNotNull(provider.getProviderId());
        assertTrue(admin.isAdmin());
        assertNull(admin.getProviderId());
    }

    private static void assertDoesNotThrowAccess(Runnable r) {
        r.run();
    }
}