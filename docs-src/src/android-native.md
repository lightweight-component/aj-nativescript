---
title: 安卓原生工具
description: 供 Android Java 原生组件内部使用的 HTTP、时间和随机字符串工具
tags:
  - Android
  - Java
layout: docs.njk
---

# 安卓原生工具

本文面向 Android Java 原生组件的开发与维护，介绍 `android/nativescipt-common` 中的 HttpRequest 和 Utils。它们随公共 JAR 提供，用于原生模块内部复用；本文不提供 NativeScript TS 调用入口或接口代理示例。

业务 TS 使用 [通用工具](../common-helper/) 或 [安卓工具类](../android/)。密钥管理与加解密单独见 [KeyStore 与 AES](../keystore-aes/)。当前 demo-app 最低 Android 8.0（API 26），Java 工程使用 Java 8 源码与目标兼容配置。

## 联网权限

HTTP 请求要求宿主在 AndroidManifest.xml 的 `<manifest>` 下声明 INTERNET 权限，无需运行时申请：

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

## HttpRequest：后台 GET 与 JSON POST

原生类：`com.ajaxjs.nativescript.android.utils.HttpRequest`。此类供 Android 原生组件内部使用，本文以 Java 调用说明，不作为面向业务 TS 的工具 API。

| 方法 | 参数说明 | 返回值 |
| --- | --- | --- |
| `get(url, callback)` | 默认网络；正文回调 | `void` |
| `get(url, callback, headerConsumer)` | 默认网络；发送前配置请求头 | `void` |
| `get(url, callback, network, headerConsumer)` | 可指定 `android.net.Network`；请求头回调可为空 | `void` |
| `get(url, callback, network, headerConsumer, onError)` | 增加错误回调 | `void` |
| `post(url, body, callback, network, onError)` | JSON 文本；网络可为空；错误回调可为空 | `void` |
| `readInputStream(input)` | UTF-8 输入流，可为空 | 去除首尾空白后的字符串；输入流为空时为空字符串；读取失败抛出 UncheckedIOException |

回调参数使用 Java `java.util.function.Consumer`：正文与错误回调接受字符串；`headerConsumer` 接受 HttpURLConnection。以下示例供 Android Java 原生代码调用：

```java
import android.util.Log;
import com.ajaxjs.nativescript.android.utils.HttpRequest;
import java.util.function.Consumer;

Consumer<String> success = body -> Log.d("HTTP_DEMO", "Response length: " + body.length());
Consumer<String> failure = error -> Log.e("HTTP_DEMO", error);

HttpRequest.get("https://example.com/api/status", success, null,
        connection -> connection.setRequestProperty("Accept", "application/json"), failure);
HttpRequest.post("https://example.com/api/command", "{\"command\":\"stop\"}",
        success, null, failure);
```

示例语句放在 Java 方法体内，URL 替换为实际服务。请求通过进程级单线程 Executor 串行执行，成功和错误回调均在后台线程、连接释放后调用。更新原生 UI 应通过主线程 Handler 或 Activity.runOnUiThread 调度；耗时回调会延迟后续请求，组件没有取消接口。回调自身的异常不会被当作请求失败或再次触发错误回调。

GET 的连接 / 读取超时分别为 5 / 10 秒；POST 分别为 55 / 50 秒。GET 可在发送前配置请求头；POST 当前没有自定义请求头参数，非空 body 自动设置 `Content-Type: application/json` 并按 UTF-8 写入，但不验证正文是否为合法 JSON。空 body 不写入请求体，也不设置该 Content-Type。

HTTP 2xx 触发成功回调；非 2xx 或请求异常触发 `onError`，未传错误回调时仅记录日志，不调用成功回调。正文读取会去掉首尾空白，并将逐行内容重组为换行分隔文本，不适合依赖原始字节、签名、二进制或精确空白的响应。

网络参数为 `null` 时使用系统默认网络；非空时通过 `Network.openConnection` 使用指定网络，本工具不负责获取或绑定网络。宿主应声明 INTERNET 权限。工具未强制 HTTPS，也未主动禁用重定向，实际行为受 HttpURLConnection 和宿主网络安全配置影响。

原生实现会记录 URL、响应正文及错误信息，不要用它传输秘密主密钥或敏感响应。密钥获取应使用插件现有的 HTTPS 配置接口，详见 [KeyStore 与 AES](../keystore-aes/)，该接口有独立的协议与校验流程。

## Utils：时间与随机字符串

原生类：`com.ajaxjs.nativescript.android.utils.Utils`，供原生代码使用，与 NativeScript 的同名 TS 工具不同。

| 方法 | 参数 | 返回值 / 异常 |
| --- | --- | --- |
| `now()` | 无 | 设备当前时区的 `yyyy-MM-dd HH:mm:ss` 文本，不包含时区信息 |
| `generateRandomString(length)` | 非负整数，Java int | 大小写英文字母和数字组成的指定长度字符串；0 返回空字符串；负数抛出异常 |

```java
import com.ajaxjs.nativescript.android.utils.Utils;

String time = Utils.now();
String requestId = Utils.generateRandomString(16);
```

示例语句放在 Java 方法体内。

随机字符串使用进程级 SecureRandom，在 62 个字符中逐位选择。它不是 AES 密钥的标准 Base64，也不是 12 字节 GCM nonce；AES nonce 由加密接口自动生成。MQTT 报文的 UTC Unix epoch 毫秒时间戳在 Java 中使用 `System.currentTimeMillis()`，不要用 `now()` 的本地时间文本替代。

组件基础名称可由 `com.ajaxjs.nativescript.android.AjNativescript.getName()` 获取，固定返回 `"aj-nativescript"`，不代表版本号。

## 原生工程与构建

源码位于独立 Gradle 工程：

```text
android/nativescipt-common/aj-nativescript/src/main/java/com/ajaxjs/nativescript/android/
├── AjNativescript.java
├── utils/
│   ├── Helper.java
│   ├── MarketRedirect.java
│   ├── HttpRequest.java
│   └── Utils.java
└── crypto/
    ├── AesKeyStore.java
    ├── JsonBodyCipher.java
    ├── EncryptedBody.java
    └── RobotKeyDerivation.java
```

在 `nativescript-plugin/nativescipt-common` 目录执行：

```sh
npm run build:native
npm run build
```

`build:native` 调用独立 Gradle 工程的 JAR 构建任务，复制产物到插件 `platforms/android/aj-nativescript.jar`；`build` 编译 TS。构建 Java 时仅引用 Android SDK 的 android.jar，不把 SDK 类打包到插件中。

Windows 使用 `gradlew.bat`，macOS / Linux 使用 Gradle shell 包装脚本。SDK 路径可通过 `ANDROID_HOME`、`ANDROID_SDK_ROOT` 或原生工程 `local.properties` 的 `sdk.dir` 指定；当前默认编译 SDK 为 35，Java 源码和目标兼容版本为 8。

完整 npm 打包与发布流程见组件 README。`npm pack` 会重建 Android JAR；iOS 产物的生成与复用按 iOS 构建脚本处理，Windows 不编译 Xcode 工程。更新后使用现有 demo-app 重新编译 Android App，通过“测试”tab 验证 Toast 和 AES 功能。

本文按当前源码整理接口与实现行为，不表示所有厂商市场、权限场景和 HTTP 服务都已完成实机验证。
