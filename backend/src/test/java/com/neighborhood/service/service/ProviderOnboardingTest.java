package com.neighborhood.service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ConsentContext;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.AdminDto;
import com.neighborhood.service.dto.AuthDto;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ServiceItem;
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
import com.neighborhood.service.security.JwtProperties;
import com.neighborhood.service.security.JwtTokenProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 「注册即通过 + 电话默认值 + 服务项目 JSON 列」三条新规则的回归测试。
 *
 * <p>背景：</p>
 * <ol>
 *   <li>服务者注册原先要走人工审核，客户扫码会撞上 41005。现在改成注册即通过，
 *       出问题的由平台在后台「停用」处理。</li>
 *   <li>对外联系电话以前要服务者自己在「编辑主页」里手填，实际上没人填 ——
 *       客户在主页上打不了电话。现在默认取账号手机号，但允许改成别的号码。</li>
 *   <li>后台「添加服务类型」一直报错：管理端表单每次都带上 formFields / bookingRules，
 *       值可能是空串，而这两列是 MySQL 的 JSON 列，空串直接触发
 *       {@code ERROR 3140 Invalid JSON text: "The document is empty."}。</li>
 * </ol>
 */
class ProviderOnboardingTest {

    // ==================================================================
    // 1. 注册即通过
    // ==================================================================

    @Test
    @DisplayName("注册即通过：不再落「待审核」，注册完就能对外接单")
    void registerIsApprovedImmediately() {
        ProviderMapper providerMapper = mock(ProviderMapper.class);
        doAnswer(inv -> {
            ((Provider) inv.getArgument(0)).setId(25L);
            return 1;
        }).when(providerMapper).insert(any(Provider.class));

        ProviderAuthService service = newProviderAuthService(providerMapper, mock(ServicePageMapper.class));

        AuthDto.RegisterRequest req = new AuthDto.RegisterRequest();
        req.setPhone("13800000001");
        req.setPassword("test123456");
        req.setRealName("张师傅");
        req.setServiceArea("阳光小区");
        req.setConsentAgreed(true);
        req.setPolicyVersion("v1.0");

        var resp = service.register(req, ConsentContext.empty());

        ArgumentCaptor<Provider> captor = ArgumentCaptor.forClass(Provider.class);
        verify(providerMapper).insert(captor.capture());
        assertEquals(AuditStatus.APPROVED, captor.getValue().getAuditStatus(),
                "注册必须直接通过审核，否则新服务者永远见不到自己的主页");
        assertEquals(AuditStatus.APPROVED.name(), resp.getAuditStatus());
    }

    @Test
    @DisplayName("注册时主页就带上注册手机号：客户立刻能打电话")
    void registerBindsPhoneToHomepage() {
        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ProviderAuthService service = newProviderAuthService(mock(ProviderMapper.class), servicePageMapper);

        AuthDto.RegisterRequest req = new AuthDto.RegisterRequest();
        req.setPhone("13800000001");
        req.setPassword("test123456");
        req.setRealName("张师傅");
        req.setServiceArea("阳光小区");
        req.setConsentAgreed(true);
        req.setPolicyVersion("v1.0");

        service.register(req, ConsentContext.empty());

        ArgumentCaptor<ServicePage> captor = ArgumentCaptor.forClass(ServicePage.class);
        verify(servicePageMapper).insert(captor.capture());
        assertEquals("13800000001", captor.getValue().getContactPhone(),
                "服务者不会自己去填电话，必须在注册时就写上，否则客户打不了电话");
        assertEquals(EnabledStatus.ENABLED, captor.getValue().getContactVisible());
    }

    // ==================================================================
    // 2. 电话：默认值 + 可改
    // ==================================================================

    @Test
    @DisplayName("主页没填电话时，下发给服务者的默认是账号手机号")
    void homepagePhoneFallsBackToAccountPhone() {
        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ServicePage page = new ServicePage();
        page.setId(7L);
        page.setProviderId(25L);
        page.setDisplayName("张师傅");
        page.setContactPhone(null);
        when(servicePageMapper.selectOne(any())).thenReturn(page);

        ServicePageService service = new ServicePageService(
                servicePageMapper, providerMapperWithPhone("13800000001"), userMapperWithPhone("13800000001"));

        ProviderDto.ServicePageVO vo = service.getMine(25L);
        assertEquals("13800000001", vo.getContactPhone(),
                "空号码必须回落到账号手机号，前端输入框直接就有内容");
    }

    @Test
    @DisplayName("服务者改成别的号码时，以他填的为准，不被账号手机号覆盖")
    void customPhoneIsKept() {
        ServicePageMapper servicePageMapper = mock(ServicePageMapper.class);
        ServicePage page = new ServicePage();
        page.setId(7L);
        page.setProviderId(25L);
        page.setDisplayName("张师傅");
        page.setContactPhone("13800000001");
        when(servicePageMapper.selectOne(any())).thenReturn(page);

        ServicePageService service = new ServicePageService(
                servicePageMapper, providerMapperWithPhone("13800000001"), userMapperWithPhone("13800000001"));

        ProviderDto.ServicePageVO req = new ProviderDto.ServicePageVO();
        req.setDisplayName("张师傅");
        req.setEnabled(true);
        req.setContactVisible(true);
        req.setContactPhone("13911112222");
        service.update(25L, req);

        ArgumentCaptor<ServicePage> captor = ArgumentCaptor.forClass(ServicePage.class);
        verify(servicePageMapper).updateById(captor.capture());
        assertEquals("13911112222", captor.getValue().getContactPhone(),
                "服务者主动改的号码必须保留，不能被账号手机号覆盖");
    }

