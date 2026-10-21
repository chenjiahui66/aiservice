package com.neighborhood.service.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.neighborhood.service.entity.UserConsent;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户协议同意记录 Mapper。
 */
@Mapper
public interface UserConsentMapper extends BaseMapper<UserConsent> {
}
