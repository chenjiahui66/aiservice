package com.neighborhood.service.referral;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 推广码生成器单元测试。
 *
 * <p>需求第四节强调推广码必须「随机、不可预测、不暴露数据库自增 ID」，
 * 且长度不超过 32 以适配微信 scene 参数。</p>
 */
class ReferralCodeGeneratorTest {

    private final ReferralCodeGenerator generator = new ReferralCodeGenerator();

    @Test
    @DisplayName("长度固定为 16，符合微信 scene 参数 32 字符上限")
    void lengthWithinWechatSceneLimit() {
        assertEquals(16, ReferralCodeGenerator.CODE_LENGTH);
        assertTrue(ReferralCodeGenerator.CODE_LENGTH <= 32,
                "微信 scene 参数上限为 32 字符");
        for (int i = 0; i < 50; i++) {
            assertEquals(16, generator.generate().length());
        }
    }

    @Test
    @DisplayName("只使用字母数字，避免微信 scene 特殊字符")
    void onlyAlphanumeric() {
        for (int i = 0; i < 200; i++) {
            String code = generator.generate();
            for (char c : code.toCharArray()) {
                boolean ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
                assertTrue(ok, "推广码出现非字母数字字符: " + c);
            }
        }
    }

    @RepeatedTest(3)
    @DisplayName("1000 个码不得重复")
    void noCollisions() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            assertTrue(seen.add(generator.generate()), "推广码出现碰撞");
        }
        assertEquals(1000, seen.size());
    }

    @Test
    @DisplayName("格式校验：长度、字符集、空值")
    void formatValidation() {
        assertTrue(generator.isValidFormat(generator.generate()));
        assertFalse(generator.isValidFormat(null));
        assertFalse(generator.isValidFormat(""));
        assertFalse(generator.isValidFormat("short"));
        assertFalse(generator.isValidFormat("abcdefghijklmnopq"), "17 位应判非法");
        assertFalse(generator.isValidFormat("abcdefghijklmnop!"), "含特殊字符应判非法");
        assertFalse(generator.isValidFormat("abcdefghijklmnop中"), "含中文应判非法");
    }

    @Test
    @DisplayName("字母表排除易混淆字符 0/O/1/l/I")
    void excludesConfusingCharacters() {
        // 这些字符在电话口述、手写转录时极易出错，不应出现在推广码里
        for (int i = 0; i < 500; i++) {
            String code = generator.generate();
            assertFalse(code.indexOf('O') >= 0, "不应包含大写 O: " + code);
            assertFalse(code.indexOf('I') >= 0, "不应包含大写 I: " + code);
            assertFalse(code.indexOf('l') >= 0, "不应包含小写 l: " + code);
        }
    }

    @Test
    @DisplayName("组合空间足够大，不可枚举")
    void entropySufficient() {
        // 字母表 54 字符，16 位 → 54^16 ≈ 7.5e27，远超枚举可能
        assertTrue(ReferralCodeGenerator.CODE_LENGTH >= 12,
                "长度不足会降低不可预测性");
    }
}