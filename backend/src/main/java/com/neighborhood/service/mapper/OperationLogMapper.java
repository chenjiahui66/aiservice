package com.neighborhood.service.mapper;

import com.neighborhood.service.entity.OperationLog;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** OperationLog 数据访问。继承 BaseMapper 获得单表 CRUD 与分页能力。 */
@Mapper
public interface OperationLogMapper extends BaseMapper<OperationLog> {
}
