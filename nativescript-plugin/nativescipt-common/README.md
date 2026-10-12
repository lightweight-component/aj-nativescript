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

## JWT 领取并导入密钥

```ts
import { provisionAesKey } from '@ajax-js/nativescript-common';

const result = await provisionAesKey({
  endpoint: 'https://your-server.example/api/aes-key',
  jwt: token
});
```

协议为 HTTPS GET，Authorization: Bearer JWT，默认超时 15 秒，不跟随重定向。
服务端须验证 JWT、授权领取，并建议返回 Cache-Control: no-store。
成功响应为 `{ "keyId": "aes-v1", "key": "标准 Base64 密钥" }`。
keyId 限定为 1–96 个字母、数字、点、下划线或连字符；密钥长度为 16、24 或 32 字节。
返回 `{ keyId, alias }`，alias 为 `ajaxjs.aes.<keyId>`，不向业务层返回密钥。
同名 alias 已存在时拒绝导入；轮换使用新 keyId。再次启动可根据已保存的非秘密 alias 调用 hasAesKey。

密钥请求和导入经过 JS 及 Java/Swift 内存。代码不记录密钥或 JWT，不写入文件；清理引用不能保证立即擦除字符串。
登录及 MQTT 不由此包管理。应用在密钥导入成功后再连接 MQTT。

## Keystore 与 JSON API

```ts
import { importAesKey, hasAesKey, deleteAesKey, encryptJson, decryptJson } from '@ajax-js/nativescript-common';

importAesKey(alias, keyBase64);
const exists = hasAesKey(alias);
const encrypted: EncryptedBody = encryptJson(alias, { message: '你好' });
const value: = decryptJson(alias, encrypted);
deleteAesKey(alias);
```

`keyBase64` 由应用提供，为 16、24 或 32 字节 AES 密钥的标准 Base64。同名别名已存在时拒绝导入，轮换密钥应使用新别名。应用可在登录后通过自己的 HTTPS 接口获取密钥，再调用 `importAesKey`；也可使用上面的可选 `provisionAesKey`。

encryptJson 返回 `{ nonce, data }`：nonce 为 12 字节，data 包含密文及 16 字节 GCM 标签，两者均为 Base64。
Android 使用 Cipher 和 Keystore；iOS 使用 CryptoKit 和 Keychain（WhenUnlockedThisDeviceOnly，不同步），不提供密钥导出 API；认证失败、缺少密钥或无效输入会抛出异常。
decryptJson 的泛型仅提供类型断言，业务对象应由应用校验。
协议未加入 AAD、keyId 或防重放机制；这些业务要求需要后续协商，时间戳不能单独防重放。
不支持的平台会明确报错。普通导入不保证所有设备都具备硬件密钥保护。

已有 `/aes` 子路径仍保留原来的 @noble/ciphers API，需要显式传入密钥，不使用 Keystore。

## 演示和验证

demo 底部“测试”tab 的“AES 加解密测试”提供接口/JWT 输入、手动测试密钥导入、检查/删除、JSON 加密/解密。运行步骤见 [demo 文档](../../demo-app/README.md)。
AES 演示中的 JWT 和密钥输入会在操作结束后清空，登录流程由业务应用管理。
普通 JVM 单测验证 GCM 数据处理；Keystore 导入、删除、进程重启后保留必须在 Android 设备验证。
Android 正常清缓存保留密钥，清除应用数据或卸载后需重新配置。

宿主需声明 INTERNET；使用联网状态工具时还需 ACCESS_NETWORK_STATE，均无需运行时权限申请。
发布前补充作者、仓库和许可证，并检查 `npm pack --dry-run`。包配置为公开发布。

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

## iOS 验证与互通

使用现有 demo 的 AES 页面运行本地验证：导入、重复拒绝、中文往返、随机 nonce、篡改拒绝、删除和删除后拒绝解密。
页面同时解密由 Android 原始 JsonBodyCipher 在 JVM 生成的 128/192/256-bit 公共测试向量，并输出 `AES_INTEROP` 供反向 JVM 验证。
`ios/nativescipt-common/tests/Interop.java` 使用生产 Cipher 代码生成/解密消息；只使用全零公开测试密钥，不能用于真实数据。

iOS Keychain 在锁屏时可能不可访问；卸载后可能保留条目，退出登录时按业务要求显式删除。
原始密钥经过 JS/Swift 内存，清除引用无法保证全部副本立即擦除。iOS AES 密钥不使用 Secure Enclave。
原生接口参考 [iOS 工程说明](../../ios/README.md)。

