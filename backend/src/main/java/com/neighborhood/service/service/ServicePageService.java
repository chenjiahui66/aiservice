package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.dto.ProviderDto;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.ServicePage;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ProviderMapper;
import com.neighborhood.service.mapper.ServicePageMapper;
import com.neighborhood.service.mapper.UserMapper;
import com.neighborhood.service.security.DataScope;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 服务者个人服务主页维护。
 *
 * <p>主页内容全部来自数据库，前端不得写死任何服务者信息。</p>
 *
 * <p>「对外联系电话」默认用账号手机号（注册 / 登录时写入），但**允许服务者改成别的号码**：
 * 多服务者压根不会主动去填，不给默认值的话客户在主页上就打不了电话；
 * 给默认值之后想换号的人也能自己换。
 * 要不要对外展示由 {@code contactVisible} 开关控制，不展示时号码不对外下发。</p>
 */
@Service
@RequiredArgsConstructor
public class ServicePageService {

    private final ServicePageMapper servicePageMapper;
    private final ProviderMapper providerMapper;
    private final UserMapper userMapper;

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
        // 库里还没填号码时，下发账号手机号作为默认值 —— 前端输入框直接就有内容，
        // 服务者不用手敲一遍，不改的话保存下来也是同一个号。
        vo.setContactPhone(effectiveContactPhone(providerId, page.getContactPhone()));
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
        // 对外联系电话：服务者填了就用他填的；留空则回到账号手机号这个默认值，
        // 不让主页变成「客户看到一个空的联系电话、打不了电话」。
        update.setContactPhone(resolveSavedPhone(providerId, req.getContactPhone()));
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

    /**
 * 取账号手机号。
 *
     * <p>providerId 来自 token，不接受客户端传参；user_id 由 providers 表反查。</p>
     */
    private String accountPhone(Long providerId) {
        Provider provider = providerMapper.selectById(providerId);
        if (provider == null) {
            return null;
        }
        User user = userMapper.selectById(provider.getUserId());
        if (user == null || isBlank(user.getPhone())) {
            return null;
        }
        return user.getPhone();
    }

    /** 下发给前端的对外电话：库里没填就用账号手机号兜底。 */
    private String effectiveContactPhone(Long providerId, String stored) {
        if (!isBlank(stored)) {
            return stored;
        }
        String account = accountPhone(providerId);
        return account != null ? account : stored;
    }

    /** 保存用的对外电话：服务者填了就用他填的，留空则回落到账号手机号。 */
    private String resolveSavedPhone(Long providerId, String submitted) {
        if (!isBlank(submitted)) {
            return submitted.trim();
        }
        return accountPhone(providerId);
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
