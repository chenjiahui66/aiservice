package com.neighborhood.service.service;

import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.entity.ServiceItem;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ServiceItemMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 「服务者自己勾选服务类目」的回归测试。
 *
 * <p>背景：服务项目原先是「平台模板对所有服务者一律可见」——不管张师傅做不做
 * 「上门取件寄件」，主页上都挂着这一项。一个人不可能提供十几项服务，
 * 主页（以及分享出去的推广码主页）只该出现他真正提供的那几项。</p>
 *
 * <p>锁死的规则：</p>
 * <ol>
 *   <li>只能勾选<b>平台后台维护</b>的类目，服务者不能自建；</li>
 *   <li>取消勾选只是把记录置为停用，<b>不删除</b>，所以能随时加回来；</li>
 *   <li>加回来时恢复<b>同一条</b>记录，id 不变，历史订单引用不悬空；</li>
 *   <li>主页展示内容实时取平台模板；平台停用某类目后不再展示；</li>
 *   <li>客户只能下单该服务者真正勾选在提供的项目。</li>
 * </ol>
 */
class ServiceItemSelectionTest {

    private ServiceItemMapper itemMapper;
    private ServiceItemService service;

    @BeforeEach
    void setUp() {
        itemMapper = mock(ServiceItemMapper.class);
        service = new ServiceItemService(itemMapper);
    }

    // ==================================================================
    // 1. 只能选平台维护的类目
    // ==================================================================

    @Test
    @DisplayName("勾选平台类目：派生出一条自己的记录，指向平台模板")
    void selectCreatesOwnRecord() {
        ServiceItem tpl = template(1L, "上门代扔垃圾");
        when(itemMapper.selectById(1L)).thenReturn(tpl);
        doAnswer(inv -> {
            ((ServiceItem) inv.getArgument(0)).setId(50L);
            return 1;
        }).when(itemMapper).insert(any(ServiceItem.class));

        service.select(25L, 1L);

        ArgumentCaptor<ServiceItem> captor = ArgumentCaptor.forClass(ServiceItem.class);
        verify(itemMapper).insert(captor.capture());
        ServiceItem mine = captor.getValue();
        assertEquals(25L, mine.getProviderId());
        assertEquals(1L, mine.getTemplateId());
        assertEquals(EnabledStatus.ENABLED, mine.getEnabled());
        assertEquals("上门代扔垃圾", mine.getName());
    }

    @Test
    @DisplayName("不能勾选非平台类目：服务者不能自建，也不能用别人的")
    void cannotSelectNonTemplate() {
        ServiceItem other = template(9L, "别人的服务");
        other.setProviderId(99L);
        when(itemMapper.selectById(9L)).thenReturn(other);

        BizException e = assertThrows(BizException.class, () -> service.select(25L, 9L));
        assertEquals(ResultCode.SERVICE_ITEM_NOT_FOUND.getCode(), e.getCode());
        verify(itemMapper, never()).insert(any(ServiceItem.class));
    }

    @Test
    @DisplayName("平台停用的类目不能被勾选")
    void cannotSelectDisabledTemplate() {
        ServiceItem tpl = template(1L, "已停用类目");
        tpl.setEnabled(EnabledStatus.DISABLED);
        when(itemMapper.selectById(1L)).thenReturn(tpl);

        BizException e = assertThrows(BizException.class, () -> service.select(25L, 1L));
        assertEquals(ResultCode.SERVICE_ITEM_DISABLED.getCode(), e.getCode());
    }

    // ==================================================================
    // 2. 取消 / 回加
    // ==================================================================

    @Test
    @DisplayName("取消勾选：只置为停用，不删记录（这样才能加回来）")
    void unselectKeepsRecord() {
        when(itemMapper.selectOne(any())).thenReturn(own(50L, 25L, 1L, EnabledStatus.ENABLED));

        service.unselect(25L, 1L);

        ArgumentCaptor<ServiceItem> captor = ArgumentCaptor.forClass(ServiceItem.class);
        verify(itemMapper).updateById(captor.capture());
        assertEquals(50L, captor.getValue().getId());
        assertEquals(EnabledStatus.DISABLED, captor.getValue().getEnabled());
        verify(itemMapper, never()).deleteById(any(Long.class));
    }

    @Test
    @DisplayName("回加：恢复同一条记录，id 不变（历史订单引用不悬空）")
    void reselectRestoresSameRecord() {
        when(itemMapper.selectOne(any())).thenReturn(own(50L, 25L, 1L, EnabledStatus.DISABLED));
        when(itemMapper.selectById(1L)).thenReturn(template(1L, "上门代扔垃圾"));
        when(itemMapper.selectById(50L)).thenReturn(own(50L, 25L, 1L, EnabledStatus.ENABLED));

        service.select(25L, 1L);

        ArgumentCaptor<ServiceItem> captor = ArgumentCaptor.forClass(ServiceItem.class);
        verify(itemMapper).updateById(captor.capture());
        assertEquals(50L, captor.getValue().getId(), "回加必须复用原记录，不能新建一条新 id");
        assertEquals(EnabledStatus.ENABLED, captor.getValue().getEnabled());
        verify(itemMapper, never()).insert(any(ServiceItem.class));
    }

