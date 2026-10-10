# @ajax-js/nativescript-mqtt-v3

Android 8.0+ / NativeScript 9 的 MQTT 3.1.1 文本客户端，基于 Eclipse Paho 1.2.5。
仅支持 Android，进程内一个连接；导入模块不会自动连接。

## 安装与宿主配置

`npm install @ajax-js/nativescript-mqtt-v3`

npm 包包含 JAR，`platforms/android/include.gradle` 自动添加 Paho Maven 依赖。
不要再把相同 JAR 手动放进 App_Resources/Android/libs。
在宿主 AndroidManifest.xml 的 manifest 中声明网络权限，并在 application 中注册服务：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<application>
    <service android:name="com.ajaxjs.nativescript.android.mqttv3.MqttService" android:exported="false" />
</application>
```

以上 application 片段需合入现有节点。宿主 minSdkVersion 至少 26。
这是绑定服务，不保证进程被系统终止后保持连接或长期后台运行。

## 使用

```ts
import { mqtt } from '@ajax-js/nativescript-mqtt-v3';

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
固定使用 MQTT 3.1.1、cleanSession=false，稳定 clientId 用于持久会话。stop 不删除 Broker 保存的会话。
默认使用 Paho 断线重连；首次连接失败由 5 秒检查任务重试。watchDog=true 时改由检查任务负责恢复连接。
支持 UTF-8 文本，JSON、AES、JWT 和业务主题由应用负责。
TLS 使用平台/Paho 默认验证，第一版不提供自定义证书、遗嘱、二进制消息或多客户端接口。

## 构建与发布

Java 工程在 `android/nativescipt-mqtt-v3`，可由 Android Studio 直接打开。
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
本地 demo 可安装生成的 `ajax-js-nativescript-mqtt-v3-0.1.0.tgz`。
demo 底部“测试”tab 中的“MQTT 通讯测试”提供连接、一次性订阅、中文消息往返及停止后重启验证。
默认测试地址为调用方提供的 `tcp://159.75.215.222:1883`，不填写用户名密码；主题使用 `ajaxjs/demo/<时间戳>`。
该地址只用于演示，不属于组件内置配置。

完成验证并更新版本后可 `npm publish`，需有 @ajax-js 的发布权限。
手写原生声明随包发布；与 common 包没有运行时依赖。
旧宿主 com.ajaxjs.android.mqttv5 与新包名不同，可以并存，但应用迁移时应避免同时连接相同 clientId。
