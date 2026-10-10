package com.neighborhood.service.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.neighborhood.service.common.BizException;
import com.neighborhood.service.common.ResultCode;
import com.neighborhood.service.entity.Provider;
import com.neighborhood.service.entity.User;
import com.neighborhood.service.enums.AuditStatus;
import com.neighborhood.service.enums.EnabledStatus;
import com.neighborhood.service.mapper.ProviderMapper;
import com.neighborhood.service.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 服务者档案查询与审核状态判断。
 *
 * <p>「能否公开展示主页 / 能否接收新预约」的唯一判定入口，
 * 避免各处重复写 if 造成口径不一致。</p>
 */
@Service
@RequiredArgsConstructor
public class ProviderService {

    private final ProviderMapper providerMapper;
    private final UserMapper userMapper;

    public Provider getByProviderId(Long providerId) {
        if (providerId == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        Provider provider = providerMapper.selectById(providerId);
        if (provider == null) {
            throw BizException.of(ResultCode.PROVIDER_NOT_FOUND);
        }
        return provider;
    }

    public Provider getByUserId(Long userId) {
        return providerMapper.selectOne(Wrappers.<Provider>lambdaQuery()
                .eq(Provider::getUserId, userId));
    }

    public User getUserById(Long userId) {
        User user = userId == null ? null : userMapper.selectById(userId);
        if (user == null) {
            throw BizException.of(ResultCode.UNAUTHORIZED);
        }
        return user;
    }

    // ---------------- 状态判定 ----------------

    /** 审核是否通过。 */
    public boolean isApproved(Provider provider) {
        return provider.getAuditStatus() != null && provider.getAuditStatus().isApproved();
    }

    /** 账号/主页是否启用。 */
    public boolean isEnabled(Provider provider) {
        return provider.getEnabled() != null && provider.getEnabled().isEnabled();
    }

    /**
     * 校验服务者是否可以对外接单。
     *
     * <p>分别抛出可区分的错误码，让小程序端能给客户展示准确文案：
     * 未过审 / 已驳回 / 已暂停 / 已停用。</p>
     */
    public void assertCanAcceptOrder(Provider provider) {
        AuditStatus audit = provider.getAuditStatus();
        if (audit == null || audit == AuditStatus.PENDING) {
            throw BizException.of(ResultCode.PROVIDER_PENDING_AUDIT);
        }
        if (audit == AuditStatus.REJECTED) {
            throw BizException.of(ResultCode.PROVIDER_AUDIT_REJECTED,
                    provider.getAuditRemark() != null ? provider.getAuditRemark() : "服务者审核未通过");
        }
        if (audit == AuditStatus.SUSPENDED || !isEnabled(provider)) {
            throw BizException.of(ResultCode.PROVIDER_DISABLED);
        }
        // users 表被禁用时同样不能接单
        User user = userMapper.selectById(provider.getUserId());
        if (user == null || user.getStatus() == EnabledStatus.DISABLED) {
            throw BizException.of(ResultCode.ACCOUNT_DISABLED);
        }
    }
}