# demo-app

NativeScript 9 + Vue 3 + Vite 演示应用，用于验证 common、MQTT v3 和 MQTT v5 插件。

## 原型界面

底部固定“首页”“测试”“我的”三个 tab。“我的”提供点击登录区域，以及设置、关于菜单；登录目前为入口提示，后续接入业务登录。

- 设置：简体中文、正体中文、英文；亮色、暗黑、跟随系统；清除临时缓存。
- 关于：显示官网 www.ajaxjs.com，点击后在应用内 WebView 打开，支持重新加载。

语言和外观选择会保存，并立即更新原型界面。AES、MQTT 独立测试页面保留现有文案。清除缓存仅删除应用临时目录，保留设置、应用数据和 Keystore 密钥。

## 开发环境

需要 Node.js、npm、JDK 17、Android SDK Platform 35 和 Android 8.0+ 真机或模拟器。Node.js 版本需满足项目所用 NativeScript 9 / Vite 8 的要求。SDK 路径通过 ANDROID_HOME 或各 Java 工程的 local.properties 配置。

## 构建插件并运行演示

以下命令在工程根目录的 PowerShell 中开始执行。先打包三个插件，生成 demo 所依赖的本地 npm 安装包：

```powershell
Set-Location nativescript-plugin/nativescipt-common
npm install
npm pack

Set-Location ../nativescipt-mqtt-v3
npm install
npm pack

Set-Location ../nativescipt-mqtt-v5
npm install
npm pack

Set-Location ../../demo-app
npm install
npx ns run android
```

`npm pack` 触发 `prepack`，自动构建 Java JAR、复制到插件的 `platforms/android`，再编译 TypeScript 和声明文件。

demo 当前通过 `file:` 引用三个插件的 `0.1.0` 安装包。升级插件版本后，需要同步修改 `demo-app/package.json` 中的文件名。本地插件修改后，也需要重新打包并安装到 demo。

演示应用底部包含“首页”“测试”“我的”三个 tab。“测试”页通过按钮进入：

- **AES 加解密测试**：导入测试密钥、检查与删除密钥、JSON 加解密，以及可选的 HTTPS 密钥接口测试。
- **MQTT v3 / v5 通讯测试**：连接、订阅、发布、中文消息往返及停止后重新连接。

MQTT 演示默认使用 `tcp://159.75.215.222:1883`，无需账号密码，地址可在界面修改。该地址仅为演示配置，组件不内置 Broker 地址。

仅生成 APK，在 `demo-app` 中执行：

```powershell
npx ns build android --no-hmr
```

调试 APK 位于 `platforms/android/app/build/outputs/apk/debug/app-debug.apk`。

## 更新本地插件

插件代码修改后，在对应插件目录重新执行 npm pack，再在本目录安装生成的安装包。例如：

```powershell
npm install ../nativescript-plugin/nativescipt-mqtt-v5/ajax-js-nativescript-mqtt-v5-0.1.0.tgz
```

三个插件的构建与 API 说明见 [common](../nativescript-plugin/nativescipt-common/README.md)、[MQTT v3](../nativescript-plugin/nativescipt-mqtt-v3/README.md)、[MQTT v5](../nativescript-plugin/nativescipt-mqtt-v5/README.md)。

## Vite 配置

nativescript.config.ts 选择 Vite 构建，vite.config.mts 配置 Vue 与 NativeScript 插件。

参考：[原始演示工程](https://github.com/NativeScript/ns-vue-vite-demo)、[NativeScript Vite 配置](https://docs.nativescript.org/configuration/vite)、[NativeScript 9.1 Vite HMR](https://nstudio.io/blog/octane-vite-hmr-nativescript-9-1)。

## common iOS AES 验证

先构建 common：在插件目录执行 `npm pack`（需要设置本机 `ANDROID_HOME`），
再在 demo 目录执行 `npm install ../nativescript-plugin/nativescipt-common/ajax-js-nativescript-common-0.1.0.tgz`。
执行 `npx ns build ios --emulator`，再运行 `npx ns run ios --emulator`。
在底部“测试”打开 AES 页面，运行本地验证。页面支持 iOS Keychain、直接导入及可选 HTTPS 领取密钥。

自动验证可给模拟器应用 preferences 设置布尔值 `aesAutoCheck=true`。
应用启动会在“测试”tab 内打开 AES 页面并自动验证，保留底部 tabs；关闭该值恢复正常首页。
记录运行日志中的 `AES_INTEROP` 和 `AES_SELF_CHECK:PASS`，在仓库根目录执行：

```sh
ANDROID_HOME="$HOME/Library/Android/sdk" node ios/nativescipt-common/tests/interop.mjs /tmp/ajaxjs-demo.log
```

该脚本用现有 Android 生产 Cipher 解密 iOS 输出，验证 AES-128/192/256 双向兼容。
重新生成 Android → iOS 测试向量：同一脚本传 `--generate`。
公开测试密钥全零，仅用于互通验证。

本机已验证（2026-10-10）：Xcode 27.0、NativeScript iOS 9.1.0、iPhone 17 Pro / iOS 26.5 模拟器。
`vue-tsc --noEmit`、`ns build ios --emulator`、AES 页面本地检查和三种密钥长度的双向互通全部通过。
真实设备、锁屏状态、真实 HTTPS 密钥服务尚未验证。

模拟器自动验证示例（在 demo 目录执行，需已有启动的模拟器）：

```sh
xcrun simctl install booted platforms/ios/build/Debug-iphonesimulator/demoapp.app
xcrun simctl launch booted org.nativescript.nsvuevitedemo -aesAutoCheck YES
xcrun simctl spawn booted log show --last 3m --style compact \
  --predicate 'process == "demoapp" AND (eventMessage CONTAINS "AES_INTEROP" OR eventMessage CONTAINS "AES_SELF_CHECK")' \
  > /tmp/ajaxjs-demo.log
```

NativeScript 的 console 日志在当前运行时写入 iOS 日志系统，不能仅依赖 launch 的标准输出。
`-aesAutoCheck YES` 是此次启动的临时开关；下次正常启动回到首页。

### AES 附加认证数据（AAD）测试

AES 页面提供“运行 AAD 与旧方式兼容测试”，自动导入临时公开测试密钥，逐项显示正确 Unicode AAD、错误 AAD、非空 AAD 使用旧方法解密、旧方法往返，以及空 AAD 与旧方法双向兼容的结果。结束后删除临时密钥。“运行本地加解密验证”也包含这些检查。

也可以手动导入密钥、输入 JSON 和 AAD，点击“使用 AAD 加密 JSON”，再修改 AAD 点击“使用 AAD 解密 JSON”验证失败。认证失败会清除之前显示的明文。原有加解密按钮仍按无 AAD 方式工作。

common 依赖使用本地插件目录，以使用最新 API 和原生产物。在插件目录先执行 `npm run build:native`（Android）或 `npm run build:ios`（macOS/iOS），再执行 `npm run build`；随后在 demo-app 执行 `npm install`。iOS 需要重新编译包含 AAD 接口的 XCFramework。
