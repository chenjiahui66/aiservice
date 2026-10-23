package com.neighborhood.service.common;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonMappingException;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * 容错的 {@link LocalDateTime} 反序列化。
 *
 * <p><b>为什么需要它</b>：UI 上凡是「只能选日期」的控件（微信 {@code <Picker mode="date">}、
 * {@code <input type="date">}、桌面端日期选择器），拿到的都是纯日期字符串
 * {@code "2026-10-25"}。而 DTO 里同一个字段往往声明成 {@link LocalDateTime}，
 * Jackson 默认只认带时间部分的 ISO 串，于是解析失败 →
 * {@code HttpMessageNotReadableException} → 前端只能看到一句
 * 「请求体格式不正确」，完全不知道是哪个字段、收到的到底是什么。</p>
 *
 * <p>实例：客户档案的「下次复购日期」。</p>
 *
 * <p>本类接受的格式：</p>
 * <ul>
 *   <li>{@code 2026-10-25} → 当天 00:00:00</li>
 *   <li>{@code 2026-10-25 10:30} / {@code 2026-10-25 10:30:00}</li>
 *   <li>{@code 2026-10-25T10:30:00}（标准 ISO，带毫秒也可以）</li>
 *   <li>{@code null} 或空串 → null（表示「没填」，交给业务层判断）</li>
 * </ul>
 *
 * <p>只在「UI 粒度比 DTO 粗」的地方使用它；本来就该带时间的字段别挂，
 * 否则等于把一个类型错误降级成静默截断。</p>
 */
public class FlexibleLocalDateTimeDeserializer extends JsonDeserializer<LocalDateTime> {

    private static final DateTimeFormatter SPACE_MINUTE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter SPACE_SECOND = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public LocalDateTime deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
        String raw = p.getValueAsString();
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return null;
        }

        // 纯日期 → 当天零点。UI 只能选日期时走这一条。
        if (s.length() == 10) {
            try {
                return LocalDate.parse(s).atStartOfDay();
            } catch (DateTimeParseException ignored) {
                // 不是合法日期，落到末尾统一报错
            }
        }

        // 空格分隔（Excel 导出的常见形态）
        if (s.length() == 16 && s.charAt(10) == ' ') {
            try {
                return LocalDateTime.parse(s, SPACE_MINUTE);
            } catch (DateTimeParseException ignored) {
                // 同上
            }
        }
        if (s.length() == 19 && s.charAt(10) == ' ') {
            try {
                return LocalDateTime.parse(s, SPACE_SECOND);
            } catch (DateTimeParseException ignored) {
                // 同上
            }
        }

        // 标准 ISO
        try {
            return LocalDateTime.parse(s);
        } catch (DateTimeParseException e) {
            throw JsonMappingException.from(p,
                    "时间格式不正确：" + raw + "（支持 2026-10-25 或 2026-10-25T10:30:00）");
        }
    }
}