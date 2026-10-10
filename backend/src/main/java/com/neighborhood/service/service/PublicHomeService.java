package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.PublicDto;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ReferralCode;
import com.neighborhood.service.entity.ServicePage;
import com.neighborhood.service.enums.AuditStatus;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ServicePageMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 公开服务主页查询。
 *
 * <p>唯一入口是推广码：<b>不存在按 providerId 直接查询公开主页的接口</b>，
 * 这样客户侧就不存在「猜 id 就能看别人主页」的路径。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicHomeService {

    private final ReferralCodeService referralCodeService;
    private final ProviderService providerService;
    private final ServicePageMapper servicePageMapper;
    private final ServiceItemService serviceItemService;
    private final ObjectMapper objectMapper;

    /**
     * 客户扫码进入服务主页。
     *
     * <p>按序校验：码有效 → 码启用 → 服务者存在 → 审核通过 → 账号启用 → 主页启用。
     * 每一步失败都有独立错误码，前端可以给出准确的引导文案。</p>
     */
    public PublicDto.ProviderHomeVO getHomeByReferralCode(String referralCode) {
        ReferralCode code = referralCodeService.requireActiveByCode(referralCode);

        Provider provider = providerService.getByProviderId(code.getProviderId());
        // 依次给出可区分的提示，避免只说「无法访问」
        if (provider.getAuditStatus() == null || provider.getAuditStatus() == AuditStatus.PENDING) {
            throw BizException.of(ResultCode.PROVIDER_PENDING_AUDIT);
        }
        if (provider.getAuditStatus() == AuditStatus.REJECTED) {
            throw BizException.of(ResultCode.PROVIDER_AUDIT_REJECTED);
        }
        if (provider.getAuditStatus() == AuditStatus.SUSPENDED
                || !providerService.isEnabled(provider)) {
            throw BizException.of(ResultCode.PROVIDER_DISABLED);
        }

        ServicePage page = findPage(provider.getId());
        if (page == null || page.getEnabled() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.HOMEPAGE_DISABLED);
        }

        // 真实访问统计（客户确实打开了主页）
        referralCodeService.markVisit(code);

        PublicDto.ProviderHomeVO vo = new PublicDto.ProviderHomeVO();
        vo.setReferralCode(code.getReferralCode());
        vo.setProviderId(provider.getId());
        vo.setDisplayName(page.getDisplayName());
        vo.setAvatarUrl(page.getAvatarUrl() != null ? page.getAvatarUrl() : null);
        vo.setIntro(page.getIntro());
        vo.setServiceArea(page.getServiceArea() != null ? page.getServiceArea() : provider.getServiceArea());
        vo.setAvailableTime(page.getAvailableTime());
        vo.setPriceDesc(page.getPriceDesc());
        vo.setServiceRules(page.getServiceRules());

        boolean showContact = page.getContactVisible() != null && page.getContactVisible().isEnabled();
        vo.setContactVisible(showContact);
        vo.setContactPhone(showContact ? page.getContactPhone() : null);

        List<PublicDto.ServiceItemVO> items = serviceItemService.listOfferedBy(provider.getId()).stream()
                .map(serviceItemService::toVO)
                .toList();
        vo.setServiceItems(items);
        vo.setDisclaimer(disclaimer(provider));
        return vo;
    }

    private String disclaimer(Provider provider) {
        return provider.getRealName() + " 为个人服务者，本平台仅提供预约工具，"
                + "服务由服务者本人独立完成，与平台运营方无关。";
    }

    public ServicePage findPage(Long providerId) {
        return servicePageMapper.selectOne(Wrappers.<ServicePage>lambdaQuery()
                .eq(ServicePage::getProviderId, providerId)
                .last("LIMIT 1"));
    }

    /** 读取项目的可预约时间规则；解析失败时回退到宽松默认，避免老数据导致下单全挂。 */
    public JsonNode parseBookingRules(String json) {
        if (json == null || json.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            log.warn("预约规则 JSON 解析失败，回退默认值: {}", e.getMessage());
            return objectMapper.createObjectNode();
        }
    }
}
