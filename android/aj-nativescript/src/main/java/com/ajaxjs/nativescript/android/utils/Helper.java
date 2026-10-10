package com.ajaxjs.android.utils;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.util.Log;
import android.widget.Toast;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * Android 平台常用能力辅助类。
 */
public class Helper {
    /**
     * 本工具类统一使用的 Android 日志标签。
     */
    public final static String TAG = "AJ_HELPER";

    /**
     * 复制文本到粘贴板
     *
     * @param context Context
     * @param text    The text to copy
     */
    public static void copyToClipboard(Context context, String text) {
        ClipData clip = ClipData.newPlainText("Label", text);  // "Label" 是标签名，可自定义
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        clipboard.setPrimaryClip(clip);
    }

    /**
     * 提示消息
     *
     * @param cxt 用于创建 Toast 的上下文
     * @param msg 消息
     */
    public static void toast(Context cxt, String msg) {
        Toast.makeText(cxt, msg, Toast.LENGTH_SHORT).show();
    }

    /**
     * Check the internet if it is available
     *
     * @return true = available
     */
    public static boolean isNetworkAvailable() {
        try {
            InetAddress inetAddress = InetAddress.getByName("www.baidu.com");
            return inetAddress != null;
        } catch (UnknownHostException e) {
            Log.e(TAG, "UnknownHostException", e);
            return false;
        }
    }

    /**
     * 判断当前默认网络是否已连接并通过系统联网验证。
     *
     * @param context 应用或页面上下文
     * @return 存在已验证互联网能力时返回 {@code true}
     */
    public static boolean isInternetAvailable(Context context) {
        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        Network network = cm.getActiveNetwork();

        if (network == null)
            return false;

        NetworkCapabilities nc = cm.getNetworkCapabilities(network);

        return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    /**
     * 获取当前手机系统的主要语言代码 (Android 7.0+)
     * 注意：此方法假设你在 Android 7.0+ 上运行，省略了版本检查。
     *
     * @param context 应用上下文
     * @return 主要语言的 ISO 639-1 代码 (例如 "en", "zh", "ja")
     * 如果无法获取则返回 null
     */
    public static String getSystemLanguage(Context context) {
        if (context == null)
            return null;

        Configuration config = context.getResources().getConfiguration();
        Locale primaryLocale = config.getLocales().get(0);// get(0) 获取用户设置的首选语言列表中的第一个（即主要语言）
        /*
         如果你也需要国家/地区代码或完整的语言标签：
         String countryCode = primaryLocale.getCountry(); // e.g., "US", "CN"
         String languageTag = primaryLocale.toLanguageTag(); // e.g., "en-US", "zh-CN"
         */
        return primaryLocale == null ? null : primaryLocale.getLanguage();  // 获取 ISO 639-1 语言代码
    }

    /**
     * 检查当前系统主题是否为暗黑模式 (Dark Mode / Night Mode)
     * 示例用法 (通常在 Activity 或 Application 中)
     * boolean darkModeEnabled = ThemeHelper.isDarkMode(getApplicationContext());
     * if (darkModeEnabled) {
     * Log.d("Theme", "System is in Dark Mode");
     * // Apply dark theme styles if needed
     * } else {
     * Log.d("Theme", "System is in Light Mode");
     * // Apply light theme styles if needed
     * }
     *
     * @param context 应用上下文
     * @return true 表示当前是暗黑模式，false 表示是浅色模式 (Light Mode)
     * 如果 context 为 null，则返回 false
     */
    public static boolean isDarkMode(Context context) {
        if (context == null)  // 如果 context 为 null，无法确定，通常认为是浅色模式
            return false;

        Configuration configuration = context.getResources().getConfiguration();
        // 获取 uiMode 的值
        int currentNightMode = configuration.uiMode & Configuration.UI_MODE_NIGHT_MASK;

        // 判断是否为暗黑模式
        // Configuration.UI_MODE_NIGHT_YES 表示暗黑模式
        // Configuration.UI_MODE_NIGHT_NO 表示非暗黑模式（浅色模式）
        // Configuration.UI_MODE_NIGHT_UNDEFINED 表示未定义（通常也视为浅色模式）

        return currentNightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    /**
     * 获取应用的版本名称 (Version Name)
     *
     * @param context 应用上下文
     * @return 版本名称字符串，如果获取失败则返回 null
     */
    public static String getVersionName(Context context) {
        try {
            PackageManager packageManager = context.getPackageManager();
            // getPackageName() 获取当前应用的包名
            PackageInfo packageInfo = packageManager.getPackageInfo(context.getPackageName(), 0);

            return packageInfo.versionName; // 返回版本名称
        } catch (PackageManager.NameNotFoundException e) {
            // 如果找不到包名对应的包信息，则抛出异常
            Log.e(TAG, "Unable to find package info for package: " + context.getPackageName(), e);
            return null; // 或者抛出异常，取决于你的错误处理策略
        }
    }

    /**
     * 获取应用的版本代码 (Version Code)
     *
     * @param context 应用上下文
     * @return 版本代码整数，如果获取失败则返回 -1
     */
    public static int getVersionCode(Context context) {
        try {
            PackageManager packageManager = context.getPackageManager();
            PackageInfo packageInfo = packageManager.getPackageInfo(context.getPackageName(), 0);

            // 注意：在 API Level 28 (Android 9 Pie) 之前，versionCode 是 int 类型
            // 从 API Level 28 开始，为了支持更大的版本号，引入了 long 类型的 longVersionCode
            // 如果目标 API >= 28，最好使用 longVersionCode
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                return (int) packageInfo.getLongVersionCode(); // 强制转换为 int，注意潜在溢出风险
                // 更安全的做法是返回 long，但 int 通常是足够的：
                // return Math.toIntExact(packageInfo.getLongVersionCode()); // 如果值大于 Integer.MAX_VALUE 会抛出 ArithmeticException
            } else
                return packageInfo.versionCode; // API < 28 时使用 int versionCode
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "Unable to find package info for package: " + context.getPackageName(), e);
            return -1; // 错误时返回 -1 或其他约定的错误值
        }
    }
}
