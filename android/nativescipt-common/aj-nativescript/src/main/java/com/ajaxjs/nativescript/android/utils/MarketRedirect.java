package com.ajaxjs.nativescript.android.utils;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import java.util.Locale;

/**
 * 应用市场跳转
 */
public class MarketRedirect {
    /**
     * 获取手机品牌（统一转小写）。
     *
     * @return 品牌名称；系统未提供时返回空字符串
     */
    public static String getPhoneBrand() {
        String brand = Build.BRAND;
        if (brand == null)
            return "";

        return brand.toLowerCase(Locale.ROOT);
    }

    /**
     * 获取手机制造商（统一转小写）。
     *
     * @return 制造商名称；系统未提供时返回空字符串
     */
    public static String getManufacturer() {
        String manufacturer = Build.MANUFACTURER;
        if (manufacturer == null)
            return "";

        return manufacturer.toLowerCase(Locale.ROOT);
    }

    /**
     * 根据设备品牌和制造商获取推荐的应用市场包名。
     *
     * @return 推荐市场包名；未匹配厂商时返回 Google Play 包名
     */
    public static String getMarketPackageName() {
        String brand = getPhoneBrand();
        String manufacturer = getManufacturer();

        // 小米（包含 Redmi、POCO）
        if (brand.equals("xiaomi") || brand.equals("redmi") || brand.equals("poco") || manufacturer.equals("xiaomi"))
            return "com.xiaomi.market";

        // 华为
        if (brand.equals("huawei") || manufacturer.equals("huawei"))
            return "com.huawei.appmarket";

        // 荣耀
        if (brand.equals("honor") || manufacturer.equals("honor"))
            return "com.hihonor.appmarket";

        // OPPO/一加
        if (brand.equals("oppo") || manufacturer.equals("oppo") || brand.equals("oneplus") || manufacturer.equals("oneplus"))
            return "com.heytap.market";
//            return "com.oppo.market";

        // vivo / iQOO
        if (brand.equals("vivo") || brand.equals("iqoo") || manufacturer.equals("vivo"))
            return "com.bbk.appstore";

        // Realme
        if (brand.equals("realme") || manufacturer.equals("realme"))
            return "com.oppo.market";

        // 三星
        if (brand.equals("samsung") || manufacturer.equals("samsung"))
            return "com.sec.android.app.samsungapps";

        // 默认 Google Play
        return "com.android.vending";
    }

    /**
     * Redirect to App store
     *
     * @param context          ctx
     * @param appMarketPackage The package name of app store
     * @param appPackage       The app that going to be upgraded.
     */
    public static void redirect(Context context, String appMarketPackage, String appPackage) {
        Log.e(Helper.TAG, "appMarketPackage: " + appMarketPackage);
        Log.e(Helper.TAG, "appPackage: " + appPackage);

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setPackage(appMarketPackage);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.setData(Uri.parse("market://details?id=" + appPackage));

        // Package visibility restrictions can hide installed markets from getPackageInfo().
        try {
            context.startActivity(intent);
        } catch (ActivityNotFoundException | SecurityException e) {
            Log.w(Helper.TAG, "Unable to open market: " + appMarketPackage, e);
        }
    }

    /**
     * Redirect to App store
     *
     * @param context    ctx
     * @param appPackage The app that going to be upgraded.
     */
    public static void redirect(Context context, String appPackage) {
        String marketPackageName = getMarketPackageName();
        Log.e(Helper.TAG, "marketPackageName: " + marketPackageName);

        redirect(context, marketPackageName, appPackage);
    }

    /**
     * Redirect to App store
     *
     * @param context ctx
     */
    public static void redirect(Context context) {
        redirect(context, context.getPackageName());
    }

    /**
     * Is a APP installed?
     *
     * @param context     CTX
     * @param packageName APP 包名
     * @return 已安装且对本应用可见时返回 {@code true}；Android 11+ 可能需要宿主声明 queries
     */
    public static boolean isPackageInstalled(Context context, String packageName) {
        try {
            context.getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
