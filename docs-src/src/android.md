---
title: 安卓工具类
description: 面向 NativeScript TypeScript 调用的 Android Helper 和应用市场跳转工具
tags:
  - Android
  - Toast
layout: docs.njk
---

# 安卓工具类

本文面向 NativeScript 业务 TypeScript 调用，介绍 Java 实现的 `com.ajaxjs.nativescript.android.utils.Helper` 和 `MarketRedirect`。当前 demo-app 最低支持 Android 8.0（API 26）。

Toast 和剪贴板的跨平台签名集中在 [通用工具](../common-helper/)；HttpRequest 和 Utils 的 Java 内部用法见 [安卓原生工具](../android-native/)；密钥管理与加解密见 [KeyStore 与 AES](../keystore-aes/)。

## 安装与调用入口

```sh
npm install @ajax-js/nativescript-common
```

npm 包中的 `platforms/android/aj-nativescript.jar` 由 NativeScript 在 Android 构建时集成，无需在宿主重复复制 Java 源码。更新原生组件后必须重新构建 App，仅刷新 JS 不能更新 JAR。

Toast、密钥管理、JSON 加解密和设备密钥派生提供统一 TS 方法。本文 Android 工具通过 NativeScript 的全局 Java 命名空间调用，方法均为静态方法，不需要创建工具类实例。

```ts
import { Application, isAndroid } from '@nativescript/core';
import { toast } from '@ajax-js/nativescript-common';

toast('保存成功');

if (isAndroid) {
    const context = Application.android.context;
    const helper = com.ajaxjs.nativescript.android.utils.Helper;
    const version = helper.getVersionName(context);
    console.log(`应用版本：${version}`);
}
```

Android 的 `com` 是原生全局命名空间，不需要从插件导入；插件导出的 `com.ajaxjs.nativescript.ios` 是 iOS TS 包装层，不要导入它来访问 Android Java 类。Android 工具必须在 `isAndroid` 分支内访问，需要 Context 的方法在应用初始化后调用。

原生声明位于插件 `types/ajaxjs-nativescript.d.ts`。若宿主 TypeScript 没有自动加载该文件，可在宿主声明文件中加入：

```ts
/// <reference path="../node_modules/@ajax-js/nativescript-common/types/ajaxjs-nativescript.d.ts" />
```

上述路径按宿主声明文件的位置调整。三斜线引用是 TypeScript 指令，不是普通注释。


## Helper：提示、剪贴板和应用状态

原生类：`com.ajaxjs.nativescript.android.utils.Helper`。日志标签为 `AJ_HELPER`。

| 方法 | 参数 | 返回值 / 失败行为 |
| --- | --- | --- |
| `copyToClipboard(context, text)` | 非空 Context、文本 | `void`；不返回复制成功标志 |
| `getFromClipboard(context)` | 非空 Context | 首个项目的转换文本；服务不可用、无项目或转换结果为空时为空字符串 |
| `toast(context, message)` | Context、提示文本 | `void`；Context 为空时不显示 |
| `isInternetAvailable(context)` | Context，可为空 | 默认网络具有 INTERNET 和 VALIDATED 能力时为 `true`；无网络、服务或 Context 为空、缺少权限时为 `false` |
| `isNetworkAvailable()` | 无 | 同步 DNS 解析 `www.baidu.com` 成功为 `true`；UnknownHostException 时为 `false` |
| `getSystemLanguageByCxt(context)` | Context，可为空 | Context 资源配置的首选语言代码，例如 `zh`；Context 为空或首选 Locale 为空时为 `null` |
| `getSystemLanguage()` | 无 | 系统资源配置的首选语言代码；语言列表为空时为 `null` |
| `isDarkMode(context)` | Context，可为空 | Context 配置为夜间模式时为 `true`；Context 为空时为 `false` |
| `getVersionName(context)` | 非空 Context | 宿主版本名称；找不到包信息时记录日志并返回 `null` |
| `getVersionCode(context)` | 非空 Context | 宿主版本代码；找不到包信息时记录日志并返回 `-1` |

没有明确接受空 Context 的方法应传入有效 Context；例如版本读取方法不会捕获空 Context 导致的异常。原生异常可由 TS 调用方捕获。

### 网络状态与权限

宿主在 `App_Resources/Android/src/main/AndroidManifest.xml` 的 `<manifest>` 节点下声明需要的权限：

```xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

两者无需运行时权限弹窗。`ACCESS_NETWORK_STATE` 用于查询系统网络；`INTERNET` 用于 HTTP 和 DNS 等联网操作。

```ts
if (isAndroid) {
    const online = com.ajaxjs.nativescript.android.utils.Helper
        .isInternetAvailable(Application.android.context);
    console.log(`系统已验证联网：${online}`);
}
```

`isInternetAvailable` 不发送请求，可在主线程查询；它判断当前默认网络是否通过 Android 系统的互联网验证，不保证 MQTT Broker 或业务服务器可达。

`isNetworkAvailable` 保留旧的 DNS 探测实现，必须在后台线程调用。DNS 缓存可能影响结果，解析成功也不等于服务器可达；它只捕获 UnknownHostException，主线程网络限制等其他异常可能传播。业务页面优先使用系统网络状态，再通过实际业务请求判断服务可用性。

### 语言、主题与版本

```ts
if (isAndroid) {
    const context = Application.android.context;
    const helper = com.ajaxjs.nativescript.android.utils.Helper;
    console.log(helper.getSystemLanguage());
    console.log(helper.getSystemLanguageByCxt(context));
    console.log(helper.isDarkMode(context));
    console.log(helper.getVersionName(context));
    console.log(helper.getVersionCode(context));
}
```

`getSystemLanguage()` 读取系统资源配置；`getSystemLanguageByCxt()` 读取传入 Context 的资源配置，可能受到应用独立语言或自定义配置影响。两者只返回首选语言的代码，不包含地区和文字体系，`zh` 不能用来区分简体和繁体。Context 版本直接读取列表第一个元素，没有单独检查空列表。

`isDarkMode()` 读取 Context 的 `uiMode`，不提供主题切换或变化监听，应用资源配置可能影响结果。

版本信息来自宿主 App，不是 npm 插件版本。Android 9 及以上的版本代码使用 `longVersionCode`，较旧系统使用 `versionCode`；Java long 映射为 JS number，超过 `Number.MAX_SAFE_INTEGER` 时可能丢失精度。

## MarketRedirect：应用市场跳转

原生类：`com.ajaxjs.nativescript.android.utils.MarketRedirect`。

| 方法 | 参数 | 返回值 |
| --- | --- | --- |
| `getPhoneBrand()` | 无 | 以 Locale.ROOT 转为小写的设备品牌；缺失时为空字符串 |
| `getManufacturer()` | 无 | 以 Locale.ROOT 转为小写的制造商；缺失时为空字符串 |
| `getMarketPackageName()` | 无 | 按品牌和制造商推荐的市场包名 |
| `redirect(context)` | 非空 Context | `void`；打开当前宿主应用的市场详情 |
| `redirect(context, appPackage)` | Context、目标应用包名 | `void`；使用推荐市场 |
| `redirect(context, appMarketPackage, appPackage)` | Context、市场包名、目标应用包名 | `void`；使用指定市场 |
| `isPackageInstalled(context, packageName)` | Context、包名 | 已安装且对宿主可见时为 `true`；找不到包信息时为 `false` |

当前厂商映射如下，其他厂商默认 Google Play。这是源码内固定规则，不会检测哪一个市场实际已安装。

| 品牌 / 制造商 | 市场包名 |
| --- | --- |
| Xiaomi / Redmi / POCO | `com.xiaomi.market` |
| Huawei | `com.huawei.appmarket` |
| Honor | `com.hihonor.appmarket` |
| OPPO / OnePlus | `com.heytap.market` |
| vivo / iQOO | `com.bbk.appstore` |
| Realme | `com.oppo.market` |
| Samsung | `com.sec.android.app.samsungapps` |
| 其他 | `com.android.vending` |

```ts
if (isAndroid) {
    const market = com.ajaxjs.nativescript.android.utils.MarketRedirect;
    const context = Application.android.context;
    market.redirect(context);
}
```

跳转使用 `ACTION_VIEW`、`market://details?id=…`、指定市场包名及 `FLAG_ACTIVITY_NEW_TASK`。目标应用应传包名，不传网站 URL 或应用名称。找不到可处理的 Activity 或发生 SecurityException 时记录日志，返回 `void`；当前实现没有浏览器回退、其他市场回退或成功回调。

Android 11 及以上的包可见性会影响 `isPackageInstalled`。宿主可按实际需要在 `<manifest>` 下声明查询目标，例如：

```xml
<queries>
    <package android:name="com.android.vending" />
</queries>
```

查询为 `false` 不一定表示应用未安装。`redirect` 直接尝试启动市场，不以前置安装查询作为跳转条件。

## 源码与原生构建

源码位于 `android/nativescipt-common/aj-nativescript/src/main/java/com/ajaxjs/nativescript/android/utils/Helper.java` 和同目录 `MarketRedirect.java`；原生方法声明位于插件 `types/ajaxjs-nativescript.d.ts`。

JAR 构建、复制与 SDK 配置见 [安卓原生工具：原生工程与构建](../android-native/)。本文按当前源码整理接口，不表示所有厂商市场、权限场景均已完成实机验证。


