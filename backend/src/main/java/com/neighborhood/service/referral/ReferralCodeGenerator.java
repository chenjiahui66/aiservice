package com.neighborhood.service.referral;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * 推广码生成器。
 *
 * <p>要求：随机、不可预测、<b>不暴露数据库自增 ID</b>。
 * 因此这里不使用任何自增/哈希(id) 方案，只用 {@link SecureRandom} 从固定字母表取随机串。</p>
 *
 * <p>字母表限定为 {@code [0-9a-zA-Z]}，长度 16，约 62^16 ≈ 4.7×10^28 组合，
 * 既满足微信小程序码 scene 参数「不超过 32 字符、仅限字母数字下划线横线」的限制，
 * 也保证无法被枚举猜测。</p>
 */
@Component
public class ReferralCodeGenerator {

    /** 微信 scene 参数允许的最大长度，留足余量 */
    public static final int CODE_LENGTH = 16;

    /** 去除 0/O、1/l/I 等易混淆字符之外的纯字母数字，规避用户口述/手输错误 */
    private static final char[] ALPHABET =
            "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();

    private final SecureRandom random = new SecureRandom();

    /**
     * 生成一个新的推广码。
     *
     * @return 16 位不可预测字符串
     */
    public String generate() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    /**
     * 校验推广码格式是否合法。仅做字符集与长度校验，不代表该码存在或有效。
     */
    public boolean isValidFormat(String referralCode) {
        if (referralCode == null || referralCode.length() != CODE_LENGTH) {
            return false;
        }
        for (char c : referralCode.toCharArray()) {
            boolean allowed = (c >= '0' && c <= '9')
                    || (c >= 'a' && c <= 'z')
                    || (c >= 'A' && c <= 'Z');
            if (!allowed) {
                return false;
            }
        }
        return true;
    }
}