    @Test
    @DisplayName("重复勾选是幂等的：不重复建记录")
    void selectIsIdempotent() {
        when(itemMapper.selectOne(any())).thenReturn(own(50L, 25L, 1L, EnabledStatus.ENABLED));
        when(itemMapper.selectById(1L)).thenReturn(template(1L, "上门代扔垃圾"));

        service.select(25L, 1L);

        verify(itemMapper, never()).insert(any(ServiceItem.class));
    }

    // ==================================================================
    // 3. 主页展示
    // ==================================================================

    @Test
    @DisplayName("主页只展示自己勾选的项目，且内容实时取平台模板")
    void offeredByUsesOwnSelectionAndTemplateContent() {
        ServiceItem mine = own(50L, 25L, 1L, EnabledStatus.ENABLED);
        mine.setName("旧名字");
        mine.setPriceDesc("旧价格");
        when(itemMapper.selectList(any())).thenReturn(List.of(mine));

        ServiceItem tpl = template(1L, "新名字");
        tpl.setPriceDesc("20 元/次");
        when(itemMapper.selectBatchIds(any())).thenReturn(List.of(tpl));

        List<ServiceItem> list = service.listOfferedBy(25L);

        assertEquals(1, list.size());
        assertEquals(50L, list.get(0).getId(), "对外暴露的 id 必须是服务者自己那条，客户下单靠它");
        assertEquals("新名字", list.get(0).getName(), "内容实时取平台模板，后台改完立刻同步");
        assertEquals("20 元/次", list.get(0).getPriceDesc());
    }

    @Test
    @DisplayName("平台停用某个类目后，服务者主页不再展示它")
    void disabledTemplateIsHidden() {
        ServiceItem mine = own(50L, 25L, 1L, EnabledStatus.ENABLED);
        when(itemMapper.selectList(any())).thenReturn(List.of(mine));

        ServiceItem disabled = template(1L, "平台已停用");
        disabled.setEnabled(EnabledStatus.DISABLED);
        when(itemMapper.selectBatchIds(any())).thenReturn(List.of(disabled));

        assertTrue(service.listOfferedBy(25L).isEmpty());
    }

    @Test
    @DisplayName("没勾选任何类目时，主页服务列表为空")
    void emptyWhenNothingSelected() {
        when(itemMapper.selectList(any())).thenReturn(List.of());
        assertTrue(service.listOfferedBy(25L).isEmpty());
    }

    // ==================================================================
    // 4. 下单校验收紧
    // ==================================================================

    @Test
    @DisplayName("客户不能直接下单平台模板：只能下该服务者勾选的项目")
    void cannotOrderPlatformTemplateDirectly() {
        when(itemMapper.selectById(1L)).thenReturn(template(1L, "平台模板"));

        BizException e = assertThrows(BizException.class, () -> service.requireOrderable(1L, 25L));
        assertEquals(ResultCode.FORBIDDEN.getCode(), e.getCode());
    }

    @Test
    @DisplayName("客户不能下单别人的服务项")
    void cannotOrderOtherProvidersItem() {
        ServiceItem other = own(70L, 99L, 1L, EnabledStatus.ENABLED);
        when(itemMapper.selectById(70L)).thenReturn(other);

        BizException e = assertThrows(BizException.class, () -> service.requireOrderable(70L, 25L));
        assertEquals(ResultCode.FORBIDDEN.getCode(), e.getCode());
    }

    @Test
    @DisplayName("下单自己的、启用中的服务项：放行")
    void canOrderOwnEnabledItem() {
        ServiceItem mine = own(50L, 25L, 1L, EnabledStatus.ENABLED);
        when(itemMapper.selectById(50L)).thenReturn(mine);

        ServiceItem result = service.requireOrderable(50L, 25L);
        assertNotNull(result);
        assertEquals(50L, result.getId());
    }

    // ==================================================================
    // 辅助
    // ==================================================================

    private ServiceItem template(Long id, String name) {
        ServiceItem tpl = new ServiceItem();
        tpl.setId(id);
        tpl.setProviderId(0L);
        tpl.setTemplateId(null);
        tpl.setName(name);
        tpl.setUnitDesc("次");
        tpl.setSortOrder(0);
        tpl.setEnabled(EnabledStatus.ENABLED);
        return tpl;
    }

    private ServiceItem own(Long id, Long providerId, Long templateId, EnabledStatus enabled) {
        ServiceItem mine = new ServiceItem();
        mine.setId(id);
        mine.setProviderId(providerId);
        mine.setTemplateId(templateId);
        mine.setName("我的服务");
        mine.setEnabled(enabled);
        return mine;
    }
}
