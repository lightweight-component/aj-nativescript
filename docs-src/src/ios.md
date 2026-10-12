---
title: iOS Helper 工具
description: NativeScript iOS 的 Toast、应用版本、App Store 跳转与界面方向工具
layout: layouts/docs.njk
---

# iOS Helper 工具

`@ajax-js/nativescript-common` 提供 iOS 原生 Helper，包含 Toast、应用版本信息、App Store 跳转和界面方向设置。适用于 NativeScript 工程，与 Vue 视图层无关。

插件最低支持 iOS 15；场景方向请求要求 iOS 16 及以上。Android 和 iOS 可共用 `toast(message)`，其余本文方法仅支持 iOS。

## 安装与调用入口

```sh
npm install @ajax-js/nativescript-common
```

已发布的 npm 包携带 `platforms/ios/AjaxJSCommon.xcframework`，NativeScript 在 iOS 构建时集成原生组件，无需在宿主重复复制 Swift 源码。

```ts
import { isIOS } from '@nativescript/core';
import { toast, com as commonNative } from '@ajax-js/nativescript-common';

const iosHelper = commonNative.ajaxjs.nativescript.ios.Helper;

toast('操作成功');

if (isIOS) {
    const version = iosHelper.getAppVersionName();
    const build = iosHelper.getAppBuildNumber();
    console.log(`应用版本：${version}，构建版本：${build}`);
}
```

`com` 是插件导出的 TS 命名空间，请从插件显式导入。它不是 iOS 系统提供的全局 Java 包；使用 `com as commonNative` 可以避免与 Android 全局 `com` 混淆。仅创建上述 `iosHelper` 引用不会调用原生方法。

所有 Helper 方法均为静态方法，无需创建实例。在非 iOS 平台调用这些方法会抛出 `Error`；缺少 XCFramework 时也会抛出 `Error`。

## 方法概览

| 方法 | 参数 | 返回值 | 最低系统版本 |
| --- | --- | --- | --- |
| `showToast(message)` | 提示字符串 | `void` | iOS 15 |
| `getAppVersionName()` | 无 | 版本名称字符串 | iOS 15 |
| `getAppBuildNumber()` | 无 | 构建版本字符串 | iOS 15 |
| `openAppInAppStore(appleID, isInternational?)` | 数字 ID 字符串；是否不限定地区，默认 `false` | `void` | iOS 15 |
| `setLandscapeOrientation()` | 无 | `void` | iOS 15 |
| `setPortraitOrientation()` | 无 | `void` | iOS 15 |
| `requestOrientationChange()` | 无 | `void` | iOS 16 |
| `forcePortrait()` | 无 | `void` | iOS 16 |

## Toast 提示

### 统一 TS 方法

```ts
import { toast } from '@ajax-js/nativescript-common';

toast('保存成功');
```

`toast(message: string): void` 在 Android 调用原有 `Helper.toast`，自动传入应用 Context；在 iOS 调用原生 `Helper.showToast`。调用方不需要自行处理平台差异。

非字符串参数会抛出 `TypeError`。空白字符串直接忽略；非空消息在不支持的平台调用会抛出 `Error`。原生组件缺失或 Android 应用 Context 尚未初始化时也会抛出异常。

### iOS 专用入口

```ts
import { com as commonNative } from '@ajax-js/nativescript-common';

commonNative.ajaxjs.nativescript.ios.Helper.showToast('保存成功');
```

iOS Toast 的行为如下：

- 在前台活动窗口显示，约两秒后自动消失。
- 连续调用替换旧提示，并重新计算显示时间。
- 空白消息不显示，也不打断已有提示；有效消息保留原始文本。
- 不使用模态弹窗，不阻挡底下的触摸操作。
- 默认位于底部安全区域上方，并通过约束避开键盘。
- UI 操作异步进入主线程；方法不等待提示显示或关闭。

如果没有可用的活动窗口，原生端只记录日志，不显示提示，也不向 TS 返回显示结果。建议在页面已经显示后调用。

## 应用版本信息

```ts
const version: string = iosHelper.getAppVersionName();
const build: string = iosHelper.getAppBuildNumber();
```

| 方法 | 读取字段 | 读取失败时的行为 |
| --- | --- | --- |
| `getAppVersionName()` | 宿主应用 Info.plist 的 `CFBundleShortVersionString` | 记录日志并返回 `"Unknown"` |
| `getAppBuildNumber()` | 宿主应用 Info.plist 的 `CFBundleVersion` | 记录日志并返回 `"Unknown"` |

读取的是当前宿主 App 的版本，不是 npm 插件或 Framework 的版本。构建版本按字符串返回，不应假定为整数。

