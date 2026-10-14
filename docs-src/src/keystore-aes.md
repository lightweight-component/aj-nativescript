---
title: Keystore 与 AES-GCM
description: NativeScript Android Keystore、iOS Keychain 密钥管理与 AES-GCM JSON/AAD 加解密
tags:
  - AES
  - Keychain
  - Keystore
layout: docs.njk
---

# Keystore 与 AES-GCM

`@ajax-js/nativescript-common` 在 Android 8.0+ 使用 Android Keystore 保存密钥、Cipher 执行 AES-GCM；在 iOS 15+ 使用 Keychain 保存密钥、CryptoKit 执行 AES-GCM。两端共用 TS 接口和消息格式，支持无 AAD 的旧方法及带 AAD 的新方法。

安装与原生产物构建、发布步骤见 [common README](../../nativescript-plugin/nativescipt-common/README.md)。npm 包携带 Android JAR、真机及模拟器 XCFramework、TS 产物和声明文件。升级 AAD 接口须同时更新原生产物并重新构建 App，不能只更新 TS。

## 接口概览

| 方法 | 参数 | 返回值与失败条件 |
| --- | --- | --- |
| `importAesKey(alias, keyBase64)` | 非空白别名，最多 128 个 UTF-16 单元；Base64 密钥解码后为 16、24 或 32 字节 | `void`；无效参数、同名别名或原生存储失败时抛出异常 |
| `hasAesKey(alias)` | 相同别名规则 | `boolean`；无效别名或查询失败时抛出异常；存在不保证后续操作成功 |
| `deleteAesKey(alias)` | 相同别名规则 | `void`；不存在时成功，无效别名或删除失败时抛出异常 |
| `encryptJson(alias, value)` | 已导入的密钥别名、可 JSON 序列化的值 | `EncryptedBody`；序列化、查找密钥或加密失败时抛出异常 |
| `decryptJson<T>(alias, body)` | 已导入的别名、nonce/data 消息体 | `T`，默认 `unknown`；消息体、认证、密钥或 JSON 解析错误时抛出异常 |
| `encryptJsonWithAssociatedData(alias, value, associatedData)` | 前述加密参数及原样 AAD 字符串 | `EncryptedBody`；AAD 非字符串或加密失败时抛出异常 |
| `decryptJsonWithAssociatedData<T>(alias, body, associatedData)` | 前述解密参数及完全相同的 AAD 字符串 | `T`；AAD 无效、不一致或其他解密错误时抛出异常，不返回明文 |
| `provisionAesKey(options)` | HTTPS 地址、JWT、可选正数超时毫秒数 | `Promise<{ keyId, alias }>`；请求、响应验证或导入失败时拒绝 |

这些接口在不支持的平台调用会抛出异常。`JSON.stringify` 的规则适用于加密输入：对象中的 undefined 属性会被省略，循环引用、BigInt 和顶层 undefined 等会失败；泛型只提供类型声明，不验证业务结构。

## Keystore 与 JSON API

```ts
import { importAesKey, hasAesKey, deleteAesKey, encryptJson, decryptJson, type EncryptedBody } from '@ajax-js/nativescript-common';

/*
 * alias 是业务保存的密钥别名；keyBase64 是调用方提供的标准 Base64 AES 密钥。
 */
const alias = 'ajaxjs.aes.demo-v1';
importAesKey(alias, keyBase64);
const exists = hasAesKey(alias);
const encrypted: EncryptedBody = encryptJson(alias, { message: '你好' });
const value = decryptJson<{ message: string }>(alias, encrypted);
deleteAesKey(alias);
```

`keyBase64` 由应用提供，为 16、24 或 32 字节 AES 密钥的标准 Base64。同名别名已存在时拒绝导入，轮换密钥应使用新别名。应用可在登录后通过自己的 HTTPS 接口获取密钥，再调用 `importAesKey`；也可使用上面的可选 `provisionAesKey`。

