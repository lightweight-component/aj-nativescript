# aj-nativescript-mqtt-v3

独立 Java Gradle 工程，基于 Android API 和 Eclipse Paho MQTT 3.1.1。
在此目录执行 `./gradlew test jar`，产物在 `build/libs/aj-nativescript-mqtt-v3-0.1.0.jar`。
Android SDK 路径由 local.properties 或 ANDROID_HOME 配置，默认 API 35。
普通 JAR 不内嵌 Paho；直接 Java/Android 消费者还需依赖 `org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5`。
宿主需 INTERNET 权限及注册 `com.ajaxjs.nativescript.android.mqttv3.MqttService`，exported=false。
NativeScript 使用与打包说明见 `../../nativescript-plugin/nativescipt-mqtt-v3/README.md`。
