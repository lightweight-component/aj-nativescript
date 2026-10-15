---
title: 通用工具
description: Android 与 iOS 一致的 Confirm、Toast、剪贴板及安全存储接口
tags:
  - NativeScript
  - 通用工具
layout: docs.njk
---

# 通用工具

`nativescript-plugin/nativescipt-common/src/common-helper.ts` 定义 Android 与 iOS 共用的工具 API，包括原生 Confirm、Toast 和剪贴板。`secure-storage.ts` 另提供统一字符串安全存储，用于 Token 与 MQTT 凭据。业务代码使用相同的 TypeScript 方法签名，无需传入 Context 或分支判断平台。

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
| `setSecureItem(key, value): Promise<void>` | 非空白键名、字符串值 | 写入或覆盖，失败 reject |
| `getSecureItem(key): Promise<string \| null>` | 原始键名 | 不存在 null，空字符串仍为空字符串；失败 reject |
| `removeSecureItem(key): Promise<void>` | 原始键名 | 幂等删除，失败 reject |
| `confirm(options): Promise<boolean>` | 正文、标题、按钮文案及配色、正文对齐、蒙层关闭设置 | 确认 true，其余正常关闭 false；显示或参数错误 reject |
| `toast(message: string): void` | 提示文本；空白字符串忽略 | 不等待显示或关闭 |
| `copyToClipboard(str: string): void` | 原始文本，允许空字符串 | 正常返回表示原生写入完成 |
| `getFromClipboard(): string` | 无 | 可读文本；没有可读内容时返回空字符串 |

Android JAR 与 iOS XCFramework 随插件集成；更新原生组件后必须重新构建宿主 App，仅刷新 JS 不会更新原生能力。Android 当前 demo 最低为 API 26，iOS 插件最低为 iOS 15。

## 原生 Confirm

```ts
import { confirm } from '@ajax-js/nativescript-common';

const accepted = await confirm({
    title: '删除机器人',
    message: '确定删除这台机器人吗？\n此操作需要确认。',
    okText: '删除',
    cancelText: '保留',
    okColor: '#D9363E',
    cancelColor: '#E2E2E2',
    okTextColor: '#FFFFFF',
    cancelTextColor: '#333333',
    position: 'LEFT',
    maskClosable: false
});

if (accepted) {
    /*
     * 执行已确认的业务操作。
     */
}
```

`confirm(options: ConfirmOptions): Promise<boolean>` 使用原生 Java/Swift 布局，白色圆角卡片、两个等宽圆角按钮，长正文在卡片内滚动。无需宿主提供 XML、Swift 源码或 i18n 实例。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `message` | 必填 | 字符串，可为空；保留空格、换行和 Unicode |
| `title` | `提示` | 空字符串使用默认文案 |
| `okText` / `cancelText` | `确认` / `取消` | 业务可传入翻译后的文案，空字符串使用默认值 |
| `okColor` / `cancelColor` | `#71A3DF` / `#E2E2E2` | 按钮背景色，支持 NativeScript Color 的字符串格式 |
| `okTextColor` / `cancelTextColor` | `#FFFFFF` / `#333333` | 按钮文字颜色 |
| `position` | `CENTER` | `LEFT`、`RIGHT`、`CENTER`、`TOP`、`BOTTOM`；兼容原组件的正文对齐含义，不是弹窗在屏幕上的位置 |
| `maskClosable` | `false` | true 时点击卡片外蒙层取消，false 时蒙层不关闭 |

`TOP/BOTTOM` 保留参数兼容，正文按内容自然高度显示，两端不移动弹窗。确认返回 true，取消按钮、允许的蒙层点击、Android 返回键以及宿主退出前台/关闭返回 false。无活动 Activity 或 iOS 前台窗口也返回 false。

并发调用在 TS 层排队，一个关闭后才显示下一个，每个请求只完成一次。参数类型或颜色无效、原生组件过旧、不支持的平台、创建或显示错误会 reject，失败不会阻塞后续队列。业务应使用 try/catch 区分显示失败与用户取消。