encryptJson 返回 `{ nonce, data }`：nonce 为 12 字节，data 包含密文及 16 字节 GCM 标签，两者均为 Base64。
Android 使用 Cipher 和 Keystore；iOS 使用 CryptoKit 和 Keychain（WhenUnlockedThisDeviceOnly，不同步），不提供密钥导出 API；认证失败、缺少密钥或无效输入会抛出异常。
decryptJson 的泛型仅提供类型断言，业务对象应由应用校验。
原有方法不传入 AAD；新增 AAD 方法见下节。消息体仍不包含 keyId 或防重放机制，业务需自行设计密钥版本映射和重放检测，时间戳不能单独防重放。
不支持的平台会明确报错。普通导入不保证所有设备都具备硬件密钥保护。

已有 `/aes` 子路径仍保留原来的 @noble/ciphers API，需要显式传入密钥，不使用 Keystore。

## 附加认证数据（AAD）

原有 `encryptJson`、`decryptJson` 保持兼容。新增方法使用字符串形式的 AAD，Android/iOS 均按 UTF-8 编码，不自动规范化或序列化。

```ts
import { encryptJsonWithAssociatedData, decryptJsonWithAssociatedData } from '@ajax-js/nativescript-common';

const aad = '  device-123/消息/v1 🔐  ';
const body = encryptJsonWithAssociatedData(alias, { message: '你好' }, aad);
const value = decryptJsonWithAssociatedData<{ message: string }>(alias, body, aad);
```

AAD 只参与认证，不加密，也不会自动放入返回的 `{ nonce, data }`。调用方负责传输或重建相同 AAD。非空 AAD 消息用旧方法解密、或者使用不同 AAD 时均认证失败，不返回明文。空字符串等同无 AAD，可与旧方法双向兼容。不得将 null/undefined 当作空字符串传入。

新增接口需要更新对应原生 JAR/XCFramework；仅更新 TS 无法调用旧原生组件中不存在的方法。

### 消息格式

```ts
interface EncryptedBody {
    nonce: string;
    data: string;
}
```

两端均使用标准 Base64：`nonce` 解码后为 12 字节；`data` 为密文后接 16 字节 GCM 认证标签，解码后至少 16 字节。每次加密生成新 nonce，接收方必须保存或传输原始 nonce 和完整 data，不应自行丢弃标签。

AAD 是认证输入，不是保密内容。必须由调用方传输或重建完全一致的 UTF-8 字节，包括前后空格、换行、大小写及 Unicode 表示；组件不进行 trim、Unicode 规范化或对象序列化。不要把含有秘密的信息放入需要公开传输的 AAD。

### 新旧方法兼容性

| 加密方式 | 解密方式 | 结果 |
| --- | --- | --- |
| 非空 Unicode AAD | 相同 AAD 的新方法 | 成功 |
| 非空 AAD | 不同 AAD 的新方法 | 认证失败 |
| 非空 AAD | 旧方法 | 认证失败 |
| 旧方法 | 旧方法 | 成功 |
| 旧方法 | 空字符串 AAD 的新方法 | 成功 |
| 空字符串 AAD 的新方法 | 旧方法 | 成功 |

## 机器人一机一密：HKDF-SHA256

新增 `deriveRobotAesKey(masterKeyBase64, robotMac): string` 返回设备密钥的标准 Base64；
`deriveAndImportRobotAesKey(alias, masterKeyBase64, robotMac): void` 在原生侧派生并导入安全存储，不向 JS 返回设备密钥。
两个接口均支持 Android/iOS，参数无效、不支持的平台、旧原生组件或原生操作失败会抛出异常；直接导入还会拒绝重复别名。
`normalizeRobotMac(robotMac): string` 可单独规范化 MAC，`ROBOT_KEY_DERIVATION_V2` 导出固定协议参数。

### v2 字节协议

机器人 MQTT 报文使用 `ver: 2`；此前已确定的 `ver: 1` 保持原定义。v2 的 salt 使用版本后缀 `/v2`，info 仅包含标准化 MAC。通用 AES 接口仍返回 `{nonce, data}`，由 MQTT 业务层添加并校验 `ver` 和 `timestamp`。

