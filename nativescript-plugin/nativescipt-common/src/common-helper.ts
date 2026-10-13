import { Application, isAndroid, isIOS, Utils } from '@nativescript/core';

/**
 * 显示系统风格的短提示，空白消息忽略，允许从后台线程调用。
 * Android 沿用 Helper.toast；iOS 在活动窗口显示两秒，不阻挡触摸，连续调用替换旧提示。
 *
 * @param message 提示文本，不持久化；必须为字符串。
 * @returns 无返回值，不等待显示完成；无活动 iOS 窗口时只记录日志。
 * @throws 非字符串、不支持的平台、原生组件缺失或 Android 应用未初始化时抛出异常。
 */
export function toast(message: string): void {
    if (!message || !message.trim())
        return;

    if (isAndroid)
        com.ajaxjs.nativescript.android.utils.Helper.toast(Utils.android.getApplicationContext(), message);
    else if (isIOS) {
        if (typeof AjaxJSIOSHelper === 'undefined')
            throw new Error('AjaxJSCommon XCFramework is not installed.');

        AjaxJSIOSHelper.showToast(message);
    }
}

/**
 * 将文本原样写入系统剪贴板，空字符串会替换之前的内容，不 trim。
 * @param str 要复制的字符串，包含空格、换行或 Unicode 时保持原样。
 * @returns 无返回值，正常返回表示原生写入完成。
 * @throws 非字符串、非移动平台、原生组件缺失或应用未初始化时抛出异常。
 * 应在前台页面主线程调用；系统可能显示剪贴板提示。
 */
export function copyToClipboard(str: string): void {
    if (typeof str !== 'string')
        throw new TypeError('Clipboard text must be a string.');

    if (isAndroid) {
        const context = Utils.android.getApplicationContext();

        if (!context)
            throw new Error('Android application context is not available.');

        com.ajaxjs.nativescript.android.utils.Helper.copyToClipboard(context, str);
    } else if (isIOS) {
        if (typeof AjaxJSIOSHelper === 'undefined' || typeof AjaxJSIOSHelper.copyToClipboard !== 'function')
            throw new Error('Rebuild AjaxJSCommon XCFramework with clipboard support.');

        AjaxJSIOSHelper.copyToClipboard(str);
    } else 
        throw new Error('Clipboard requires Android or iOS.');
}

/**
 * 同步读取系统剪贴板的首个文本内容；没有可读文本时返回空字符串。
 * @returns 原始文本，不 trim；Android 非文本 ClipData 项会尝试 coerceToText。
 * @throws 非移动平台、旧原生组件、应用未初始化或系统访问失败时抛出异常。
 * 应在前台页面主线程响应用户操作调用；系统隐私规则可能限制读取或要求授权。
 */
export function getFromClipboard(): string {
    if (isAndroid) {
        const context = Utils.android.getApplicationContext();

        if (!context)
            throw new Error('Android application context is not available.');

        return com.ajaxjs.nativescript.android.utils.Helper.getFromClipboard(context);
    }

    if (isIOS) {
        if (typeof AjaxJSIOSHelper === 'undefined' || typeof AjaxJSIOSHelper.getFromClipboard !== 'function')
            throw new Error('Rebuild AjaxJSCommon XCFramework with clipboard support.');

        return AjaxJSIOSHelper.getFromClipboard();
    }
    
    throw new Error('Clipboard requires Android or iOS.');
}
