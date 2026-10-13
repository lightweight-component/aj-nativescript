import { Device, isIOS } from '@nativescript/core';

function helper(): typeof AjaxJSIOSHelper {
    if (!isIOS)
        throw new Error('iOS Helper requires iOS.');

    if (typeof AjaxJSIOSHelper === 'undefined')
        throw new Error('AjaxJSCommon XCFramework is not installed.');

    return AjaxJSIOSHelper;
}

/**
 * Swift 工具的 TS 命名空间；调用要求 iOS 和已安装的 XCFramework，其他平台抛出 Error。
 */
export namespace com {
    export namespace ajaxjs {
        export namespace nativescript {
            export namespace ios {
                export class Helper {
                    /**
                     * 同步写入剪贴板原始文本，允许空字符串。
                     */
                    static copyToClipboard(text: string): void {
                        helper().copyToClipboard(text);
                    }

                    /**
                     * 同步读取剪贴板字符串，不可读时返回空字符串。
                     */
                    static getFromClipboard(): string {
                        return helper().getFromClipboard();
                    }

                    /**
                     * 在活动窗口显示两秒 Toast；空白消息忽略，连续调用替换，无窗口时记录日志。
                     */
                    static showToast(message: string): void { helper().showToast(message); }

                    /**
                     * 返回宿主 CFBundleShortVersionString；缺失时记录日志并返回 Unknown。
                     */
                    static getAppVersionName(): string { return helper().getAppVersionName(); }

                    /**
                     * 返回宿主 CFBundleVersion 字符串；缺失时记录日志并返回 Unknown。
                     */
                    static getAppBuildNumber(): string { return helper().getAppBuildNumber(); }

                    /**
                     * 打开 App Store，appleID 为 ASCII 数字，无 id 前缀；默认中国区。
                     * isInternational=true 不限定地区。失败尝试 HTTPS，最终失败记录日志。
                     * 无返回值，不等待打开完成；不合法 ID 只记录日志。
                     */
                    static openAppInAppStore(appleID: string, isInternational = false): void {
                        helper().openAppInAppStoreIsInternational(appleID, isInternational);
                    }

                    /**
                     * 主线程设置设备横屏向左；受宿主方向配置与系统限制，无返回值。
                     */
                    static setLandscapeOrientation(): void { helper().setLandscapeOrientation(); }

                    /**
                     * 主线程设置设备竖屏；受宿主方向配置与系统限制，无返回值。
                     */
                    static setPortraitOrientation(): void { helper().setPortraitOrientation(); }

                    /**
                     * iOS 16+ 请求窗口场景横屏向右；失败记录日志，无返回值。
                     * 低版本调用抛出 Error，无窗口场景时不执行操作。
                     */
                    static requestOrientationChange(): void {
                        const native = helper();

                        if (Number.parseInt(Device.osVersion, 10) < 16)
                            throw new Error('Scene orientation requests require iOS 16 or later.');

                        native.requestOrientationChange();
                    }

                    /**
                     * iOS 16+ 请求窗口场景竖屏；失败记录日志，无返回值。
                     * 低版本调用抛出 Error，无窗口场景时不执行操作。
                     */
                    static forcePortrait(): void {
                        const native = helper();
                        if (Number.parseInt(Device.osVersion, 10) < 16)
                            throw new Error('Scene orientation requests require iOS 16 or later.');
                        native.forcePortrait();
                    }
                }
            }
        }
    }
}
