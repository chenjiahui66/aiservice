package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.entity.Customer;
import com.neighborhood.service.entity.Order;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ReferralCode;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.enums.OrderStatus;
import com.neighborhood.service.enums.QrMode;
import com.neighborhood.service.mapper.CustomerMapper;
import com.neighborhood.service.mapper.OrderMapper;
import com.neighborhood.service.mapper.ReferralCodeMapper;
import com.neighborhood.service.referral.ReferralCodeGenerator;
import com.neighborhood.service.wechat.QrCodeResult;
import com.neighborhood.service.wechat.QrStorage;
import com.neighborhood.service.wechat.WechatProperties;
import com.neighborhood.service.wechat.WxMaCodeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 推广码服务 —— 系统核心。
 *
 * <p>不变量：
 * <ol>
 *   <li>一个服务者默认只对应一条推广码记录（{@code uk_referral_code} 保证全局唯一码值）；</li>
 *   <li>码值随机生成，不可预测，不暴露自增 ID；</li>
 *   <li>码与服务者的映射只由本服务维护，<b>不存在任何按 providerId 直连的公开查询路径</b>；</li>
 *   <li>访问量与预约量只在真实行为发生时累加，无任何伪造入口。</li>
 * </ol>
 * </p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReferralCodeService {

    private static final int UNIQUE_RETRY = 5;

    private final ReferralCodeMapper referralCodeMapper;
    private final ReferralCodeGenerator generator;
    private final WxMaCodeService wxMaCodeService;
    private final WechatProperties wechatProperties;
    private final QrStorage qrStorage;
    private final ProviderService providerService;
    private final OrderMapper orderMapper;
    private final CustomerMapper customerMapper;

    // ------------------------------------------------------------------
    // 获取 / 创建
    // ------------------------------------------------------------------

    /**
     * 获取服务者的推广码，不存在则创建。幂等。
     *
     * <p>唯一索引冲突时重试，而不是先查再插——后者在高并发下必然产生重复。</p>
     */
    @Transactional
    public ReferralCode getOrCreateForProvider(Long providerId) {
        ReferralCode existing = findByProviderId(providerId);
        if (existing != null) {
            return existing;
        }
        for (int i = 0; i < UNIQUE_RETRY; i++) {
            ReferralCode code = new ReferralCode();
            code.setProviderId(providerId);
            code.setReferralCode(generator.generate());
            code.setStatus(EnabledStatus.ENABLED);
            code.setQrMode(QrMode.DEV);
            code.setQrScenePage(wechatProperties.getScenePage());
            code.setVisitCount(0);
            code.setBookingCount(0);
            code.setChannel("DIRECT");
            try {
                referralCodeMapper.insert(code);
                log.info("为服务者 {} 创建推广码: {}", providerId, code.getReferralCode());
                return code;
            } catch (org.springframework.dao.DuplicateKeyException e) {
                // 极小概率随机碰撞，换一个重试
                log.warn("推广码碰撞，重试第 {} 次", i + 1);
            }
        }
        throw BizException.of(ResultCode.SYSTEM_ERROR, "推广码生成失败，请重试");
    }

    public ReferralCode findByProviderId(Long providerId) {
        return referralCodeMapper.selectOne(Wrappers.<ReferralCode>lambdaQuery()
                .eq(ReferralCode::getProviderId, providerId)
                .last("LIMIT 1"));
    }

    /**
     * 按码值查询<b>启用中</b>的推广码。
     *
     * <p>不存在 → 41001；已停用 → 41002。两种情况必须给客户明确不同的提示。</p>
     */
    public ReferralCode requireActiveByCode(String referralCode) {
        if (!generator.isValidFormat(referralCode)) {
            throw BizException.of(ResultCode.REFERRAL_CODE_NOT_FOUND);
        }
        ReferralCode code = findByCode(referralCode);
        if (code == null) {
            throw BizException.of(ResultCode.REFERRAL_CODE_NOT_FOUND);
        }
        if (code.getStatus() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.REFERRAL_CODE_DISABLED);
        }
        return code;
    }

    public ReferralCode findByCode(String referralCode) {
        if (referralCode == null || referralCode.isBlank()) {
            return null;
        }
        return referralCodeMapper.selectOne(Wrappers.<ReferralCode>lambdaQuery()
                .eq(ReferralCode::getReferralCode, referralCode.trim())
                .last("LIMIT 1"));
    }

    // ------------------------------------------------------------------
    // 真实统计
    // ------------------------------------------------------------------

    /** 客户通过该码打开主页时累加访问量。用 setSql 做原子自增，避免并发下丢计数。 */
    public void markVisit(ReferralCode code) {
        UpdateWrapper<ReferralCode> uw = new UpdateWrapper<>();
        uw.eq("id", code.getId())
                .setSql("visit_count = visit_count + 1")
                .set("last_visit_at", LocalDateTime.now());
        referralCodeMapper.update(null, uw);
    }

    /** 客户通过该码成功下单时累加预约量。 */
    public void markBooking(Long referralCodeId) {
        if (referralCodeId == null) {
            return;
        }
        UpdateWrapper<ReferralCode> uw = new UpdateWrapper<>();
        uw.eq("id", referralCodeId).setSql("booking_count = booking_count + 1");
        referralCodeMapper.update(null, uw);
    }

    // ------------------------------------------------------------------
    // 二维码
    // ------------------------------------------------------------------

    /**
     * 生成（首次）或重新生成服务者的小程序码。
     *
     * <p>重新生成只刷新二维码图片，<b>不改变码值与服务者的归属关系</b>——
     * 需求明确要求「服务者可以重新生成推广海报，但不能随意篡改归属关系」。</p>
     */
    @Transactional
    public QrCodeResult generateQr(Long providerId, Integer width, String channel) {
        ReferralCode code = getOrCreateForProvider(providerId);
        if (code.getStatus() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.REFERRAL_CODE_DISABLED, "推广码已停用，请先启用后再生成二维码");
        }

        QrCodeResult result = wxMaCodeService.generate(code.getReferralCode(), width == null ? 430 : width);

        ReferralCode update = new ReferralCode();
        update.setId(code.getId());
        update.setQrImageKey(result.getImageKey());
        update.setQrMode(QrMode.REAL.isReal() || "REAL".equals(result.getMode()) ? QrMode.REAL : QrMode.DEV);
        update.setQrScenePage(result.getPage() != null ? result.getPage() : wechatProperties.getScenePage());
        update.setQrGeneratedAt(LocalDateTime.now());
        if (channel != null && !channel.isBlank()) {
            update.setChannel(channel);
        }
        referralCodeMapper.updateById(update);

        log.info("服务者 {} 生成推广码(mode={})", providerId, result.getMode());
        return result;
    }

    public byte[] readQrImage(String imageKey) {
        try {
            return qrStorage.read(imageKey);
        } catch (IOException e) {
            log.error("读取二维码图片失败: {}", imageKey, e);
            return null;
        }
    }

    // ------------------------------------------------------------------
    // VO 装配
    // ------------------------------------------------------------------

    public ProviderDto.ReferralInfoVO buildInfo(Long providerId) {
        ReferralCode code = findByProviderId(providerId);
        Provider provider = providerService.getByProviderId(providerId);

        ProviderDto.ReferralInfoVO vo = new ProviderDto.ReferralInfoVO();
        if (code == null) {
            vo.setQrMode(wxMaCodeService.currentMode());
            vo.setQrModeLabel(QrMode.DEV.getLabel());
            vo.setShareText(buildShareText(null, provider));
            return vo;
        }

        vo.setReferralCodeId(code.getId());
        vo.setReferralCode(code.getReferralCode());
        vo.setStatus(code.getStatus() == null ? null : code.getStatus().name());
        vo.setQrImageKey(code.getQrImageKey());
        vo.setQrImageUrl(code.getQrImageKey() == null ? null : "/api/provider/referral/qr/" + code.getQrImageKey());
        QrMode mode = code.getQrMode() == null ? QrMode.DEV : code.getQrMode();
        vo.setQrMode(mode.name());
        vo.setQrModeLabel(mode.getLabel());
        vo.setQrNotice(mode.isReal()
                ? "真实微信小程序码，扫码可直接打开本页。"
                : "⚠️ 当前为开发降级模式，这不是真实微信小程序码，请勿对外使用。配置 WX_APP_ID / WX_APP_SECRET 后将自动切换。");
        vo.setQrScenePage(code.getQrScenePage());
        vo.setQrGeneratedAt(code.getQrGeneratedAt());
        vo.setChannel(code.getChannel());
        vo.setVisitCount(code.getVisitCount());
        vo.setBookingCount(code.getBookingCount());
        vo.setCreatedAt(code.getCreatedAt());
        vo.setLastVisitAt(code.getLastVisitAt());
        vo.setShareText(buildShareText(code.getReferralCode(), provider));
        return vo;
    }

    /** 全部来自真实库表统计，无任何假数据。 */
    public ProviderDto.ReferralStatsVO buildStats(Long providerId) {
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);

        ProviderDto.ReferralStatsVO vo = new ProviderDto.ReferralStatsVO();
        vo.setTodayBookingCount(toInt(orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId)
                .eq(Order::getBookingDate, today))));
        vo.setWeekBookingCount(toInt(orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId)
                .ge(Order::getBookingDate, weekStart))));
        vo.setTotalBookingCount(toInt(orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId))));
        vo.setCompletedCount(toInt(orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId)
                .eq(Order::getStatus, OrderStatus.COMPLETED))));
        vo.setPendingCount(toInt(orderMapper.selectCount(Wrappers.<Order>lambdaQuery()
                .eq(Order::getProviderId, providerId)
                .in(Order::getStatus,
                        OrderStatus.PENDING_CONFIRM,
                        OrderStatus.CONFIRMED,
                        OrderStatus.SERVING))));
        vo.setTotalCustomers(toInt(customerMapper.selectCount(Wrappers.<Customer>lambdaQuery()
                .eq(Customer::getProviderId, providerId))));

        long total = vo.getTotalBookingCount();
        vo.setCompletionRate(total == 0 ? 0d
                : Math.round(vo.getCompletedCount() * 10000d / total) / 100d);
        return vo;
    }

    private int toInt(Long value) {
        return value == null ? 0 : value.intValue();
    }

    private String buildShareText(String referralCode, Provider provider) {
        String name = provider.getRealName();
        return referralCode == null
                ? name + " 的上门服务主页，打开小程序即可预约。"
                : name + " 的上门服务主页已就绪，打开小程序「邻里服务管家」扫码即可预约。";
    }

    /** 供统计使用：某服务者推广码的真实访问量合计。 */
    public long totalVisits(Long providerId) {
        ReferralCode code = findByProviderId(providerId);
        return code == null || code.getVisitCount() == null ? 0L : code.getVisitCount();
    }
}