| 项目 | 精确定义 |
| --- | --- |
| 算法 | RFC 5869 HKDF-SHA256，完整 Extract + Expand |
| IKM | 主密钥的原始字节：规范标准 Base64 解码后为 16/24/32 字节，必须为安全随机秘密，不能是简单密码 |
| robotMac | 本协议约定机器人稳定的 Wi-Fi STA MAC，不是手机 MAC、SoftAP MAC 或 BLE MAC；接口不自行读取硬件地址 |
| MAC 编码 | 接受 12 位十六进制或六个字节用一致冒号/连字符分隔；仅 ASCII 十六进制，禁止空白及混用分隔符；转为小写无分隔符，保留前导零 |
| salt | `UTF8("ajaxjs/robot/key-derivation/v2")`，固定公开字符串，不是随机 nonce |
| info | `UTF8(normalizedMac)`，仅 12 个 ASCII 字符，不使用前缀或 MAC 的 6 个原始字节 |
| 输出 | 32 字节 AES-256 密钥；TS 返回形式为 44 字符标准 Base64，包含 `=` 填充 |

所有字符串均不含 NUL 结尾，不 trim，不对主密钥字符串做 URL-safe Base64 转换、补填充、哈希或截断。相同主密钥与 MAC 必须产生相同输出，topic 不参与派生，仅作为后续 AES-GCM 的 AAD。

```ts
import { deriveAndImportRobotAesKey, normalizeRobotMac,
    encryptJsonWithAssociatedData, decryptJsonWithAssociatedData }
    from '@ajax-js/nativescript-common';

/*
 * masterKeyBase64 由受控配置提供，为秘密主密钥；不要记录或提交真实值。
 */
const mac = normalizeRobotMac('AA:BB:CC:DD:EE:FF');
const alias = `ajaxjs.aes.robot-v2.${mac}`;
deriveAndImportRobotAesKey(alias, masterKeyBase64, mac);
const topic = `robot/${mac}/command`;
const body = encryptJsonWithAssociatedData(alias, { command: 'stop' }, topic);
const envelope = { ver: 2, timestamp: Date.now(), ...body };
const value = decryptJsonWithAssociatedData(alias, envelope, topic);
```

上例首次导入使用新别名；已有别名拒绝覆盖。主密钥轮换应使用新的别名版本，并在业务侧保存所对应的主密钥版本；库不自动覆盖或判断已有别名是否与当前主密钥一致。

MAC 是公开设备标识，秘密来自主密钥。若每个客户端都持有相同主密钥，任何一处主密钥泄漏都影响全部设备；更强隔离需要在服务端或生产配置阶段派生，再仅分发设备密钥。主密钥经过 JS/原生内存，直接导入接口减少派生密钥在 JS 中暴露，但不保证全部临时副本立即擦除，也不持久化主密钥。

### 公开互通向量

以下主密钥仅用于测试，原始字节为 `00 01 … 1f`，不能用于真实机器人。

```json
{
  "masterKeyBase64": "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  "robotMac": "aabbccddeeff",
  "derivedKeyHex": "ab46f491645c7e09d90c1372c999b1b88e12369d4f5aeb3e5c264e3ce6de9277",
  "derivedKeyBase64": "q0b0kWRcfgnZDBNyyZmxuI4SNp1PWus+XCZOPObeknc="
}
```

完整向量（包含三种主密钥长度、前导零 MAC 和不同 MAC）见 [robot-key-v2.json](../../nativescript-plugin/nativescipt-common/test-vectors/robot-key-v2.json)，也随 npm 包的 `test-vectors` 目录发布。
Android 使用 HmacSHA256 执行 HKDF，iOS 使用 CryptoKit HKDF；基于 [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869.html)。

### ESP32 工程修改提示词

将以下内容交给 ESP32 开发端；它替换先前直接使用固定 AES 密钥的方案。