Android 原生入口为 `com.ajaxjs.nativescript.android.utils.ConfirmDialog.show(activity, optionsJson, callback)`；iOS 为 `AjaxJSConfirmDialog.showCompletion(optionsJson, callback)`，源码位于 `Sources/com/ajaxjs/nativescript/ios/ConfirmDialog.swift`。原生 JSON 的颜色字段统一使用 `#AARRGGBB`，TS 已通过 NativeScript Color 转换；直接原生调用需遵循此格式并自行避免同时展示多个弹窗。

由旧宿主 `dialog.ts` 迁移时，可以保留参数对象和 `await` 调用，改为从插件导入 `confirm`。默认文案不再自动读取宿主的 i18n，应显式传入 `title`、`okText`、`cancelText` 的翻译结果；返回键及蒙层取消不再留下未完成 Promise。

已在 Pixel 9 Pro XL / Android 15 API 35（9 项界面检查）与 iPhone 17 Pro / iOS 26.5（5 项 XCTest）验证，包含确认/取消、蒙层策略、长正文、并发队列、错误恢复和后台取消，await 后代码正常执行。未验证真机、旋转或读屏操作。复测脚本与构建记录见 demo-app/README.md。

demo 入口：“测试”tab → “原生 Confirm 测试”。页面提供默认、自定义配色、两种蒙层策略、长正文、并发队列和无效配色测试，使用 `CONFIRM_CHECK` 日志及完成计数检查 await 后代码。

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


## 字符串安全存储

用于保存后端通过 HTTPS 下发的登录 Token、refreshToken 和 MQTT 账号密码。接口从包入口导出，字符串原样保存，不 trim、不规范化、不自动序列化或解析 JSON；同名键写入会覆盖旧值。

```ts
import { setSecureItem, getSecureItem, removeSecureItem }
    from '@ajax-js/nativescript-common';

await setSecureItem('auth.accessToken', response.accessToken);
await setSecureItem('mqtt.credentials', JSON.stringify({
    username: response.mqtt.username,
    password: response.mqtt.password,
    expiresAt: response.mqtt.expiresAt
}));

const token = await getSecureItem('auth.accessToken');
const stored = await getSecureItem('mqtt.credentials');
if (stored !== null) {
    const credentials = JSON.parse(stored);
    /*
     * 校验业务字段及过期时间，再交给 MQTT 客户端；不要打印凭据。
     */
}

/*
 * 退出登录时删除；多项删除并非一个原子事务，业务应处理失败并重试。
 */
await removeSecureItem('auth.accessToken');
await removeSecureItem('mqtt.credentials');
```

键名必须是非空白的合法 Unicode 字符串，最多 128 个 UTF-16 单元；键名中的空格及大小写有意义，建议用固定名称而不是用户输入。值必须是合法 Unicode 字符串，允许空字符串，最多 65536 UTF-8 字节；emoji 按 UTF-8 字节计数，拒绝未配对代理项。JSON 序列化、字段验证、凭据过期及刷新由业务处理。多用户或多个 MQTT 服务端可使用不同键名隔离。

只有未找到项时返回 null，保存的空字符串返回 `''`。读取到损坏数据、设备密钥丢失/失效、Keychain 暂时不可访问或原生错误时 reject，不能静默当作 null。写入完成后 Promise 才 resolve；同一进程调用按提交顺序执行，失败不会阻塞后续操作。原生磁盘/Keychain 操作当前是同步小型 I/O，Promise 不表示后台线程，不适合大文件或高频缓存。不支持多个 Android 进程同时写入。

### 平台存储与生命周期

| 平台 | 实现 |
| --- | --- |
| Android | 首次写入时在 AndroidKeyStore 生成独立、不可导出的 AES-256 密钥。使用 AES-GCM，每次由系统生成随机 12 字节 nonce，认证标签 16 字节；AAD 绑定存储命名空间及原始键名，防止密文换名后被误读。每项以 SHA-256 键名摘要命名，通过 AtomicFile 提交至 `Context.getNoBackupFilesDir()/ajaxjs-secure-storage-v1`，不进入系统自动备份或设备迁移。密钥是否硬件保护取决于设备，不保证 StrongBox。 |
| iOS | 独立 `kSecClassGenericPassword` Keychain service，`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`，不启用同步。设备解锁时可访问，仅限本设备，不能通过备份迁移到另一设备。锁屏读取可能失败，业务可在解锁后重试。 |

