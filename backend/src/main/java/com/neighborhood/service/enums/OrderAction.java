package com.neighborhood.service.enums;

import com.baomidou.mybatisplus.annotation.EnumValue;

/** 订单操作动作，所有动作都会写入 order_logs。 */
public enum OrderAction {

    CREATE("CREATE", "创建订单"),
    CONFIRM("CONFIRM", "确认预约"),
    START("START", "开始服务"),
    COMPLETE("COMPLETE", "完成服务"),
    CANCEL("CANCEL", "取消订单"),
    UPDATE_NOTE("UPDATE_NOTE", "更新备注");

    @EnumValue
    private final String code;

    private final String label;

    OrderAction(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }
}