import { Application, Color, isAndroid, isIOS, Utils } from '@nativescript/core';

/**
 * 正文对齐方式，兼容原 Confirm 的 Gravity 参数，不表示弹窗的屏幕位置。
 */
export type ConfirmPosition = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CENTER';

/**
 * 两端一致的原生确认框参数；默认中文文案，业务可传入已翻译的字符串。
 */
export interface ConfirmOptions {
    /**
     * 标题，未传或空字符串时使用“提示”。
     */
    title?: string;
    /**
     * 提示正文，必须为字符串，可为空；保留空格、换行及 Unicode。
     */
    message: string;
    /**
     * 确认按钮文案，默认“确认”。
     */
    okText?: string;
    /**
     * 取消按钮文案，默认“取消”。
     */
    cancelText?: string;
    /**
     * 确认按钮背景色，默认 #71A3DF；支持 NativeScript Color 的字符串格式。
     */
    okColor?: string;
    /**
     * 取消按钮背景色，默认 #E2E2E2。
     */
    cancelColor?: string;
    /**
     * 确认按钮文字色，默认 #FFFFFF。
     */
    okTextColor?: string;
    /**
     * 取消按钮文字色，默认 #333333。
     */
    cancelTextColor?: string;
    /**
     * 正文对齐，默认 CENTER；TOP/BOTTOM 在内容自然高度内显示，两端均不移动弹窗。
     */
    position?: ConfirmPosition;
    /**
     * 点击蒙层是否取消，默认 false；Android 返回键始终允许取消。
     */
    maskClosable?: boolean;
}

let confirmQueue: Promise<void> = Promise.resolve();

/**
 * 显示圆角卡片与双色按钮的原生确认框；并发请求按调用顺序显示。
 *
 * @param options 标题、正文、按钮文字/配色、正文对齐与蒙层关闭设置。
 * @returns 确认返回 true；取消、允许的蒙层点击、宿主停止或无活动页面返回 false。
 * @throws Promise 在参数/颜色无效、不支持的平台、原生组件缺失或显示失败时 reject。
 * 不依赖宿主 i18n；调用方可传入翻译后的 title、okText、cancelText。
 * 默认白色卡片；长正文可滚动。每个请求只完成一次，失败不会阻塞后续队列。
 */
export async function confirm(options: ConfirmOptions): Promise<boolean> {
    if (!options || typeof options !== 'object' || typeof options.message !== 'string')
        throw new TypeError('Confirm options.message must be a string.');
    const stringFields = ['title', 'okText', 'cancelText', 'position', 'okColor', 'cancelColor', 'okTextColor', 'cancelTextColor'] as const;
    for (const field of stringFields) {
        if (options[field] !== undefined && typeof options[field] !== 'string')
            throw new TypeError(`Confirm ${field} must be a string.`);
    }
    if (options.maskClosable !== undefined && typeof options.maskClosable !== 'boolean')
        throw new TypeError('Confirm maskClosable must be a boolean.');

    const color = (value: string | undefined, fallback: string): string =>
        '#' + (new Color(value || fallback).argb >>> 0).toString(16).padStart(8, '0').toUpperCase();
    const positions: string[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CENTER'];
    const json = JSON.stringify({
        title: options.title || '提示',
        message: options.message,
        okText: options.okText || '确认',
        cancelText: options.cancelText || '取消',
        okColor: color(options.okColor, '#71A3DF'),
        cancelColor: color(options.cancelColor, '#E2E2E2'),
        okTextColor: color(options.okTextColor, '#FFFFFF'),
        cancelTextColor: color(options.cancelTextColor, '#333333'),
        position: positions.includes(options.position ?? '') ? options.position : 'CENTER',
        maskClosable: options.maskClosable ?? false
    });
    const request = confirmQueue.then(() => showNativeConfirm(json));
    confirmQueue = request.then(() => undefined, () => undefined);
    return request;
}

/**
 * 将平台结果转换为统一 Promise；原生回调和同步异常只结算第一次。
 */
function showNativeConfirm(optionsJson: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const result = (confirmed: boolean, error?: string | null) => {
            if (settled)
                return;

            settled = true;

            if (error)
                reject(new Error(error));
            else
                resolve(confirmed);
        };

        try {
            if (isAndroid) {
                const native = typeof com === 'undefined' ? undefined : com.ajaxjs?.nativescript?.android?.utils?.ConfirmDialog;

                if (!native || typeof native.show !== 'function')
                    throw new Error('Rebuild the common Android JAR and host metadata with ConfirmDialog support.');

                const activity = Application.android.foregroundActivity || Application.android.startActivity;

                if (!activity) {
                    result(false);
                    return;
                }

                native.show(activity, optionsJson, new native.Callback({
                    onResult: confirmed => result(confirmed),
                    onError: message => result(false, message)
                }));
            } else if (isIOS) {
                if (typeof AjaxJSConfirmDialog === 'undefined' || typeof AjaxJSConfirmDialog.showCompletion !== 'function')
                    throw new Error('Rebuild AjaxJSCommon XCFramework with ConfirmDialog support.');

                AjaxJSConfirmDialog.showCompletion(optionsJson, result);
            } else
                throw new Error('Confirm requires Android or iOS.');
        } catch (error) {
            if (!settled) {
                settled = true;
                reject(error);
            }
        }
    });
}

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
