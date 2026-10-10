# @ajax-js/nativescript-common

NativeScript 9 / Android 8.0+ 公共工具与 Android Keystore JSON 加解密组件。

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
打包会自动构建 `android/nativescipt-common/aj-nativescript`，将运行用的 JAR 放入 `platforms/android`。
需要 JDK 17 和 Android SDK Platform 35；路径使用 `android/nativescipt-common/local.properties` 或 `ANDROID_HOME`。

在 demo-app 中执行：

```sh
npm install ../nativescript-plugin/nativescipt-common/ajax-js-nativescript-common-0.1.0.tgz
npx ns build android
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

密钥请求和导入经过 JS 及 Java 内存。代码不记录密钥或 JWT，不写入文件；清理引用不能保证立即擦除字符串。
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
使用 Android Cipher 和 Keystore 密钥，不导出密钥；认证失败、缺少密钥或无效输入会抛出异常。
decryptJson 的泛型仅提供类型断言，业务对象应由应用校验。
协议未加入 AAD、keyId 或防重放机制；这些业务要求需要后续协商，时间戳不能单独防重放。
不支持的平台会明确报错。普通导入不保证所有设备都具备硬件密钥保护。

已有 `/aes` 子路径仍保留原来的 @noble/ciphers API，需要显式传入密钥，不使用 Keystore。

## 演示和验证

demo 底部“测试”tab 的“AES 加解密测试”提供接口/JWT 输入、手动测试密钥导入、检查/删除、JSON 加密/解密。运行步骤见 [demo 文档](../../demo-app/README.md)。
AES 演示中的 JWT 和密钥输入会在操作结束后清空，登录流程由业务应用管理。
普通 JVM 单测验证 GCM 数据处理；Keystore 导入、删除、进程重启后保留必须在 Android 设备验证。
正常清缓存保留密钥，清除应用数据或卸载后需重新配置。

宿主需声明 INTERNET；使用联网状态工具时还需 ACCESS_NETWORK_STATE，均无需运行时权限申请。
发布前补充作者、仓库和许可证，并检查 `npm pack --dry-run`。包配置为公开发布。

## 发布

完成验证、更新版本号并确认具有 @ajax-js 发布权限后，在本目录执行：

```powershell
npm publish
```

npm pack 和 npm publish 都触发 prepack，自动构建并携带 JAR、TypeScript 产物及声明文件。npm publish 无需指定安装包文件名。

单独构建 Java JAR 及运行 Java 测试，见 [公共 Java 工程](../../android/nativescipt-common/README.md)。
