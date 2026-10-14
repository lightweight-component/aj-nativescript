---
title: 通用工具
description: Android 与 iOS 一致的 Toast 和剪贴板 TypeScript 接口
tags:
  - NativeScript
  - 通用工具
layout: docs.njk
---

# 通用工具

`nativescript-plugin/nativescipt-common/src/common-helper.ts` 定义 Android 与 iOS 共用的工具 API。业务代码使用相同的 TypeScript 方法签名，无需传入 Context 或分支判断平台。

安装 `@ajax-js/nativescript-common` 后从包入口导入：

```ts
import { toast, copyToClipboard, getFromClipboard }
    from '@ajax-js/nativescript-common';

toast('保存成功');
copyToClipboard('  中文 🔐\n第二行  ');
const text: string = getFromClipboard();
```

| 方法 | 参数 | 返回值 |
| --- | --- | --- |
| `toast(message: string): void` | 提示文本；空白字符串忽略 | 不等待显示或关闭 |
| `copyToClipboard(str: string): void` | 原始文本，允许空字符串 | 正常返回表示原生写入完成 |
| `getFromClipboard(): string` | 无 | 可读文本；没有可读内容时返回空字符串 |

Android JAR 与 iOS XCFramework 随插件集成；更新原生组件后必须重新构建宿主 App，仅刷新 JS 不会更新原生能力。Android 当前 demo 最低为 API 26，iOS 插件最低为 iOS 15。

## Toast

```ts
toast('操作成功');
```

非空提示保留原始文本，纯空白提示不显示。Android 使用系统 Toast.LENGTH_SHORT，并自动获取应用 Context；后台线程调用由原生侧切回主线程。iOS 在前台活动窗口显示约两秒，连续调用替换旧提示，不阻挡触摸；没有活动窗口时只记录日志。

返回 `void` 不表示提示已显示。提示样式、实际时长及连续提示行为由各平台实现决定，统一的是调用签名。包入口的 `toast` 会拒绝非字符串参数，不支持的平台或 Android 应用尚未初始化时抛出异常。

### 验证调用后的代码是否执行

demo-app 的“测试”tab → “Toast 执行连续性测试”提供专门的诊断页面，分别调用包入口的 `toast` 和当前 `common-helper.ts` 封装。页面及控制台记录调用前、调用返回、后续同步计数、微任务、调用前后安排的计时器和 3 秒回调；全部执行后输出 `TOAST_FLOW_CHECK:PASS`。出现异常时页面显示失败，日志记录堆栈。

已在 iPhone 17 Pro / iOS 26.5 与 Pixel 9 Pro XL / Android 15（API 35）前台主线程验证通过，当前版本未复现“Toast 显示后后续代码不执行”。这些结果不涵盖历史版本或后台线程调用；具体复现时可利用阶段标记确定停止位置。

## 剪贴板

Android 和 iOS 使用相同的 TS 签名：

```ts
import { copyToClipboard, getFromClipboard } from '@ajax-js/nativescript-common';

copyToClipboard('  中文 🔐\n第二行  ');
const value: string = getFromClipboard();
copyToClipboard('');
```

| 方法 | 参数 | 返回值 |
| --- | --- | --- |
| `copyToClipboard(str: string): void` | 原始字符串，允许空字符串 | 正常返回表示原生写入完成 |
| `getFromClipboard(): string` | 无 | 首个可读文本；无内容、不可读或系统未提供文本时为 `''` |

不 trim 或规范化文本，保留空格、换行、Unicode 和前导零；空字符串也会写入，覆盖此前内容。非字符串参数抛出 TypeError。不支持的平台、原生组件缺失、旧组件缺少剪贴板接口、Android Context 未初始化或原生访问失败时抛出异常。

这是同步接口，应在前台页面主线程响应用户点击调用。系统可能显示复制提示或粘贴授权；后台访问和跨应用读取受系统隐私规则限制，返回空字符串不能区分空内容与系统未提供内容，接口不绕过权限。

Android 使用 ClipboardManager，读取 ClipData 的首个项目并调用 coerceToText；URI 等非文本项目可能转换为文本。iOS 使用 UIPasteboard.general.string，只读取首个字符串，不提供图片或文件读取。iOS 后台线程调用会同步切回主线程，调用方不能在主线程阻塞等待该后台线程，否则可能死锁。

已在 Pixel 9 Pro XL / Android 15（API 35）与 iPhone 17 Pro / iOS 26.5 模拟器通过文本自检，双端日志均出现 `CLIPBOARD_SELF_CHECK:PASS`；iOS 另手动验证复制与读取按钮。跨应用粘贴授权、后台访问限制及图片/URI 场景未作实机验证。

完整实现位于插件 `src/common-helper.ts`。原生更新后需重新构建宿主 App。demo-app 的“测试”tab → “剪贴板测试”提供输入、复制、读取和自检按钮；读取结果用 JSON 字符串展示以便检查空白。自检验证 Unicode、换行、空白、空字符串和覆盖，日志成功标记为 `CLIPBOARD_SELF_CHECK:PASS`。自检结束恢复先前可读文本，不能恢复剪贴板图片、多项目或其他原始格式。

## 相关文档

- [安卓工具类](../android/)：Helper 和 MarketRedirect 的 Android 专用 TS 调用。
- [iOS 工具类](../ios/)：应用版本、App Store 和方向等 iOS 专用能力。
- [安卓原生工具](../android-native/)：供 Java 原生代码使用的 HttpRequest 和 Utils。
- [KeyStore 与 AES](../keystore-aes/)：密钥管理、AES-GCM / AAD 和机器人 HKDF 派生协议。
