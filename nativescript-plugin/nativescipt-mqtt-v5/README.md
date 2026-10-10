# @ajax-js/nativescript-mqtt-v5

Android 8.0+ / NativeScript 9 的 MQTT 5.0 文本客户端，基于 Eclipse Paho 1.2.5。
仅支持 Android，进程内一个连接；导入模块不会自动连接。

## 安装与宿主配置

首次发布前，在插件目录执行 `npm pack`，再在宿主工程执行 `npm install <生成的 tgz 路径>`。发布后可执行 `npm install @ajax-js/nativescript-mqtt-v5`。

npm 包包含 JAR，`platforms/android/include.gradle` 自动添加 Paho Maven 依赖。
该配置还排除 Paho 的 `bundle.properties` 元数据，避免同时安装 v3 与 v5 时出现资源冲突。
不要再把相同 JAR 手动放进 App_Resources/Android/libs。
在宿主 AndroidManifest.xml 的 manifest 中声明网络权限，并在 application 中注册服务：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<application>
    <service android:name="com.ajaxjs.nativescript.android.mqttv5.MqttService" android:exported="false" />
</application>
```

以上 application 片段需合入现有节点。宿主 minSdkVersion 至少 26。
这是绑定服务，不保证进程被系统终止后保持连接或长期后台运行。

## 使用

```ts
import { mqtt } from '@ajax-js/nativescript-mqtt-v5';

await mqtt.start({
    serverUri: 'ssl://your-broker.example:8883',
    clientId: 'your-unique-client-id',
    username: brokerUsername,
    password: brokerPassword
}, {
    onConnected: reconnect => console.log('connected', reconnect),
    onMessage: message => handleMessage(message.topic, message.payload),
    onConnectionLost: error => handleConnectionError(error),
    onSubscribed: (topic, error) => handleSubscriptionResult(topic, error),
    onPublished: (topic, error) => handlePublishResult(topic, error)
});

mqtt.subscribe('your/topic/#', 1);
mqtt.publish('your/topic/command', JSON.stringify({ command: 'test' }), 1, false);
mqtt.subscribeOnce('your/response/topic', message => handleResponse(message.payload));
mqtt.unsubscribe('your/topic/#');
mqtt.reconnect();
mqtt.stop();
```

事件在主线程回调；start/stop 必须在主线程调用。start 等待首次连接，默认最多 20 秒，超时会停止；停止后可重新配置并启动。
操作返回不代表 Broker 已确认，订阅和发布通过事件报告结果。unsubscribe 暂无独立结果事件。
断线期间订阅意图保留，重连恢复；发布失败会报告事件，不缓存正文。
一次性订阅限精确且未被普通订阅占用的主题；首次消息也会触发 onMessage，取消或 stop 会清除回调。
同一主题的普通订阅会取代一次性订阅。
固定使用 MQTT 5.0，不会降级到 MQTT 3。Broker 必须支持 MQTT 5。
cleanStart 默认 false；sessionExpirySeconds 默认 86400（一天），范围为 0～4294967295，0 表示断线后不保留会话。
稳定 clientId 用于恢复会话；Broker 可限制实际保留时间。stop 不主动删除 Broker 会话，已有会话会按过期时间清理。
cleanStart=true 会在首次连接时清除已有会话；Paho 自动重连会恢复会话。
订阅及发布确认中的失败原因码（>=128）会通过对应事件报告为原生异常。
本版提供基础文本通讯与会话配置，暂未向 TS 暴露用户属性、响应主题、关联数据、消息过期、订阅选项或增强认证。
默认使用 Paho 断线重连；首次连接失败由 5 秒检查任务重试。watchDog=true 时改由检查任务负责恢复连接。
支持 UTF-8 文本，JSON、AES、JWT 和业务主题由应用负责。
TLS 使用平台/Paho 默认验证，第一版不提供自定义证书、遗嘱、二进制消息或多客户端接口。

## 构建与发布

Java 工程在 `android/nativescipt-mqtt-v5`，可由 Android Studio 直接打开。
构建机需要 JDK 17、Android SDK 35；SDK 路径由 Java 工程 local.properties 或 ANDROID_HOME 提供。

在插件目录执行：

```powershell
npm install
npm run typecheck
npm test
npm pack
```

prepack 自动构建 JAR、复制到 platforms/android、编译 TS 和声明文件。
Java 单测在 Java 工程执行 `./gradlew test`。
本地 demo 可安装生成的 `ajax-js-nativescript-mqtt-v5-0.1.0.tgz`。
demo 底部“测试”tab 中的“MQTT v5 通讯测试”提供连接、一次性订阅、中文消息往返及停止后重启验证。
默认测试地址为调用方提供的 `tcp://159.75.215.222:1883`，不填写用户名密码；主题使用 `ajaxjs/demo/v5/<时间戳>`。
该地址只用于演示，不属于组件内置配置。

完成验证并更新版本后，在本目录执行：

```powershell
npm publish
```

需有 @ajax-js 的发布权限。npm publish 同样触发 prepack，自动构建 JAR 与 TS 产物，无需指定安装包文件名。
手写原生声明随包发布；与 common 包没有运行时依赖。
v3 与 v5 使用独立的 npm 包、Java 包名和服务，可以同时安装；同时连接时应使用不同 clientId。
现有业务迁移可更换 import 为 @ajax-js/nativescript-mqtt-v5，并注册 v5 服务；常用 start/stop/subscribe/subscribeOnce/publish/unsubscribe/reconnect 签名保持一致。

可选真实 Broker 测试，在 Java 工程目录执行：

```powershell
$env:MQTT_TEST_BROKER = 'tcp://your-broker:1883'
.\gradlew.bat test --rerun-tasks
```

测试使用独立主题，验证 MQTT 5 中文消息往返、会话恢复，并清理测试会话。未设置环境变量时跳过联网测试。

Paho 官方实现：[Eclipse Paho MQTT 5 Java](https://github.com/eclipse-paho/paho.mqtt.java/blob/master/MQTTv5.md)。

演示运行步骤见 [demo 文档](../../demo-app/README.md)，单独构建 JAR 及 Java 测试见 [Java 工程文档](../../android/nativescipt-mqtt-v5/README.md)。原生通讯需在 Android 真机或模拟器上验证。
