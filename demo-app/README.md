# demo-app

NativeScript 9 + Vue 3 + Vite 演示应用，用于验证 common、MQTT v3 和 MQTT v5 插件。

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
