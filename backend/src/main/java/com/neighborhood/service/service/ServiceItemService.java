package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.dto.PublicDto;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ServiceItemMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 服务项目配置服务。
 *
 * <p>「代扔垃圾」不写死在任何页面里：一律通过 {@code service_items} 表驱动。
 * 平台模板 {@code provider_id=0}（后台维护），服务者基于模板创建自己的项目
 * （{@code provider_id>0} 且 {@code template_id} 指向平台模板）。</p>
 *
 * <p><b>服务者能提供哪几项，是服务者自己勾的</b>：一个人不可能提供十几项服务，
 * 主页上只该出现他真正提供的那几项。勾选 = 平台模板派生出一条自己的记录
 * （{@code enabled=ENABLED}）；取消 = 把这条记录置为 {@code enabled=DISABLED}
 * 而<b>不删除</b> —— 记录留着才能随时「回加」，且 id 不变，
 * 历史订单里的 {@code service_item_id} 不会指向一条查不到的记录。</p>
 *
 * <p>展示内容<b>实时取平台模板</b>：后台改了类目名称/价格/说明，
 * 所有服务者的主页立刻同步，符合「类目由平台统一维护」的语义。</p>
 */
@Service
@RequiredArgsConstructor
public class ServiceItemService {

    private final ServiceItemMapper serviceItemMapper;

    // ------------------------------------------------------------------
    // 平台模板（后台维护）
    // ------------------------------------------------------------------