> 请先检查当前 ESP32 工程的框架、MQTT、JSON、密码库和配置入口，沿用原工程实现，不新建工程。不要提交、推送或发布固件。
>
> 目标：固定秘密主密钥 + 机器人 Wi-Fi STA MAC，通过完整 HKDF-SHA256（Extract + Expand）派生一机一密，再用派生出的 AES-256 密钥执行 MQTT JSON 的 AES-GCM + topic AAD 加解密。
>
> 严格执行本节 v2 字节协议：IKM 为 Base64 解码后的原始 16/24/32 字节安全随机主密钥；salt 为 UTF-8 字符串 `ajaxjs/robot/key-derivation/v2`；info 仅为机器人 Wi-Fi STA MAC 的小写无分隔符 12 位十六进制文本的 UTF-8 字节；输出长度固定 32 字节。全部字符串长度不包含结尾 NUL，不能把 MAC 原始 6 字节当作 info，也不能把主密钥 Base64 文本直接当作 IKM。
>
> 配置若接受 MAC 字符串，严格接受纯 12 位十六进制或六对十六进制字节用一致的冒号/连字符分隔，禁止空白、混用分隔符、非 ASCII 十六进制和非法长度，保留前导零。若从硬件读取，使用已约定的 Wi-Fi STA MAC（ESP-IDF 中检查当前版本读取 ESP_MAC_WIFI_STA 的接口），格式化为每字节两位小写十六进制，不使用 SoftAP、BLE 或随机地址。先报告实际使用的 MAC 来源。
>
> Mbed TLS 可使用当前工程支持的 `mbedtls_hkdf`，选择 SHA-256，确认相关配置启用；不得只执行 Expand，也不能直接用 SHA256(master + MAC)、PBE 或 PBKDF2 替代。检查错误码和各参数的字节长度。
>
> 发送：业务 JSON 序列化成 UTF-8，使用派生设备密钥和最终实际 MQTT topic 的 UTF-8 字节作为 AAD，每次生成新的安全随机 12 字节 nonce，输出 UTF-8 JSON `{ver:2,timestamp,nonce,data}`。timestamp 是 UTC Unix epoch 毫秒 JSON number，用 64 位整数，不能用开机时间代替；未同步时钟时明确报错或等待同步。nonce 为标准 Base64（16 字符）；data 为标准 Base64 的 `[ciphertext][16-byte GCM tag]`，不增加单独 tag 字段。topic 原样保留，不 trim、规范化或附加 NUL。保持原 topic、业务字段、QoS 和 retain 配置，避免重复加密。
>
> 接收：按真实 topic/payload 长度读取并完整重组分片，解析外层四字段，验证 ver=2、timestamp 为有效非负安全整数、严格 Base64、12 字节 nonce、data 至少16字节。拆出末尾16字节 tag，使用实际 topic（不是含通配符的订阅过滤器）作为 AAD，以设备密钥执行带标签验证的解密。Mbed TLS 使用 `mbedtls_gcm_auth_decrypt`，认证成功后才解析明文 JSON 并调用业务处理器；任何失败不得触发机器人动作、泄漏未认证明文或回退至明文/主密钥解密。限制最大消息长度，正确处理缓冲区生命周期、内存分配失败和并发密码上下文。
>
> 主密钥只用于 HKDF，不再直接用于 MQTT AES。本节对应消息 ver=2；此前已确定的 ver=1 协议保持原定义，不能用新派生规则重新解释旧报文。App 与固件需同时切换至 v2，收到非 ver=2 报文明确拒绝，不自动探测或回退。主密钥版本、密钥轮换和旧密钥消息处理需要业务明确配置。ver/timestamp 不包含在 topic AAD 中，因此没有被 GCM 认证，不能把 timestamp 单独视为安全防重放，也不得擅自拼入 AAD 改变协议。
>
> 测试先逐条运行本节链接的公开向量，原始32字节主密钥 `00..1f` + MAC `aabbccddeeff` 必须输出十六进制 `ab46f491645c7e09d90c1372c999b1b88e12369d4f5aeb3e5c264e3ce6de9277`。验证三种主密钥长度、MAC 大小写/分隔符等价、前导零、不合法输入、不同 MAC/不同主密钥产生不同结果。仅测试使用公开密钥，不记录真实主密钥和设备密钥。
>
> 再以派生密钥验证 App→ESP32、ESP32→App 的实际互通、中文/emoji JSON、相同 topic 成功、不同 topic 或去除空格认证失败、错误设备密钥拒绝、nonce/ciphertext/tag 篡改拒绝、每次加密产生不同 nonce、非空 AAD 不兼容旧无 AAD方法、空 AAD 与旧 GCM 方法兼容。正式业务必须使用实际 topic，旧 GCM 兼容测试也使用同一派生设备密钥，不代表兼容之前直接使用主密钥的报文。
>
> 提供公开互通向量和测试结果：MAC、主密钥测试编码、派生结果、完整 topic、业务明文和完整加密外层 JSON。固定 nonce 只用于隔离测试向量，不能用于生产。报告代码改动、主密钥配置、MAC 来源、随机源、时钟同步、MQTT 缓冲区调整、编译和各项测试结果；没有真实 App/ESP32 联调时明确标注未完成，不能把本机往返测试当作双向互通通过。所有新增注释使用多行形式，if 条件后的执行语句另起一行。

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

