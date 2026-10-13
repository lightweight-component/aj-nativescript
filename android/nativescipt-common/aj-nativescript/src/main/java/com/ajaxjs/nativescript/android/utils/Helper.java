package com.ajaxjs.nativescript.android.utils;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.LocaleList;
import android.os.Looper;
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
     * 同步读取系统剪贴板第一个项目的文本，不去除空白。
     *
     * @param context 非空的应用或页面上下文
     * @return 文本；服务不可用、无剪贴内容或无法转换为文本时返回空字符串
     * @throws SecurityException 系统拒绝访问时传播；应在前台响应用户操作调用
     */
    public static String getFromClipboard(Context context) {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null || !clipboard.hasPrimaryClip())
            return "";
        ClipData clip = clipboard.getPrimaryClip();
        if (clip == null || clip.getItemCount() == 0)
            return "";
        CharSequence text = clip.getItemAt(0).coerceToText(context);
        return text == null ? "" : text.toString();
    }

    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());

    /**
     * 提示消息
     *
     * @param cxt 用于创建 Toast 的上下文
     * @param msg 消息
     */
    public static void toast(Context cxt, String msg) {
        if (cxt == null)
            return;

        Context appContext = cxt.getApplicationContext();
        Runnable showToast = () -> Toast.makeText(appContext, msg, Toast.LENGTH_SHORT).show();

        if (Looper.myLooper() == Looper.getMainLooper())
            showToast.run();
        else
            MAIN_HANDLER.post(showToast);
    }

    /**
     * Check the internet if it is available
     *
     * @return true = available
     */
    public static boolean isNetworkAvailable() {
        try {
            return InetAddress.getByName("www.baidu.com") != null;
        } catch (UnknownHostException e) {
            Log.e(TAG, "UnknownHostException", e);
            return false;
        }
    }

    /**
     * 判断当前默认网络是否已连接并通过系统联网验证。
     * <p>宿主须在 AndroidManifest.xml 声明
     * {@code android.permission.ACCESS_NETWORK_STATE}，无需运行时申请。
     * 此方法只查询系统状态，不保证业务服务器可达。</p>
     *
     * @param context 应用或页面上下文
     * @return 存在已验证互联网能力时返回 {@code true}；上下文或服务为空、
     *         没有已验证网络或缺少权限时返回 {@code false}
     */
    public static boolean isInternetAvailable(Context context) {
        if (context == null)
            return false;

        ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null)
            return false;

        try {
            Network network = cm.getActiveNetwork();

            if (network == null)
                return false;

            NetworkCapabilities nc = cm.getNetworkCapabilities(network);

            return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (SecurityException e) {
            Log.e(TAG, "Unable to query network state. Declare android.permission.ACCESS_NETWORK_STATE in the host manifest.", e);
            return false;
        }
    }

    /**
     * 获取传入 Context 的资源配置中的首选语言代码。
     * <p>结果可能受应用独立语言或自定义资源配置影响，不一定等于手机系统语言。
     * 使用 LocaleList API，需要 Android 7.0（API 24）及以上；本项目最低为 Android 8.0。</p>
     *
     * @param context 应用或页面上下文，可为空
     * @return 首选语言代码，例如 {@code en}、{@code zh}、{@code ja}；
     *         不包含地区或文字体系，Context 为空或没有首选语言时返回 {@code null}
     * @see #getSystemLanguage()
     */
    public static String getSystemLanguageByCxt(Context context) {
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
     * 从系统资源配置获取手机系统的首选语言代码，不读取应用 Context 的语言配置。
     * <p>手机可设置多个首选语言，本方法只返回列表中的第一个。
     * 返回 {@code zh} 等语言代码，不区分简体、繁体或地区；
     * 如需完整语言标签，应使用首选 Locale 的 {@code toLanguageTag()}。
     * 需要 Android 7.0（API 24）及以上；本项目最低为 Android 8.0。</p>
     *
     * @return 系统首选语言代码；语言列表为空时返回 {@code null}
     * @see #getSystemLanguageByCxt(Context)
     */
    public static String getSystemLanguage() {
        LocaleList locales = Resources.getSystem().getConfiguration().getLocales();

        if (locales.isEmpty())
            return null;

        return locales.get(0).getLanguage(); // zh、en、ja
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
    public static long getVersionCode(Context context) {
        try {
            PackageManager packageManager = context.getPackageManager();
            PackageInfo packageInfo = packageManager.getPackageInfo(context.getPackageName(), 0);

            // 注意：在 API Level 28 (Android 9 Pie) 之前，versionCode 是 int 类型
            // 从 API Level 28 开始，为了支持更大的版本号，引入了 long 类型的 longVersionCode
            // 如果目标 API >= 28，最好使用 longVersionCode
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                return packageInfo.getLongVersionCode();
            } else
                return packageInfo.versionCode; // API < 28 时使用 int versionCode
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "Unable to find package info for package: " + context.getPackageName(), e);
            return -1; // 错误时返回 -1 或其他约定的错误值
        }
    }
}
