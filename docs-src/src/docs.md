---
title: 项目简介
description: aj-nativescript 的公共工具、密钥管理、AES-GCM 与 MQTT 通讯组件，以及工程结构和使用入口
tags:
  - NativeScript
  - Android
  - iOS
  - MQTT
layout: docs.njk
---

# aj-nativescript

aj-nativescript 面向 NativeScript 应用提供公共工具、密钥管理、AES-GCM 加解密和 MQTT 通讯组件。业务通过独立 npm 插件的 TypeScript 接口调用原生能力，与 Vue 视图层无关。

Android 原生组件使用 Java 实现，JAR 随 npm 包发布并由 NativeScript 纳入构建。iOS common 使用独立 Xcode Framework 工程，XCFramework 随 npm 包发布，由现有 NativeScript App 加载。

common 的原生 AES 能力支持 Android 8.0（API 26）及以上、iOS 15 及以上；MQTT v3 和 v5 原生组件目前仅支持 Android。

## 组件概览

| npm 插件 | 主要能力 | 平台 / 状态 |
| --- | --- | --- |
| `@ajax-js/nativescript-common` | 公共工具、Token/MQTT 凭据安全存储、Android Keystore / iOS Keychain、AES-GCM JSON 与 AAD 加解密、机器人 HKDF 设备密钥派生 | Android / iOS；已实现 |
| `@ajax-js/nativescript-mqtt-v3` | 基于 Eclipse Paho 的 MQTT 3.1.1 通讯 | Android；已实现 |
| `@ajax-js/nativescript-mqtt-v5` | 基于 Eclipse Paho 的 MQTT 5.0 通讯 | Android；已实现 |

各组件 README 分别维护安装、API、宿主配置、构建与打包说明：

- [common 组件说明](https://github.com/lightweight-component/aj-nativescript/blob/main/nativescript-plugin/nativescipt-common/README.md)
- [MQTT v3 组件说明](https://github.com/lightweight-component/aj-nativescript/blob/main/nativescript-plugin/nativescipt-mqtt-v3/README.md)
- [MQTT v5 组件说明](https://github.com/lightweight-component/aj-nativescript/blob/main/nativescript-plugin/nativescipt-mqtt-v5/README.md)

## 文档导航

| 文档 | 内容与使用对象 |
| --- | --- |
| [通用工具](../common-helper/) | Android / iOS 一致的 TS API：Confirm、Toast、剪贴板与 Token/MQTT 凭据安全存储 |
| [安卓工具类](../android/) | 面向业务 TS 调用的 Helper、MarketRedirect：网络、语言、主题、版本和应用市场跳转 |
| [安卓原生工具](../android-native/) | 面向 Java 原生代码的 HttpRequest、Utils，以及 Android JAR 构建 |
| [iOS 工具类](../ios/) | iOS Helper 的应用版本、App Store 跳转、界面方向与原生桥接 |
| [KeyStore 与 AES](../keystore-aes/) | 密钥导入、检查、删除，AES-GCM / AAD，HKDF 一机一密协议与 ESP32 修改提示词 |

通用工具优先用于跨平台业务；平台专用工具按对应系统调用。密钥与加密协议统一维护在专题页中。

## 工程结构

| 目录 | 内容 |
| --- | --- |
| `android/` | 独立 Java / Gradle 原生工程，包含 common、MQTT v3 和 MQTT v5 |
| `ios/` | 独立 Xcode Framework 工程，当前包含 common |
| `nativescript-plugin/` | 各组件对应的 npm 插件、统一 TS 接口、类型声明及原生产物集成 |
| `demo-app/` | NativeScript 9 + Vue 3 + Vite 演示与组件测试 App |
| `docs-src/` | 当前文档站的 Markdown 源码与页面模板 |
| `docs/` | 文档目录 |

目录名中的 `nativescipt` 为工程当前使用的名称，查找源码或配置路径时请沿用该拼写。各 Java 工程和 npm 插件独立构建，iOS 原生产物通过 XCFramework 集成到插件的 `platforms/ios`。

## 使用与演示

先按所需组件的 README 安装插件并完成宿主配置，再通过 TS 接口调用。Android JAR 和 iOS XCFramework 的更新都需要重新构建宿主 App，刷新 JS 不能替换原生组件。

`demo-app` 沿用 NativeScript + Vue + Vite 工程，底部“测试”tab 提供 Confirm、Toast、剪贴板、安全存储、AES 加解密及 MQTT v3 / v5 测试入口。模拟器或设备运行、依赖准备与完整构建步骤见 [demo-app README](https://github.com/lightweight-component/aj-nativescript/blob/main/demo-app/README.md)。

Android 原生组件的构建入口见 [安卓原生工具](../android-native/)；iOS Framework 构建与桥接说明见 [iOS 工具类](../ios/)。npm 打包、版本升级与发布流程见 common 组件 README。

## 仓库与许可证

- [GitCode 仓库](https://gitcode.com/lightweight-component/aj-nativescript)
- [GitHub 仓库](https://github.com/lightweight-component/aj-nativescript)

本项目采用 [Apache License 2.0](https://github.com/lightweight-component/aj-nativescript/blob/main/LICENSE)。