## 字符串安全存储

推荐使用包入口的 `setSecureItem/getSecureItem/removeSecureItem`，用于 Token 与 MQTT 凭据，详见 [通用工具：安全存储](/common-helper#字符串安全存储)。原生类 `com.ajaxjs.nativescript.android.storage.SecureStorage` 提供 `setItem(context, key, value)`、`getItem(context, key)`、`removeItem(context, key)`，获取不到返回 null，失败抛出异常。键名非空白、最多 128 UTF-16 单元；值最多 65536 UTF-8 字节，空字符串有效，TS 接口保证合法 Unicode。

本机 AES-256 密钥由 AndroidKeyStore 随机生成，不可导出，不复用机器人密钥。AES-GCM 密文通过 AtomicFile 保存于 noBackupFilesDir，AAD 绑定逻辑键名，避免备份恢复或换名误读。密钥丢失和认证失败不会静默回退；支持单进程调用，当前原生方法为同步小型 I/O。


## 固定键用户 Token

`com.ajaxjs.nativescript.android.storage.GetCredential` 保留既有 `saveUserToken(context, userToken, refreshToken)`、`getUserToken(context)`、`getUserRefreshToken(context)` 同步接口，使用 `user_token` 和 `user_refresh_token` 安全存储键。新增对应 `*Async` 方法及 `TokenCallback`，供统一 TS 接口使用：存储在串行后台线程执行，成功 `onResult` 和失败 `onError` 在主线程回调，保存成功及读取缺失的结果为 null。错误不包含凭据；原有同步方法仍应由调用方安排到后台线程。

推荐使用包入口的 `saveUserToken/getUserToken/getUserRefreshToken`，无需传 Context。两项写入不是事务，使用方法与清理示例见 [通用工具](/common-helper#固定键用户-token-接口)。MQTT 凭据改为固定键 `mqtt_username`、`mqtt_password` 分开存取，原生不再提供凭据 HTTP 请求或旧 getCredential 方法。


需要同步生成 Cookie 时，可从包入口调用 `getUserTokenSync(): string | null`、`getUserRefreshTokenSync(): string | null`，直接复用 GetCredential 的原生同步读取，不进入 Async 后台队列。当前线程可能因磁盘读取或解密阻塞，存储/桥接失败同步抛出异常。它们不等待尚未完成的异步写入；必须先 await 保存完成，再读取。原有 Promise 接口保持不变，完整示例见 [同步读取与 Cookie](/common-helper#同步读取与-cookie)。


## MQTT 账号密码

`GetCredential.setMqttCredential(context, username, password)` 依次保存两项，`getMqttUsername(context)`、`getMqttPassword(context)` 分别读取，缺失返回 null，空字符串保留，失败抛异常。字段支持下划线与 Unicode，不拼接、不 Base64 解码。两次写入不是事务，失败时停止连接，重新获取并保存两项。HTTP 在业务 TS 层执行，原生只做同步本机存取；统一调用方式见 [通用工具](/common-helper#mqtt-账号密码存取)。原有 Token 接口保持不变。


## 删除及客户端认证 Token

`GetCredential.removeUserToken(context)`、`removeMqttCredential(context)` 分别幂等删除各自两项，互不影响；非事务，失败应重试。客户端 Token 使用 `CLIENT_CREDENTIAL_KEY = "client_credential"`，提供静态 `saveClientCredential(context, token)`、`getClientCredential(context)`、`removeClientCredential(context)`，只操作该键，读取缺失 null，空值保留，失败抛异常。HTTP 获取和刷新由业务 TS 层处理。

统一 TS 删除及客户端方法均同步返回；用户保存方法为 `saveUserToken(...): Promise<void>`，Android 通过 `saveUserTokenAsync` 执行。旧 saveUserTokenKey 名称已移除。退出前需等待在途保存并阻止后续写回，再删除。完整接口、格式和清理说明见 [通用工具](/common-helper#客户端认证-token)。


## AES 密钥字符串

GetCredential 的 `AES_KEY_KEY = "AES_KEY"` 保存的是密钥字符串缓存，提供静态 `saveAesKey(context, token)`、`getAesKey(context)`、`removeAesKey(context)`。每项最多 65536 UTF-8 字节，允许空值，原样存取；读取缺失 null，失败抛异常。不校验 Base64 或 AES 长度，不执行 HKDF，不导入密码学 Keystore 别名；删除只影响此缓存，不删除 importAesKey 导入的密钥。统一 TS 三方法均同步，见 [通用工具](/common-helper#aes-密钥字符串缓存)。Java 类、常量、回调及方法的 Javadoc 已补充参数、返回值、线程和异常说明。
