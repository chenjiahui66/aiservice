package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.PublicDto;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ServiceItemMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 服务项目配置服务。
 *
 * <p>「代扔垃圾」不写死在任何页面里：一律通过 {@code service_items} 表驱动。
 * 平台模板 {@code provider_id=0}，服务者可基于模板创建自己的项目（{@code provider_id>0}）。</p>
 */
@Service
@RequiredArgsConstructor
public class ServiceItemService {

    private final ServiceItemMapper serviceItemMapper;

    /**
     * 服务者当前可展示的服务项目 = 平台启用模板 + 自己启用且未被停用的自定义项目。
     */
    public List<ServiceItem> listOfferedBy(Long providerId) {
        return serviceItemMapper.selectList(Wrappers.<ServiceItem>lambdaQuery()
                .and(w -> w.eq(ServiceItem::getProviderId, 0L)
                        .or(o -> o.eq(ServiceItem::getProviderId, providerId)))
                .eq(ServiceItem::getEnabled, EnabledStatus.ENABLED)
                .orderByAsc(ServiceItem::getSortOrder)
                .orderByDesc(ServiceItem::getId));
    }

    /** 平台全部启用模板，供管理员维护与新服务者初始化。 */
    public List<ServiceItem> listTemplates() {
        return serviceItemMapper.selectList(Wrappers.<ServiceItem>lambdaQuery()
                .eq(ServiceItem::getProviderId, 0L)
                .eq(ServiceItem::getEnabled, EnabledStatus.ENABLED)
                .orderByAsc(ServiceItem::getSortOrder));
    }

    /**
     * 解析服务者可下单的项目 id。
     *
     * <p>必须同时满足：项目存在、处于启用状态、属于「平台模板或本服务者」。
     * 否则客户可以下单别人的私有项目，或下单已下架的项目。</p>
     */
    public ServiceItem requireOrderable(Long serviceItemId, Long providerId) {
        if (serviceItemId == null) {
            throw BizException.of(ResultCode.SERVICE_ITEM_NOT_FOUND);
        }
        ServiceItem item = serviceItemMapper.selectById(serviceItemId);
        if (item == null) {
            throw BizException.of(ResultCode.SERVICE_ITEM_NOT_FOUND);
        }
        if (item.getEnabled() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.SERVICE_ITEM_DISABLED);
        }
        if (item.getProviderId() != 0L && !item.getProviderId().equals(providerId)) {
            throw BizException.accessDenied();
        }
        return item;
    }

    public PublicDto.ServiceItemVO toVO(ServiceItem item) {
        PublicDto.ServiceItemVO vo = new PublicDto.ServiceItemVO();
        vo.setId(item.getId());
        vo.setName(item.getName());
        vo.setDescription(item.getDescription());
        vo.setIconUrl(item.getIconUrl());
        vo.setUnitDesc(item.getUnitDesc());
        vo.setPriceDesc(item.getPriceDesc());
        vo.setFormFields(item.getFormFields());
        vo.setBookingRules(item.getBookingRules());
        vo.setNotes(item.getNotes());
        return vo;
    }
}