该本机存储密钥由 Android 自行生成，不需要后端下发，也不复用机器人 AES 密钥或 HKDF 主密钥。iOS 由系统保护 Keychain 项。两端逻辑数据不跨设备自动同步，重新登录后可由后端重新下发。Android 没有额外要求每次使用生物识别，访问策略不等同于 iOS 的解锁策略；需要后台 MQTT 重连时应考虑这一差异。

Android 卸载/清除数据会清理私有密文及 App 的 Keystore 密钥；如果密文还在但密钥丢失，本接口报错，不自动覆盖密钥或丢弃其他凭据。业务可以明确删除所有已知失效项，再重新领取凭据。iOS Keychain 项可能在卸载重装后仍存在，不应把卸载视作退出登录；退出登录、切换账户或撤销授权时显式删除相关项。删除不承诺闪存物理安全擦除。

安全存储保护的是落盘数据；使用 Token/MQTT 登录时明文仍会进入进程内存，不保证抵御已经控制 App 进程的攻击者。不要在日志、崩溃上报或调试界面输出凭据。HTTPS/MQTT TLS、后端权限控制、过期与撤销仍由业务配置。

### 从 ApplicationSettings 迁移

以下旧键名仅作示例，应换成项目原有的实际 Token 键。读取新存储失败时让异常向上传播，不在 catch 中回退到旧明文。新存储已有值时，直接删除遗留明文；没有新值时先写成功，再删旧值。不要调用 ApplicationSettings.clear()，以免删除其他业务配置。

```ts
import { ApplicationSettings } from '@nativescript/core';
import { getSecureItem, setSecureItem } from '@ajax-js/nativescript-common';

async function loadToken(): Promise<string | null> {
    const current = await getSecureItem('auth.accessToken');
    if (current !== null) {
        ApplicationSettings.remove('oldToken');
        return current;
    }
    if (!ApplicationSettings.hasKey('oldToken'))
        return null;

    const previous = ApplicationSettings.getString('oldToken');
    await setSecureItem('auth.accessToken', previous);
    ApplicationSettings.remove('oldToken');
    return previous;
}
```

如果旧明文曾进入备份，删除本机旧值不等于撤销历史副本，可通过服务端刷新/撤销 Token 处理。此插件不自动查找或迁移宿主的 ApplicationSettings，也不自动请求后端。

### 原生桥接与 demo

TS 实现为 `nativescript-plugin/nativescipt-common/src/secure-storage.ts`。Android 原生类为 `com.ajaxjs.nativescript.android.storage.SecureStorage`，方法为 `setItem(context, key, value)`、`getItem(context, key)`、`removeItem(context, key)`；iOS 为 `AjaxJSSecureStorage.setItemValue(key, value)`、`getItem(key)`、`removeItem(key)`，统一返回 CryptoResult，须先检查 error，再读取 value。写入/删除成功 value=true，读取不存在 value=null。

更新后必须重建 JAR、XCFramework 和宿主 App。Android 使用 metadata 白名单时包含 `com.ajaxjs.nativescript.android*:*`，否则可能找不到新类。默认无需新增网络、存储权限或 Keychain entitlement；共享 App Group/Keychain access group 不在本接口范围。

demo 入口：“测试”tab → “安全存储测试”。自检仅用公开虚拟凭据，检查缺失与空值、Unicode 与空格、覆盖、多项隔离、并发顺序、64 KiB 边界、旧设置迁移、幂等删除、现有 AES 密钥隔离和临时数据清理。另提供“写入重启测试数据”和“验证重启后数据并清理”，验证跨进程持久化。自动化脚本与实际结果见 demo-app/README.md。
