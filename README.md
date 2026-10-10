# aj-nativescript

面向 NativeScript 的公共工具与 MQTT 通讯组件。Android 原生能力使用 Java 实现，通过独立的 TypeScript 插件提供给应用调用，与 Vue 视图层无关。JAR 随 npm 包发布，安装插件后由 NativeScript 纳入 Android 构建。

目前 Keystore 和 MQTT 原生功能支持 Android 8.0（API 26）及以上，iOS 组件尚未实现。

## 组件

| 组件文档 | 内容 | 状态 |
| --- | --- | --- |
| [common](nativescript-plugin/nativescipt-common/README.md) | Android 公共工具、Keystore 密钥管理、AES-GCM JSON 加解密 | 已实现，已发布 npm |
| [MQTT v3](nativescript-plugin/nativescipt-mqtt-v3/README.md) | 基于 Eclipse Paho 的 MQTT 3.1.1 文本通讯 | 已实现 |
| [MQTT v5](nativescript-plugin/nativescipt-mqtt-v5/README.md) | 基于 Eclipse Paho 的 MQTT 5.0 文本通讯 | 已实现 |

各组件 README 包含安装、API、宿主配置、构建与发布说明。

## 工程目录

| 目录 | 内容 |
| --- | --- |
| android/ | 独立 Java 工程：[common](android/nativescipt-common/README.md)、[MQTT v3](android/nativescipt-mqtt-v3/README.md)、[MQTT v5](android/nativescipt-mqtt-v5/README.md) |
| nativescript-plugin/ | 对应组件的 npm 插件与 TS 类型声明 |
| [demo-app/](demo-app/README.md) | NativeScript 9 + Vue 3 + Vite 演示，含 AES、MQTT v3 / v5 测试入口 |
| ios/ | iOS 原生组件预留目录 |
| docs/ | 文档目录 |

目录名中的 nativescipt 为工程当前使用的名称。各 Java 工程与 npm 包独立构建；运行演示的完整步骤见 [demo README](demo-app/README.md)。

## 仓库与许可证

- [GitCode](https://gitcode.com/lightweight-component/aj-nativescript)
- [GitHub](https://github.com/lightweight-component/aj-nativescript)

本项目采用 [Apache License 2.0](LICENSE)。