桥接方式遵循 [NativeScript 原生插件说明](https://old.docs.nativescript.org/plugins/plugin-reference)，
AES 实现使用 [Apple CryptoKit AES.GCM](https://developer.apple.com/documentation/cryptokit/aes/gcm)。

已验证（2026-10-10）：TS/桥接测试 6 项、Android JVM 测试 8 项、真机/模拟器 XCFramework 构建、
完整 npm pack、demo Vue 类型检查、iOS 模拟器编译运行，以及生产 Android Cipher 与 CryptoKit 的 AES-128/192/256 双向互通。
Windows 产物检查分支通过平台模拟验证；未在 Windows 实机执行构建。未在真实 iPhone 或真实密钥服务器测试。

## 附加认证数据（AAD）

原有 `encryptJson`、`decryptJson` 保持兼容。新增方法使用字符串形式的 AAD，Android/iOS 均按 UTF-8 编码，不自动规范化或序列化。

```ts
import { encryptJsonWithAssociatedData, decryptJsonWithAssociatedData } from '@ajax-js/nativescript-common';

const aad = 'device-123/message/v1';
const body = encryptJsonWithAssociatedData(alias, { message: '你好' }, aad);
const value = decryptJsonWithAssociatedData<{ message: string }>(alias, body, aad);
```

AAD 只参与认证，不加密，也不会自动放入返回的 `{ nonce, data }`。调用方负责传输或重建相同 AAD。非空 AAD 消息用旧方法解密、或者使用不同 AAD 时均认证失败，不返回明文。空字符串等同无 AAD，可与旧方法双向兼容。不得将 null/undefined 当作空字符串传入。

新增接口需要更新对应原生 JAR/XCFramework；仅更新 TS 无法调用旧原生组件中不存在的方法。

## Toast 和 iOS Helper

```ts
import { toast, com as commonNative } from '@ajax-js/nativescript-common';

toast('操作成功');

const iosHelper = commonNative.ajaxjs.nativescript.ios.Helper;
const version = iosHelper.getAppVersionName();
const build = iosHelper.getAppBuildNumber();
iosHelper.openAppInAppStore('123456789', true);
```

`toast(message): void` 在 Android 使用原有 `Helper.toast` 和应用 Context，在 iOS 使用活动窗口中的轻量 Toast。
空白字符串忽略；非字符串或不支持的平台抛出异常。iOS 提示两秒后消失、不阻挡触摸，连续调用替换旧提示；无活动窗口时记录日志。
调用不等待 UI 显示完成，原生端切回主线程。demo 的“测试”tab 提供 Toast 测试按钮，保留底部 tabs。

iOS 工具源码位于 `ios/nativescipt-common/Sources/com/ajaxjs/nativescript/ios`，从原工程 Helper.swift 及其 AppToast.swift 复制。
Swift 采用 Framework 模块而非 Java 包机制，原生 Objective-C 类名为 `AjaxJSIOSHelper`，避免宿主的同名 Helper 冲突；
TS 提供上述 `com.ajaxjs.nativescript.ios.Helper` 命名空间，所有方法在非 iOS 平台调用均抛出 Error。

| 方法 | 参数与行为 |
| --- | --- |
| showToast(message) | 提示文本，行为同 iOS toast |
| getAppVersionName() | 返回宿主 CFBundleShortVersionString，缺失返回 Unknown |
| getAppBuildNumber() | 返回宿主 CFBundleVersion 字符串，缺失返回 Unknown |
| openAppInAppStore(appleID, isInternational?) | ID 为纯 ASCII 数字，无 id 前缀；默认中国区，true 不限定地区；打开失败尝试 HTTPS，无效 ID 或最终失败记录日志 |
| setLandscapeOrientation() | 沿用原工程的设备方向设置，横屏向左 |
| setPortraitOrientation() | 沿用原工程的设备方向设置，竖屏 |
| requestOrientationChange() | iOS 16+ 请求场景横屏向右 |
| forcePortrait() | iOS 16+ 请求场景竖屏 |

方向方法无返回值，受宿主支持方向、视图控制器和系统限制；iOS 16+ 建议使用场景请求方法。
两个场景方法在低版本 TS 调用会抛出 Error，在无场景时不执行操作，系统拒绝时记录日志。
原生直接调用这两个方法须由调用方检查 iOS 16 可用性。App Store 和方向功能保留原工程行为，不在自动测试中实际跳转或改变方向。

2026-10-12 Helper 验证：10 项 TS/桥接测试通过，真机和模拟器 XCFramework 构建、完整 npm pack、demo 类型检查及 iOS 编译通过。
iPhone 17 Pro / iOS 26.5 模拟器实际显示 Toast、约两秒后自动消失，底部 tabs 保留；版本/构建读取返回 1.0/1.0。