## 打开 App Store

```ts
/*
 * 示例 ID 请替换为实际应用的 App Store 数字 ID。
 */
const appleID = '123456789';

iosHelper.openAppInAppStore(appleID);
iosHelper.openAppInAppStore(appleID, true);
```

`openAppInAppStore(appleID: string, isInternational = false): void`：

- `appleID` 必须是非空的 ASCII 数字字符串，不包含 `id` 前缀、空格或完整 URL。
- 默认 `false` 使用中国区路径 `/cn/app/id…`。
- `true` 使用不限定地区的路径 `/app/id…`，不会自动选择另一个应用 ID。国内版、国际版若有不同 ID，须由调用方传入对应值。

组件先尝试 `itms-apps://apps.apple.com…`，根据实际打开回调判断结果；失败后尝试对应的 `https://apps.apple.com…` 链接。无效 ID、URL 构造失败或两个入口均失败时记录日志。

该方法允许从后台线程调用，内部切换到主线程。返回 `void`，不等待打开完成，不提供打开成功的布尔值或 Promise。

## 界面方向

### iOS 16 及以上：场景请求

```ts
import { Device, isIOS } from '@nativescript/core';

if (isIOS && Number.parseInt(Device.osVersion, 10) >= 16) {
    iosHelper.requestOrientationChange();
}
```

- `requestOrientationChange()` 请求窗口场景切换为**横屏向右**。
- `forcePortrait()` 请求窗口场景切换为**竖屏**。

TS 包装层在低于 iOS 16 时抛出 `Error`。原生调用异步切回主线程；当前实现从 `connectedScenes` 的首个场景获取 `UIWindowScene`，多窗口应用不能通过参数指定目标场景。没有可用场景时不执行请求，系统拒绝时通过回调记录日志。

方法名称中的“force”不代表能够绕过系统限制。宿主必须配置支持的方向，当前视图控制器也必须允许该方向；返回 `void` 不表示旋转一定成功。

### 保留的设备方向方法

```ts
iosHelper.setLandscapeOrientation();
iosHelper.setPortraitOrientation();
```

`setLandscapeOrientation()` 使用原工程的设备方向设置方式切换为**横屏向左**，`setPortraitOrientation()` 切换为**竖屏**。两者通过 `UIDevice` 的 `orientation` 设置方向，后台调用会异步进入主线程。

这些方法保留原实现，仍受系统和宿主方向配置限制。iOS 16 及以上建议使用场景请求方法；不要把设备方向设置视为可靠的旋转成功通知。

## 原生工程与桥接

Swift 源码位于：

```text
ios/nativescipt-common/Sources/com/ajaxjs/nativescript/ios/
├── Helper.swift
└── AppToast.swift
```

Swift 使用 Framework 模块，没有 Java 式的包机制。上述目录组织对应 TS 的 `com.ajaxjs.nativescript.ios.Helper` 命名空间；原生 `Helper` 继承 `NSObject`，通过 `@objcMembers` 暴露方法，Objective-C 类名为 `AjaxJSIOSHelper`，避免与宿主已有的 `Helper` 冲突。`AppToast` 是内部实现，不提供公开调用入口。

直接通过 NativeScript 调用原生类时：

```ts
AjaxJSIOSHelper.showToast('提示消息');
const version = AjaxJSIOSHelper.getAppVersionName();
AjaxJSIOSHelper.openAppInAppStoreIsInternational('123456789', true);
```

业务代码优先使用 TS 包装层。直接调用原生的 `requestOrientationChange()`、`forcePortrait()` 时，必须自行检查 iOS 16 可用性。

原生日志使用 subsystem `com.ajaxjs.nativescript.ios`，category 为 `Helper` 或 `Toast`。版本缺失、活动窗口缺失、App Store 打开失败和方向请求失败可通过这些日志排查。

## 构建与验证

从源码单独重建 iOS 产物，在 `nativescript-plugin/nativescipt-common` 目录执行：

```sh
npm run build:ios
npm run build
```

构建脚本使用独立 Xcode Framework 工程，生成真机 arm64 和模拟器 arm64/x86_64 的 XCFramework，并复制到插件 `platforms/ios`。使用当前工程的 Xcode 27 和 iOS 15 部署目标；更新后需要重新构建宿主 App，确保加载最新原生接口。

demo-app 的“测试”tab 提供“Toast 测试”按钮，保留底部 tabs。已在 iPhone 17 Pro / iOS 26.5 模拟器验证 Toast 显示、自动消失及宿主版本读取；App Store 跳转和实际界面旋转尚未执行验证。
