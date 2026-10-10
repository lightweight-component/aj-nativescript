package com.ajaxjs.android.utils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Random;

/**
 * MQTT 模块使用的时间和随机字符串工具。
 */
public class Utils {
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
     * 进程级伪随机数生成器。
     */
    private static final Random RANDOM = new Random();

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
