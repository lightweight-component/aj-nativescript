# @ajax-js/nativescript-mqtt

面向 NativeScript 9 的 MQTT 集成包骨架，输出 ESM JavaScript 和类型声明，适用于 NativeScript + Vite 项目。

**当前尚未实现 MQTT 客户端，根入口没有公开功能 API。** 当前没有 MQTT 客户端库或对 common 包的运行时依赖，后续按实际实现添加依赖及使用示例。

## 安装

发布到 npm 后，在 NativeScript 应用中安装：

```sh
npm install @ajax-js/nativescript-mqtt
```

应用需提供 `@nativescript/core@^9.1.3`。

## 开发与本地验证

在 `nativescript-plugin/nativescipt-mqtt` 目录执行：

```sh
npm install
npm run typecheck
npm run build
npm pack
```

在 `src/` 实现功能，并从 `src/index.ts` 导出公开 API。`npm run dev` 监听源码变化；`npm run clean` 清理 dist；构建先清理再编译，避免发布遗留文件。`npm pack` 自动构建，生成 `ajax-js-nativescript-mqtt-0.1.0.tgz`。

从仓库的 `demo-app` 目录安装：

```sh
npm install ../nativescript-plugin/nativescipt-mqtt/ajax-js-nativescript-mqtt-0.1.0.tgz
```

修改后重新打包、安装，并验证应用构建和设备运行。

## 类型与发布

- `src/`：TS 实现，编译到 `dist/`，自动生成 `.d.ts`。
- `types/ajaxjs-nativescript.d.ts`：手写原生环境声明，随包发布并由入口声明引用；声明本身不提供原生实现。
- `@nativescript/core` 是宿主依赖；开发依赖中的副本及 `@nativescript/types` 用于编译。

发布前完成客户端实现、补充使用示例、作者、仓库及许可证，并运行 `npm pack --dry-run` 检查内容。包配置为公开发布；`npm publish` 需要对应 npm scope 的权限。版本变化时同步更新文档中的安装包文件名。

`sideEffects: false` 要求导入模块时不自动连接 MQTT 或注册全局监听器；连接及资源释放应由使用方显式调用。以后改变这些行为时应调整配置。
