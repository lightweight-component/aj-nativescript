import { Application, isAndroid, isIOS } from '@nativescript/core';

/**
 * 显示系统风格的短提示，空白消息忽略，允许从后台线程调用。
 * Android 沿用 Helper.toast；iOS 在活动窗口显示两秒，不阻挡触摸，连续调用替换旧提示。
 * @param message 提示文本，不持久化；必须为字符串。
 * @returns 无返回值，不等待显示完成；无活动 iOS 窗口时只记录日志。
 * @throws 非字符串、不支持的平台、原生组件缺失或 Android 应用未初始化时抛出异常。
 */
export function toast(message: string): void {
    if (typeof message !== 'string')
        throw new TypeError('Toast message must be a string.');
    
    if (!message.trim())
        return;

    if (isAndroid) {
        const context = Application.android?.context;
        if (!context)
            throw new Error('Android application context is not available.');
        com.ajaxjs.nativescript.android.utils.Helper.toast(context, message);
    } else if (isIOS) {
        if (typeof AjaxJSIOSHelper === 'undefined')
            throw new Error('AjaxJSCommon XCFramework is not installed.');
        
        AjaxJSIOSHelper.showToast(message);
    } else {
        throw new Error('Toast requires Android or iOS.');
    }
}