    // ==================================================================
    // 3. 后台服务项目：JSON 列
    // ==================================================================

    @Test
    @DisplayName("新增服务项目时 formFields / bookingRules 传空串不再报错")
    void createServiceItemWithBlankJson() {
        ServiceItemMapper itemMapper = mock(ServiceItemMapper.class);
        AtomicReference<ServiceItem> saved = new AtomicReference<>();
        doAnswer(inv -> {
            ServiceItem item = inv.getArgument(0);
            item.setId(99L);
            saved.set(item);
            return 1;
        }).when(itemMapper).insert(any(ServiceItem.class));
        when(itemMapper.selectById(any())).thenAnswer(inv -> saved.get());

        AdminService service = newAdminService(itemMapper);

        AdminDto.ServiceItemSaveRequest req = new AdminDto.ServiceItemSaveRequest();
        req.setName("上门代扔垃圾");
        req.setUnitDesc("次");
        req.setFormFields("");
        req.setBookingRules("");
        req.setEnabled(true);

        var vo = service.saveServiceItem(null, req);
        assertNotNull(vo);
        assertNull(vo.getFormFields(),
                "空串必须归一化成 null；原样写进 JSON 列会报 3140 Invalid JSON text");
        assertNull(vo.getBookingRules());
    }

    @Test
    @DisplayName("新增服务项目时非法 JSON 报业务错误，而不是 500")
    void createServiceItemWithBrokenJson() {
        AdminService service = newAdminService(mock(ServiceItemMapper.class));

        AdminDto.ServiceItemSaveRequest req = new AdminDto.ServiceItemSaveRequest();
        req.setName("上门代扔垃圾");
        req.setFormFields("{这不是JSON");

        BizException e = assertThrows(BizException.class, () -> service.saveServiceItem(null, req));
        assertEquals(ResultCode.PARAM_ERROR.getCode(), e.getCode());
    }

    @Test
    @DisplayName("新增服务项目时名称为空被拦下")
    void createServiceItemWithoutName() {
        AdminService service = newAdminService(mock(ServiceItemMapper.class));

        AdminDto.ServiceItemSaveRequest req = new AdminDto.ServiceItemSaveRequest();
        req.setName("   ");

        BizException e = assertThrows(BizException.class, () -> service.saveServiceItem(null, req));
        assertEquals(ResultCode.PARAM_ERROR.getCode(), e.getCode());
    }

    @Test
    @DisplayName("主页模板页只提交 JSON 两项时，不会把服务名称刷成 null")
    void updateOnlyJsonKeepsOtherFields() {
        ServiceItemMapper itemMapper = mock(ServiceItemMapper.class);
        ServiceItem existing = new ServiceItem();
        existing.setId(99L);
        existing.setName("上门代扔垃圾");
        existing.setUnitDesc("次");
        existing.setFormFields("[]");
        when(itemMapper.selectById(99L)).thenReturn(existing);

        AdminService service = newAdminService(itemMapper);

        AdminDto.ServiceItemSaveRequest req = new AdminDto.ServiceItemSaveRequest();
        req.setFormFields("[{\"key\":\"customerName\"}]");
        req.setBookingRules("{\"advanceDays\":7}");

        var vo = service.saveServiceItem(99L, req);
        assertEquals("上门代扔垃圾", vo.getName(),
                "模板页只提交 JSON 两项，不能把名称刷掉");
        assertEquals("[{\"key\":\"customerName\"}]", vo.getFormFields());
    }

    // ==================================================================
    // 辅助
    // ==================================================================

    private ProviderAuthService newProviderAuthService(ProviderMapper providerMapper,
                                                       ServicePageMapper servicePageMapper) {
        UserMapper userMapper = mock(UserMapper.class);
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

        return new ProviderAuthService(userMapper, providerMapper, servicePageMapper,
                mock(ReferralCodeMapper.class), mock(ConsentService.class), passwordEncoder,
                jwtTokenProvider, jwtProperties, generator);
    }

    private ProviderMapper providerMapperWithPhone(String phone) {
        ProviderMapper providerMapper = mock(ProviderMapper.class);
        Provider provider = new Provider();
        provider.setId(25L);
        provider.setUserId(9L);
        provider.setRealName("张师傅");
        when(providerMapper.selectById(25L)).thenReturn(provider);
        return providerMapper;
    }

    private UserMapper userMapperWithPhone(String phone) {
        UserMapper userMapper = mock(UserMapper.class);
        User user = new User();
        user.setId(9L);
        user.setPhone(phone);
        when(userMapper.selectById(9L)).thenReturn(user);
        return userMapper;
    }

    private AdminService newAdminService(ServiceItemMapper itemMapper) {
        OrderMapper orderMapper = mock(OrderMapper.class);
        when(orderMapper.selectCount(any())).thenReturn(0L);
        CustomerMapper customerMapper = mock(CustomerMapper.class);
        when(customerMapper.selectCount(any())).thenReturn(0L);

        return new AdminService(
                mock(ProviderMapper.class),
                mock(UserMapper.class),
                orderMapper,
                customerMapper,
                itemMapper,
                mock(ServicePageMapper.class),
                mock(ComplaintMapper.class),
                mock(OperationLogMapper.class),
                mock(SystemSettingMapper.class),
                mock(ReferralCodeService.class),
                mock(OrderService.class),
                new ObjectMapper());
    }
}
