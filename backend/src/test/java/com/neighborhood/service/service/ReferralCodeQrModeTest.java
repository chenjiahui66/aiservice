package com.neighborhood.service.service;

import com.neighborhood.service.entity.ReferralCode;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.enums.QrMode;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OrderMapper;
import com.neighborhood.service.mapper.ReferralCodeMapper;
import com.neighborhood.service.mapper.SystemSettingMapper;
import com.neighborhood.service.referral.ReferralCodeGenerator;
import com.neighborhood.service.wechat.QrCodeResult;
import com.neighborhood.service.wechat.QrStorage;
import com.neighborhood.service.wechat.WechatProperties;
import com.neighborhood.service.wechat.WxMaCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 推广码的「二维码模式标记」回归测试。
 *
 * <p><b>合规红线</b>：开发降级二维码带醒目水印，<b>绝不能</b>被标记成
 * 「真实微信小程序码」—— 否则页面会提示「扫码可直接打开本页」，
 * 而客户扫到的其实是个占位图。</p>
 *
 * <p>曾经的 bug：判定写成 {@code QrMode.REAL.isReal() || "REAL".equals(mode)}，
 * 而 {@code QrMode.REAL.isReal()} 恒为 true（REAL == REAL），
 * 于是降级码也被写成 REAL。之前没暴露是因为那时二维码只能手动生成，
 * 没人点就没人踩；加了「注册即自动出码」之后每次注册都会踩到。</p>
 */
class ReferralCodeQrModeTest {

    private ReferralCodeMapper referralCodeMapper;
    private WxMaCodeService wxMaCodeService;
    private ReferralCodeService service;

    @BeforeEach
    void setUp() {
        referralCodeMapper = mock(ReferralCodeMapper.class);
        wxMaCodeService = mock(WxMaCodeService.class);

        WechatProperties properties = new WechatProperties();
        properties.setScenePage("pages/provider/index");

        service = new ReferralCodeService(
                referralCodeMapper,
                mock(ReferralCodeGenerator.class),
                wxMaCodeService,
                properties,
                mock(QrStorage.class),
                mock(ProviderService.class),
                mock(OrderMapper.class),
                mock(CustomerMapper.class),
                mock(SystemSettingMapper.class));
    }

    @Test
    @DisplayName("生成开发降级码时，qr_mode 必须记 DEV，不能记 REAL")
    void devQrMustNotBeMarkedReal() {
        when(referralCodeMapper.selectOne(any())).thenReturn(existingCode());
        when(wxMaCodeService.generate(anyString(), anyInt())).thenReturn(result("DEV"));

        service.generateQr(25L, 430, null);

        ArgumentCaptor<ReferralCode> captor = ArgumentCaptor.forClass(ReferralCode.class);
        verify(referralCodeMapper).updateById(captor.capture());
        assertEquals(QrMode.DEV, captor.getValue().getQrMode(),
                "降级码带水印，标记成 REAL 就是把占位图当成真小程序码对外发");
    }

    @Test
    @DisplayName("生成真实小程序码时，qr_mode 记 REAL")
    void realQrMarkedReal() {
        when(referralCodeMapper.selectOne(any())).thenReturn(existingCode());
        when(wxMaCodeService.generate(anyString(), anyInt())).thenReturn(result("REAL"));

        service.generateQr(25L, 430, null);

        ArgumentCaptor<ReferralCode> captor = ArgumentCaptor.forClass(ReferralCode.class);
        verify(referralCodeMapper).updateById(captor.capture());
        assertEquals(QrMode.REAL, captor.getValue().getQrMode());
    }

    private ReferralCode existingCode() {
        ReferralCode code = new ReferralCode();
        code.setId(1L);
        code.setProviderId(25L);
        code.setReferralCode("ABC1234567890123");
        code.setStatus(EnabledStatus.ENABLED);
        code.setQrMode(QrMode.DEV);
        return code;
    }

    private QrCodeResult result(String mode) {
        return QrCodeResult.builder()
                .image(new byte[]{1, 2, 3})
                .imageKey("key.png")
                .mode(mode)
                .page("pages/provider/index")
                .scene("ABC1234567890123")
                .notice("n")
                .build();
    }
}
