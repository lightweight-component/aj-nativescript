# @ajax-js/nativescript-common

NativeScript 9 / Android 8.0+ / iOS 15+ 公共工具与原生密钥存储 JSON 加解密组件。

## 构建与安装

已发布的组件可直接安装：

```powershell
npm install @ajax-js/nativescript-common
```

从源码构建，在本目录执行：

```powershell
npm install
npm run typecheck
npm test
npm pack
```
macOS 打包同时自动构建独立 Xcode Framework，生成真机和模拟器 XCFramework 到 `platforms/ios`。
Windows/Linux 仍可构建 Android 和打包，但必须先复制 macOS 构建的完整 `AjaxJSCommon.xcframework` 到该目录；缺失时阻止打包，避免发布缺少 iOS 的包。
单独构建 iOS：`npm run build:ios`。需要 Xcode 27，最低部署版本 iOS 15。

打包会自动构建 `android/nativescipt-common/aj-nativescript`，将运行用的 JAR 放入 `platforms/android`。
需要 JDK 17 和 Android SDK Platform 35；路径使用 `android/nativescipt-common/local.properties` 或 `ANDROID_HOME`。

在 demo-app 中执行：

```sh
npm install ../nativescript-plugin/nativescipt-common/ajax-js-nativescript-common-0.1.0.tgz
npx ns build android
npx ns build ios --emulator
```

不要再同时在宿主的 App_Resources/Android/libs 放入同一 JAR，避免重复类。
手写原生类型声明随包发布，根入口自动引用。

## 功能文档与演示

- [Keystore 与 AES-GCM](../../docs-src/src/keystore-aes.md)：直接导入及 HTTPS 领取密钥、HKDF-SHA256 机器人一机一密、JSON/AAD 加解密、兼容性及 ESP32 修改提示词。
- [iOS Helper](../../docs-src/src/ios.md)：Toast、应用版本、App Store 跳转和界面方向工具。
- [demo 文档](../../demo-app/README.md)：在现有 NativeScript App 的“测试”tab 验证组件。

```ts
import { toast } from '@ajax-js/nativescript-common';

toast('操作成功');
```

AES 新旧接口及 `deriveRobotAesKey`、`deriveAndImportRobotAesKey` 支持 Android/iOS；原有 `/aes` 子路径保留显式传入密钥的 API。使用 AAD 时需同步更新 JAR/XCFramework 并重新构建 App。

## 发布

在本目录执行，发布账号需有 `@ajax-js` 权限：

```sh
npm version patch --no-git-tag-version
npm test
npm pack
```

`patch` 升级补丁版本，例如 `0.1.0 → 0.1.1`；`--no-git-tag-version` 不创建 Git 提交或标签。
`npm pack` 自动构建并打包 Android JAR、iOS XCFramework、TS 产物和声明文件，生成对应版本的 `.tgz`。

检查安装包后，发布该文件（文件名以实际生成的版本为准）：

```sh
npm publish ./ajax-js-nativescript-common-0.1.1.tgz
```

也可以直接发布当前目录：

```sh
npm publish
```

不指定文件名时，npm 根据当前 `package.json` 的版本重新构建、打包并发布，不会选择目录中的 `.tgz`；旧版本安装包不会影响发布。
指定 `.tgz` 时发布该文件的内容，不重新构建。包已配置公开发布；未登录时先执行 `npm login`。

单独构建 Java JAR 及运行 Java 测试，见 [公共 Java 工程](../../android/nativescipt-common/README.md)。

### 跨平台剪贴板

```ts
import { copyToClipboard, getFromClipboard } from '@ajax-js/nativescript-common';

copyToClipboard('原始文本');
const text = getFromClipboard();
```

两端保持相同签名，保留空格、换行与 Unicode；空字符串可以覆盖旧内容，没有可读文本时返回空字符串。应在前台主线程响应用户操作调用，系统可能显示粘贴授权。详细行为见 [通用工具](../../docs-src/src/common-helper.md)。
