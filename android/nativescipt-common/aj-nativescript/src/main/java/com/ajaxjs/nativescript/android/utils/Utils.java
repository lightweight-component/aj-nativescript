package com.ajaxjs.nativescript.android.utils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.security.SecureRandom;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * 时间、随机字符串和 Base64 文本编码工具。
 */
public class Utils {
    /**
     * 将 UTF-8 文本编码为标准 Base64；不换行，保留所需的等号填充。
     * Base64 是编码，不提供加密保护。
     *
     * @param text 原始文本，不能为空引用；允许空字符串。
     * @return 标准 Base64 字符串；空文本返回空字符串。
     * @throws IllegalArgumentException text 为 null。
     */
    public static String encodeBase64(String text) {
        if (text == null)
            throw new IllegalArgumentException("Base64 编码文本不能为 null。");

        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 将标准 Base64 解码为 UTF-8 文本；不自动去除空白，不接受 URL-safe 字符表。
     * 允许省略末尾等号填充；非 UTF-8 二进制数据应使用字节数组解码接口。
     *
     * @param encoded Base64 字符串，不能为空引用；允许空字符串。
     * @return 解码后的文本；空输入返回空字符串。
     * @throws IllegalArgumentException 输入为 null、Base64 格式无效或解码后不是有效 UTF-8。
     */
    public static String decodeBase64(String encoded) {
        if (encoded == null)
            throw new IllegalArgumentException("Base64 解码文本不能为 null。");

        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Base64 格式无效。");
        }

        try {
            return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            throw new IllegalArgumentException("Base64 解码结果不是有效的 UTF-8 文本。");
        }
    }

    /**
     * 获取当前本地时间并格式化。
     *
     * @return 格式为 {@code yyyy-MM-dd HH:mm:ss} 的时间文本
     */
    public static String now() {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        return LocalDateTime.now().format(formatter);
    }

    /**
     * 生成随机字符串时使用的字符表。
     */
    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    /**
     * 进程级安全随机数生成器。
     */
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * 生成指定长度的大小写字母和数字随机字符串。
     *
     * @param length 字符串长度；应为非负数
     * @return 随机字符串
     */
    public static String generateRandomString(int length) {
        StringBuilder sb = new StringBuilder(length);

        for (int i = 0; i < length; i++) {
            int index = RANDOM.nextInt(CHARACTERS.length());
            sb.append(CHARACTERS.charAt(index));
        }

        return sb.toString();
    }
}