## 密钥生命周期与平台差异

业务可以直接传入密钥，不必使用 HTTPS 领取接口。原生组件不提供导出密钥的方法；同名别名拒绝覆盖，轮换时使用新别名并保存相应的非秘密密钥版本信息。删除后，旧密文只有重新导入相同密钥才可解密。

Android 清缓存通常保留密钥，清除应用数据或卸载后需要重新配置。iOS 使用 `WhenUnlockedThisDeviceOnly`、禁用同步的 Keychain 条目，锁屏时可能不可访问；卸载后条目可能保留，不能依靠卸载清理密钥。

密钥暂时经过 JS 及 Java/Swift 内存，清除引用不能保证所有字符串或数据副本立即擦除。普通 Android 导入不保证硬件保护，iOS AES 密钥不使用 Secure Enclave。不应记录或自行持久化原始密钥和 JWT。

Android 使用 HTTPS 领取接口时宿主需声明 INTERNET；联网状态工具另需 ACCESS_NETWORK_STATE，均无需运行时权限申请。登录、JWT 刷新、MQTT 连接及重放防护由业务负责。

## demo 验证

demo 底部“测试”tab → “AES 加解密测试”提供 HTTPS/JWT 领取、直接导入、检查/删除及新旧 JSON 加解密按钮，保留底部 tabs。JWT 和密钥输入在操作结束后清空。

先点击“运行 AAD 与旧方式兼容测试”，确认上述六项兼容结果全部通过；再点击“运行本地加解密验证（含 AAD）”，确认日志 `AES_SELF_CHECK:PASS`。测试使用公开临时密钥，结束后删除并重新查询，清理通过记录 `AES_TEST_KEY_CLEANUP:PASS:<测试别名>`。

输入框验证应使用带前后空格的 AAD：相同字符串解密成功，修改或移除空格后认证失败，页面清除之前的明文；恢复原始字符串后再次成功。输入框不能自动 trim 或规范化 AAD。

2026-10-12 已在 iPhone 17 Pro / iOS 26.5 模拟器通过 3 项 XCTest UI 测试，覆盖六项兼容检查、完整自检、空格输入和认证失败后清除明文；临时密钥及界面手动导入的测试密钥均确认清理。该次流程通过 XCTest 实际点击和输入完成，未进行真机验证。运行步骤及详细记录见 [demo 文档](../../demo-app/README.md)。

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

## Android 原生桥接与 API 白名单

如果出现 `Cannot read properties of undefined (reading 'android')`，应先检查原生桥接，不是直接判定为 AES 密钥或 AAD 错误。APK 包含 JAR 类不代表 NativeScript 已生成它们的桥接元数据。

启用了 `App_Resources/Android/native-api-usage.json` 的宿主，应保留现有配置，并在 `whitelist` 中加入 `com.ajaxjs.nativescript.android*:*`。旧工具包 `com.ajaxjs.android*:*` 与 common 插件的新包名不同，不能互相替代。

common 插件也提供 `platforms/android/native-api-usage.json`，通过 `uses` 声明其原生包；宿主设置 `whitelist-plugins-usages: true` 时可自动合并。修改白名单后重新构建并安装 Android App，仅刷新 JS 不会更新桥接元数据。原生桥接缺失时，统一 AES 接口会抛出明确的桥接配置错误。

Keystore 的查询、导入及加解密接口均为同步调用。使用固定本地密钥时，初始化应同步执行并放在同一个 try/catch 内；若将来通过网络取得密钥，应在处理 MQTT 消息前等待初始化完成，不能直接调用未等待的 async 初始化。