    /** 平台全部模板（含已停用），供管理端维护。 */
    public List<ServiceItem> listAllTemplates() {
        return serviceItemMapper.selectList(Wrappers.<ServiceItem>lambdaQuery()
                .eq(ServiceItem::getProviderId, 0L)
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

    // ------------------------------------------------------------------
    // 服务者勾选
    // ------------------------------------------------------------------

    /**
     * 服务者当前可展示的服务项目 = <b>他自己勾选中</b>的那些。
     *
     * <p>只返回 {@code provider_id=本服务者 且 enabled=ENABLED} 的记录；
     * 平台模板不再无条件出现在所有人的主页上。</p>
     */
    public List<ServiceItem> listOfferedBy(Long providerId) {
        List<ServiceItem> mine = serviceItemMapper.selectList(Wrappers.<ServiceItem>lambdaQuery()
                .eq(ServiceItem::getProviderId, providerId)
                .eq(ServiceItem::getEnabled, EnabledStatus.ENABLED)
                .orderByAsc(ServiceItem::getSortOrder)
                .orderByDesc(ServiceItem::getId));
        if (mine.isEmpty()) {
            return List.of();
        }

        Map<Long, ServiceItem> templates = loadEnabledTemplates(mine);
        List<ServiceItem> result = new ArrayList<>(mine.size());
        for (ServiceItem item : mine) {
            ServiceItem tpl = templates.get(item.getTemplateId());
            if (tpl == null) {
                // 平台已停用 / 删除了这个类目 → 不再对外展示
                continue;
            }
            result.add(mergeTemplate(item, tpl));
        }
        return result;
    }

    /** 取出这些记录对应的、平台仍在启用的模板。 */
    private Map<Long, ServiceItem> loadEnabledTemplates(List<ServiceItem> mine) {
        List<Long> ids = mine.stream()
                .map(ServiceItem::getTemplateId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<Long, ServiceItem> map = new HashMap<>();
        for (ServiceItem tpl : serviceItemMapper.selectBatchIds(ids)) {
            if (tpl.getEnabled() == EnabledStatus.ENABLED) {
                map.put(tpl.getId(), tpl);
            }
        }
        return map;
    }

    /**
     * 用平台模板的最新内容覆盖服务者记录的展示字段。
     *
     * <p>只覆盖展示用的字段（名称/描述/图标/单位/价格/表单/规则/备注/排序），
     * {@code id} 与 {@code providerId} 保持服务者自己那条 —— 客户下单时
     * 提交的就是这个 id。</p>
     */
    private ServiceItem mergeTemplate(ServiceItem mine, ServiceItem tpl) {
        mine.setName(tpl.getName());
        mine.setDescription(tpl.getDescription());
        mine.setIconUrl(tpl.getIconUrl());
        mine.setUnitDesc(tpl.getUnitDesc());
        mine.setPriceDesc(tpl.getPriceDesc());
        mine.setFormFields(tpl.getFormFields());
        mine.setBookingRules(tpl.getBookingRules());
        mine.setNotes(tpl.getNotes());
        mine.setSortOrder(tpl.getSortOrder());
        return mine;
    }

    /**
     * 服务者勾选一个平台类目。
     *
     * <p>⚠️ 只接受<b>平台维护的类目</b>（{@code provider_id=0}）：
     * 服务者不能自建类目，也不能把别人的类目拿来用。</p>
     *
     * <p>幂等：已勾选则原样返回；之前取消过（{@code enabled=DISABLED}）则恢复同一条记录，
     * 不新建 —— 记录 id 稳定，历史订单引用不会悬空。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public ServiceItem select(Long providerId, Long templateId) {
        ServiceItem tpl = serviceItemMapper.selectById(templateId);
        if (tpl == null || tpl.getProviderId() == null || tpl.getProviderId() != 0L) {
            throw BizException.of(ResultCode.SERVICE_ITEM_NOT_FOUND, "该服务类目不存在，或不是平台维护的类目");
        }
        if (tpl.getEnabled() != EnabledStatus.ENABLED) {
            throw BizException.of(ResultCode.SERVICE_ITEM_DISABLED, "该服务类目已被平台停用，无法添加");
        }

        ServiceItem existing = findOwn(providerId, templateId);
        if (existing != null) {
            if (existing.getEnabled() == EnabledStatus.ENABLED) {
                return existing;
            }
            ServiceItem update = new ServiceItem();
            update.setId(existing.getId());
            update.setEnabled(EnabledStatus.ENABLED);
            serviceItemMapper.updateById(update);
            return serviceItemMapper.selectById(existing.getId());
        }

        ServiceItem mine = new ServiceItem();
        mine.setProviderId(providerId);
        mine.setTemplateId(templateId);
        // 存一份模板快照：模板万一被删了，主页还能显示这条自己的内容
        mine.setName(tpl.getName());
        mine.setDescription(tpl.getDescription());
        mine.setIconUrl(tpl.getIconUrl());
        mine.setUnitDesc(tpl.getUnitDesc());
        mine.setPriceDesc(tpl.getPriceDesc());
        mine.setFormFields(tpl.getFormFields());
        mine.setBookingRules(tpl.getBookingRules());
        mine.setNotes(tpl.getNotes());
        mine.setSortOrder(tpl.getSortOrder());
        mine.setEnabled(EnabledStatus.ENABLED);
        serviceItemMapper.insert(mine);
        return mine;
    }

    /**
     * 服务者取消勾选。
     *
     * <p>只置 {@code enabled=DISABLED}，<b>不删记录</b>：之后还能原样加回来，
     * 历史订单的引用也不会断。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void unselect(Long providerId, Long templateId) {
        ServiceItem existing = findOwn(providerId, templateId);
        if (existing == null || existing.getEnabled() != EnabledStatus.ENABLED) {
            return;
        }
        ServiceItem update = new ServiceItem();
        update.setId(existing.getId());
        update.setEnabled(EnabledStatus.DISABLED);
        serviceItemMapper.updateById(update);
    }

    /**
     * 新服务者初始化：默认勾选全部平台启用类目。
     *
     * <p>默认全选是为了不倒退现有体验 —— 新注册的服务者立刻就能接单，
     * 他再去「我的服务类目」里把不提供的取消掉。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void selectAllTemplates(Long providerId) {
        for (ServiceItem tpl : listTemplates()) {
            try {
                select(providerId, tpl.getId());
            } catch (Exception ignored) {
                // 单个类目失败不能影响注册主流程
            }
        }
    }

    /**
     * 确保服务者的类目已初始化。
     *
     * <p>判断依据是「有没有自己的记录（含已取消的）」，不是「有没有启用中的」——
     * 否则服务者故意取消到一项不剩，下次登录又被全量塞回来，
     * 等于他永远没法把主页清空。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void ensureInitialized(Long providerId) {
        Long count = serviceItemMapper.selectCount(Wrappers.<ServiceItem>lambdaQuery()
                .eq(ServiceItem::getProviderId, providerId));
        if (count != null && count > 0) {
            return;
        }
        selectAllTemplates(providerId);
    }

    /** 服务者管理页的列表：平台全部类目 + 我是否在提供。 */
    public List<ProviderDto.MyServiceItemVO> listManageView(Long providerId) {
        Map<Long, ServiceItem> own = new HashMap<>();
        for (ServiceItem item : serviceItemMapper.selectList(Wrappers.<ServiceItem>lambdaQuery()
                .eq(ServiceItem::getProviderId, providerId))) {
            if (item.getTemplateId() != null) {
                own.put(item.getTemplateId(), item);
            }
        }

        List<ProviderDto.MyServiceItemVO> list = new ArrayList<>();
        for (ServiceItem tpl : listAllTemplates()) {
            ProviderDto.MyServiceItemVO vo = new ProviderDto.MyServiceItemVO();
            vo.setTemplateId(tpl.getId());
            vo.setName(tpl.getName());
            vo.setDescription(tpl.getDescription());
            vo.setIconUrl(tpl.getIconUrl());
            vo.setUnitDesc(tpl.getUnitDesc());
            vo.setPriceDesc(tpl.getPriceDesc());
            vo.setNotes(tpl.getNotes());
            vo.setSortOrder(tpl.getSortOrder());
            vo.setPlatformEnabled(tpl.getEnabled() == EnabledStatus.ENABLED);

            ServiceItem mine = own.get(tpl.getId());
            vo.setMyItemId(mine == null ? null : mine.getId());
            vo.setSelected(mine != null && mine.getEnabled() == EnabledStatus.ENABLED);
            list.add(vo);
        }
        return list;
    }

    /** 找服务者自己针对某个模板派生出的那条记录（含已取消的）。 */
    private ServiceItem findOwn(Long providerId, Long templateId) {
        return serviceItemMapper.selectOne(Wrappers.<ServiceItem>lambdaQuery()
                .eq(ServiceItem::getProviderId, providerId)
                .eq(ServiceItem::getTemplateId, templateId)
                .last("LIMIT 1"));
    }

    /**
     * 解析服务者可下单的项目 id。
     *
     * <p>必须同时满足：项目存在、处于启用状态、<b>属于该服务者自己</b>。
     * 不再接受平台模板 id —— 客户只能下单这个服务者真正勾选在提供的项目，
     * 否则就能下单他主页上根本没提供的服务。</p>
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
        if (!Objects.equals(item.getProviderId(), providerId)) {
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
