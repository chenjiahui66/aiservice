package com.neighborhood.service.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.neighborhood.service.common.FlexibleLocalDateTimeDeserializer;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** 客户台账 DTO。客户按「服务者—客户」关系维护。 */
public final class CustomerDto {

    private CustomerDto() {
    }

    @Data
    public static class CustomerVO {
        private Long id;
        private String name;
        private String phone;
        private String community;
        private String address;
        private String remark;
        private LocalDateTime firstServiceAt;
        private LocalDateTime lastServiceAt;
        /** 下次计划服务时间（复购计划） */
        private LocalDateTime nextServiceAt;
        private Integer orderCount;
        private LocalDateTime createdAt;
    }

    @Data
    public static class CustomerQuery {
        /** 姓名或手机号关键词 */
        private String keyword;
        private Integer page = 1;
        private Integer size = 20;
    }

    @Data
    public static class CustomerUpdateRequest {
        @Size(max = 20, message = "客户称呼过长")
        private String name;

        @Pattern(regexp = "^$|^1[3-9]\\d{9}$|^[0-9]{7,8}$", message = "联系电话格式不正确")
        private String phone;

        @Size(max = 60)
        private String community;

        @Size(max = 200)
        private String address;

        @Size(max = 500, message = "客户备注过长")
        private String remark;

        /**
         * 复购计划：下次服务时间。
         *
         * <p>UI 侧是日期选择器，只能给出 {@code 2026-10-25} 这样的纯日期，
         * 所以这里用容错反序列化：纯日期按当天 00:00:00 处理，
         * 也照常接受完整的 ISO 日期时间。</p>
         */
        @JsonDeserialize(using = FlexibleLocalDateTimeDeserializer.class)
        private LocalDateTime nextServiceAt;
    }

    @Data
    public static class CustomerDetailVO {
        private CustomerVO customer;
        /** 该客户的历史订单 */
        private List<OrderDto.OrderVO> orders;
    }
}