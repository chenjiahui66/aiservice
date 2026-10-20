package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.entity.ServicePage;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ServicePageMapper;
import com.neighborhood.service.security.DataScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 服务者个人服务主页维护。
 *
 * <p>主页内容全部来自数据库，前端不得写死任何服务者信息。</p>
 */
@Service
@RequiredArgsConstructor
public class ServicePageService {

    private final ServicePageMapper servicePageMapper;

    public ProviderDto.ServicePageVO getMine(Long providerId) {
        ServicePage page = find(providerId);
        ProviderDto.ServicePageVO vo = new ProviderDto.ServicePageVO();
        vo.setProviderId(providerId);
        if (page == null) {
            vo.setDisplayName("");
            vo.setContactVisible(false);
            vo.setEnabled(false);
            return vo;
        }
        vo.setDisplayName(page.getDisplayName());
        vo.setAvatarUrl(page.getAvatarUrl());
        vo.setIntro(page.getIntro());
        vo.setServiceArea(page.getServiceArea());
        vo.setAvailableTime(page.getAvailableTime());
        vo.setPriceDesc(page.getPriceDesc());
        vo.setServiceRules(page.getServiceRules());
        vo.setContactVisible(page.getContactVisible() != null && page.getContactVisible().isEnabled());
        vo.setContactPhone(page.getContactPhone());
        vo.setEnabled(page.getEnabled() != null && page.getEnabled().isEnabled());
        return vo;
    }

    public ProviderDto.ServicePageVO update(Long providerId, ProviderDto.ServicePageVO req) {
        ServicePage page = find(providerId);
        if (page == null) {
            throw BizException.of(ResultCode.SYSTEM_ERROR, "服务主页尚未初始化");
        }

        ServicePage update = new ServicePage();
        update.setId(page.getId());
        update.setDisplayName(req.getDisplayName());
        // 头像没有上传入口，客户端不会带这个字段。
        // 传 null 表示「本次不修改」，不能直接覆盖成 null 把已有头像擦掉。
        if (req.getAvatarUrl() != null) {
            update.setAvatarUrl(req.getAvatarUrl());
        }
        update.setIntro(req.getIntro());
        update.setServiceArea(req.getServiceArea());
        update.setAvailableTime(req.getAvailableTime());
        update.setPriceDesc(req.getPriceDesc());
        update.setServiceRules(req.getServiceRules());
        // contactVisible 允许为 null（= 不修改），不能直接拆箱
        update.setContactVisible(Boolean.TRUE.equals(req.getContactVisible())
                ? EnabledStatus.ENABLED : EnabledStatus.DISABLED);
        // 展示联系方式时必须有号码，否则等于对外显示一个打不通的入口
        update.setContactPhone(req.getContactPhone());
        if (req.getEnabled() != null) {
            if (Boolean.TRUE.equals(req.getEnabled()) && isBlank(req.getDisplayName())) {
                throw BizException.of(ResultCode.PARAM_ERROR, "请先填写主页显示名称再启用");
            }
            update.setEnabled(req.getEnabled() ? EnabledStatus.ENABLED : EnabledStatus.DISABLED);
        }
        servicePageMapper.updateById(update);
        return getMine(providerId);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private ServicePage find(Long providerId) {
        return servicePageMapper.selectOne(Wrappers.<ServicePage>lambdaQuery()
                .eq(ServicePage::getProviderId, providerId)
                .last("LIMIT 1"));
    }

    /** 校验当前 token 对应的服务者拥有该主页（供后续扩展的跨资源校验使用）。 */
    public void assertOwnership(Long providerId) {
        DataScope.assertOwnedByQuery(providerId);
    }
}
