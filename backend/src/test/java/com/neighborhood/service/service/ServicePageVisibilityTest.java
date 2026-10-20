package com.neighborhood.service.service;

import com.neighborhood.service.dto.AdminDto;
import com.neighborhood.service.dto.AuthDto;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ServicePage;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.enums.AuditStatus;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ComplaintMapper;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OperationLogMapper;
import com.neighborhood.service.mapper.OrderMapper;
import com.neighborhood.service.mapper.ProviderMapper;
import com.neighborhood.service.mapper.ReferralCodeMapper;
import com.neighborhood.service.mapper.ServiceItemMapper;
import com.neighborhood.service.mapper.ServicePageMapper;
import com.neighborhood.service.mapper.SystemSettingMapper;
import com.neighborhood.service.mapper.UserMapper;
import com.neighborhood.service.referral.ReferralCodeGenerator;
import com.neighborhood.service.security.AuthPrincipal;
import com.neighborhood.service.security.JwtProperties;
import com.neighborhood.service.security.JwtTokenProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 服务主页「可见性」链路回归测试。
 *
 * <p>背景（真实线上问题）：推广码在服务者<b>注册时</b>就发下去了，但主页当时是关闭状态，
 * 客户扫码只会拿到 41008「该服务主页已关闭」，而「开启主页」开关藏在「编辑主页」里，
 * 服务者基本不会自己去点 —— 死结。</p>
 *
 * <p>这里锁死三条规则，任何一条被改回去都必须让测试变红：</p>
 * <ol>
 *   <li>注册时主页默认开启；</li>
 *   <li>首次审核通过时自动开启主页（存量已注册但没开开关的服务者也能被救回来）；</li>
 *   <li>重复审核不会把服务者自己手动关掉的主页重新打开。</li>
 * </ol>
 */
class ServicePageVisibilityTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // ==================================================================
    // 1. 注册时主页默认开启
    // ==================================================================

    @Test
    @DisplayName("注册时服务主页默认开启：否则注册即发码，客户扫码必然撞上 41008")
    void registerEnablesHomepageByDefault() {
        UserMapper userMapper = mock(UserMapper.class);
        ProviderMapper providerMapper = mock(ProviderMapper.class);
        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ReferralCodeMapper referralCodeMapper = mock(ReferralCodeMapper.class);
        PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
        JwtTokenProvider jwtTokenProvider = mock(JwtTokenProvider.class);
        JwtProperties jwtProperties = mock(JwtProperties.class);
        ReferralCodeGenerator generator = mock(ReferralCodeGenerator.class);

        when(userMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode(any())).thenReturn("$2a$10$hash");
        when(jwtProperties.getProviderExpireMinutes()).thenReturn(10080L);
        when(jwtTokenProvider.generateProviderToken(any(), any(), any(), any())).thenReturn("token");
        when(generator.generate()).thenReturn("CODE12345678");
        doAnswer(inv -> {
            ((User) inv.getArgument(0)).setId(9L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        doAnswer(inv -> {
            ((Provider) inv.getArgument(0)).setId(25L);
            return 1;
        }).when(providerMapper).insert(any(Provider.class));

        ProviderAuthService service = new ProviderAuthService(userMapper, providerMapper, servicePageMapper,
                referralCodeMapper, passwordEncoder, jwtTokenProvider, jwtProperties, generator);

        AuthDto.RegisterRequest req = new AuthDto.RegisterRequest();
        req.setPhone("13800000001");
        req.setPassword("test123456");
        req.setRealName("张师傅");
        req.setServiceArea("阳光小区");

        service.register(req);

        ArgumentCaptor<ServicePage> captor = ArgumentCaptor.forClass(ServicePage.class);
        verify(servicePageMapper).insert(captor.capture());
        ServicePage page = captor.getValue();
        assertNotNull(page);
        assertEquals(EnabledStatus.ENABLED, page.getEnabled(),
                "新注册服务者的主页必须默认开启，否则推广码一发出就是死路");
    }

    // ==================================================================
    // 2. 首次审核通过自动开启主页
    // ==================================================================

    @Test
    @DisplayName("首次审核通过时自动开启主页：存量服务者不必自己去点开关")
    void firstApprovalEnablesHomepage() {
        loginAsAdmin();

        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ServicePage page = new ServicePage();
        page.setId(7L);
        page.setProviderId(25L);
        page.setEnabled(EnabledStatus.DISABLED);
        when(servicePageMapper.selectOne(any())).thenReturn(page);

        AdminService service = newAdminService(servicePageMapper, AuditStatus.PENDING);

        AdminDto.AuditRequest req = new AdminDto.AuditRequest();
        req.setApproved(true);
        req.setRemark("资料齐全");
        service.audit(25L, req);

        ArgumentCaptor<ServicePage> captor = ArgumentCaptor.forClass(ServicePage.class);
        verify(servicePageMapper).updateById(captor.capture());
        assertEquals(EnabledStatus.ENABLED, captor.getValue().getEnabled(),
                "审核通过代表平台已允许其对外服务，主页必须一并打开");
    }

    // ==================================================================
    // 3. 重复审核不动已经关闭的主页
    // ==================================================================

    @Test
    @DisplayName("对已通过审核的服务者重复审核，不重新打开他手动关闭的主页")
    void reApprovalKeepsClosedHomepage() {
        loginAsAdmin();

        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ServicePage page = new ServicePage();
        page.setId(7L);
        page.setProviderId(25L);
        page.setEnabled(EnabledStatus.DISABLED);
        when(servicePageMapper.selectOne(any())).thenReturn(page);

        AdminService service = newAdminService(servicePageMapper, AuditStatus.APPROVED);

        AdminDto.AuditRequest req = new AdminDto.AuditRequest();
        req.setApproved(true);
        req.setRemark("复核");
        // 服务者此前已经是 APPROVED
        service.audit(25L, req);

        verify(servicePageMapper, never()).updateById(any(ServicePage.class));
    }

    // ==================================================================
    // 4. 保存主页的 null 安全
    // ==================================================================

    @Test
    @DisplayName("保存主页时 contactVisible 缺省不报空指针，avatarUrl 不会被清空")
    void updateIsNullSafe() {
        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ServicePage existing = new ServicePage();
        existing.setId(7L);
        existing.setProviderId(25L);
        existing.setDisplayName("张师傅");
        existing.setEnabled(EnabledStatus.ENABLED);
        existing.setAvatarUrl("https://cdn.example.com/a.png");
        when(servicePageMapper.selectOne(any())).thenReturn(existing);

        ServicePageService service = new ServicePageService(servicePageMapper);

        ProviderDto.ServicePageVO vo = new ProviderDto.ServicePageVO();
        vo.setDisplayName("张师傅");
        vo.setEnabled(true);
        // contactVisible 与 avatarUrl 都不传
        service.update(25L, vo);

        ArgumentCaptor<ServicePage> captor = ArgumentCaptor.forClass(ServicePage.class);
        verify(servicePageMapper).updateById(captor.capture());
        ServicePage update = captor.getValue();
        assertNull(update.getAvatarUrl(), "没带 avatarUrl 表示不修改，不能把已有头像擦成 null");
        assertEquals(EnabledStatus.DISABLED, update.getContactVisible(),
                "contactVisible 缺省按「不展示」处理，不能直接拆箱导致 NPE");
        assertEquals(EnabledStatus.ENABLED, update.getEnabled());
    }

    // ==================================================================
    // 辅助
    // ==================================================================

    private AdminService newAdminService(ServicePageMapper servicePageMapper, AuditStatus currentStatus) {
        ProviderMapper providerMapper = mock(ProviderMapper.class);
        Provider provider = new Provider();
        provider.setId(25L);
        provider.setUserId(9L);
        provider.setRealName("张师傅");
        provider.setAuditStatus(currentStatus);
        provider.setEnabled(EnabledStatus.ENABLED);
        when(providerMapper.selectById(25L)).thenReturn(provider);

        // ProviderListVO 里的 orderCount / customerCount 是基本类型 long，
        // selectCount 返回包装类型 Long，Mockito 默认返回 null → 拆箱 NPE，必须显式给 0
        OrderMapper orderMapper = mock(OrderMapper.class);
        when(orderMapper.selectCount(any())).thenReturn(0L);
        CustomerMapper customerMapper = mock(CustomerMapper.class);
        when(customerMapper.selectCount(any())).thenReturn(0L);

        return new AdminService(
                providerMapper,
                mock(UserMapper.class),
                orderMapper,
                customerMapper,
                mock(ServiceItemMapper.class),
                servicePageMapper,
                mock(ComplaintMapper.class),
                mock(OperationLogMapper.class),
                mock(SystemSettingMapper.class),
                mock(ReferralCodeService.class),
                mock(OrderService.class));
    }

    /** 让 SecurityUtils.requireAdminId() 能拿到管理员身份。 */
    private void loginAsAdmin() {
        AuthPrincipal principal = new AuthPrincipal(1L, null, "admin", "平台管理员", AuthPrincipal.Role.ADMIN);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList()));
    }
}
