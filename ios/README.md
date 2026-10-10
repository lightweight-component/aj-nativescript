# iOS 原生组件

common 使用独立 Xcode Framework 工程 [nativescipt-common](nativescipt-common)，不创建独立原生 App。
产物由现有 NativeScript + Vue + Vite demo 加载。最低 iOS 15（当前 Xcode 27 支持的最低部署版本）。

在 `nativescript-plugin/nativescipt-common` 执行 `npm run build:ios`。
构建真机 arm64、模拟器 arm64/x86_64 archive，并生成
`platforms/ios/AjaxJSCommon.xcframework`。源码使用 Foundation、Security、CryptoKit，
通过 NSObject/@objc 暴露接口。无需第三方 CocoaPods 或 Keychain sharing entitlement。

密钥存于当前宿主应用的 Keychain：generic password，service 为
`com.ajaxjs.nativescript.common.aes`，account 为原样 alias，
`WhenUnlockedThisDeviceOnly`，禁用同步。卸载后 Keychain 项可能仍保留；不能依赖卸载删除密钥。
密钥可在原生内存中读取供 CryptoKit 使用，不承诺 Secure Enclave AES 或不可导出的硬件保护。
框架不暴露导出接口。

`CryptoResult.error` 非空表示失败；成功 `value` 分别为布尔值、nonce/data 字典或 UTF-8 字符串。
TS 包装层统一转为 Error。Swift 源码和随包声明描述每个方法的参数、返回值与失败条件。
