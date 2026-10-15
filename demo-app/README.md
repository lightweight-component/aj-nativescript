# demo-app

NativeScript 9 + Vue 3 + Vite 演示应用，用于验证 common、MQTT v3 和 MQTT v5 插件。

## 原型界面

底部固定“首页”“测试”“我的”三个 tab。“我的”提供点击登录区域，以及设置、关于菜单；登录目前为入口提示，后续接入业务登录。

- 设置：简体中文、正体中文、英文；亮色、暗黑、跟随系统；清除临时缓存。
- 关于：显示官网 www.ajaxjs.com，点击后在应用内 WebView 打开，支持重新加载。

语言和外观选择会保存，并立即更新原型界面。AES、MQTT 独立测试页面保留现有文案。清除缓存仅删除应用临时目录，保留设置、应用数据和 Keystore 密钥。

## 开发环境

需要 Node.js、npm、JDK 17、Android SDK Platform 35 和 Android 8.0+ 真机或模拟器。Node.js 版本需满足项目所用 NativeScript 9 / Vite 8 的要求。SDK 路径通过 ANDROID_HOME 或各 Java 工程的 local.properties 配置。

## 构建插件并运行演示

以下命令在工程根目录的 PowerShell 中开始执行。先打包三个插件，生成 demo 所依赖的本地 npm 安装包：

```powershell
Set-Location nativescript-plugin/nativescipt-common
npm install
npm pack

Set-Location ../nativescipt-mqtt-v3
npm install
npm pack

Set-Location ../nativescipt-mqtt-v5
npm install
npm pack

Set-Location ../../demo-app
npm install
npx ns run android
```

`npm pack` 触发 `prepack`，自动构建 Java JAR、复制到插件的 `platforms/android`，再编译 TypeScript 和声明文件。

demo 当前通过 `file:` 引用三个插件的 `0.1.0` 安装包。升级插件版本后，需要同步修改 `demo-app/package.json` 中的文件名。本地插件修改后，也需要重新打包并安装到 demo。

演示应用底部包含“首页”“测试”“我的”三个 tab。“测试”页通过按钮进入：

- **AES 加解密测试**：导入测试密钥、检查与删除密钥、JSON 加解密，以及可选的 HTTPS 密钥接口测试。
- **MQTT v3 / v5 通讯测试**：连接、订阅、发布、中文消息往返及停止后重新连接。

MQTT 演示默认使用 `tcp://159.75.215.222:1883`，无需账号密码，地址可在界面修改。该地址仅为演示配置，组件不内置 Broker 地址。

仅生成 APK，在 `demo-app` 中执行：

```powershell
npx ns build android --no-hmr
```

调试 APK 位于 `platforms/android/app/build/outputs/apk/debug/app-debug.apk`。

## 更新本地插件

插件代码修改后，在对应插件目录重新执行 npm pack，再在本目录安装生成的安装包。例如：

```powershell
npm install ../nativescript-plugin/nativescipt-mqtt-v5/ajax-js-nativescript-mqtt-v5-0.1.0.tgz
```

三个插件的构建与 API 说明见 [common](../nativescript-plugin/nativescipt-common/README.md)、[MQTT v3](../nativescript-plugin/nativescipt-mqtt-v3/README.md)、[MQTT v5](../nativescript-plugin/nativescipt-mqtt-v5/README.md)。

## Vite 配置

nativescript.config.ts 选择 Vite 构建，vite.config.mts 配置 Vue 与 NativeScript 插件。

参考：[原始演示工程](https://github.com/NativeScript/ns-vue-vite-demo)、[NativeScript Vite 配置](https://docs.nativescript.org/configuration/vite)、[NativeScript 9.1 Vite HMR](https://nstudio.io/blog/octane-vite-hmr-nativescript-9-1)。

## common iOS AES 验证

先构建 common：在插件目录执行 `npm pack`（需要设置本机 `ANDROID_HOME`），
再在 demo 目录执行 `npm install ../nativescript-plugin/nativescipt-common/ajax-js-nativescript-common-0.1.0.tgz`。
执行 `npx ns build ios --emulator`，再运行 `npx ns run ios --emulator`。
在底部“测试”打开 AES 页面，运行本地验证。页面支持 iOS Keychain、直接导入及可选 HTTPS 领取密钥。

自动验证可给模拟器应用 preferences 设置布尔值 `aesAutoCheck=true`。
应用启动会在“测试”tab 内打开 AES 页面并自动验证，保留底部 tabs；关闭该值恢复正常首页。
记录运行日志中的 `AES_INTEROP` 和 `AES_SELF_CHECK:PASS`，在仓库根目录执行：

```sh
ANDROID_HOME="$HOME/Library/Android/sdk" node ios/nativescipt-common/tests/interop.mjs /tmp/ajaxjs-demo.log
```

该脚本用现有 Android 生产 Cipher 解密 iOS 输出，验证 AES-128/192/256 双向兼容。
重新生成 Android → iOS 测试向量：同一脚本传 `--generate`。
公开测试密钥全零，仅用于互通验证。

本机已验证（2026-10-10）：Xcode 27.0、NativeScript iOS 9.1.0、iPhone 17 Pro / iOS 26.5 模拟器。
`vue-tsc --noEmit`、`ns build ios --emulator`、AES 页面本地检查和三种密钥长度的双向互通全部通过。
真实设备、锁屏状态、真实 HTTPS 密钥服务尚未验证。

模拟器自动验证示例（在 demo 目录执行，需已有启动的模拟器）：

```sh
xcrun simctl install booted platforms/ios/build/Debug-iphonesimulator/demoapp.app
xcrun simctl launch booted org.nativescript.nsvuevitedemo -aesAutoCheck YES
xcrun simctl spawn booted log show --last 3m --style compact \
  --predicate 'process == "demoapp" AND (eventMessage CONTAINS "AES_INTEROP" OR eventMessage CONTAINS "AES_SELF_CHECK")' \
  > /tmp/ajaxjs-demo.log
```

NativeScript 的 console 日志在当前运行时写入 iOS 日志系统，不能仅依赖 launch 的标准输出。
`-aesAutoCheck YES` 是此次启动的临时开关；下次正常启动回到首页。

### AES 附加认证数据（AAD）测试

AES 页面提供“运行 AAD 与旧方式兼容测试”，自动导入临时公开测试密钥，逐项显示正确 Unicode AAD、错误 AAD、非空 AAD 使用旧方法解密、旧方法往返，以及空 AAD 与旧方法双向兼容的结果。结束后删除临时密钥。“运行本地加解密验证”也包含这些检查。

也可以手动导入密钥、输入 JSON 和 AAD，点击“使用 AAD 加密 JSON”，再修改 AAD 点击“使用 AAD 解密 JSON”验证失败。认证失败会清除之前显示的明文。原有加解密按钮仍按无 AAD 方式工作。

common 依赖使用本地插件目录，以使用最新 API 和原生产物。在插件目录先执行 `npm run build:native`（Android）或 `npm run build:ios`（macOS/iOS），再执行 `npm run build`；随后在 demo-app 执行 `npm install`。iOS 需要重新编译包含 AAD 接口的 XCFramework。

## Toast 验证

在“测试”tab 点击“Toast 测试”调用 common 的统一 `toast(message)`。
iOS 显示两秒非模态提示，期间页面和底部 tabs 仍可操作；Android 沿用原生短 Toast。
模拟器自动调用可使用临时启动参数 `-toastAutoCheck YES`，保留 tabs，并在日志输出 `IOS_HELPER_CHECK:版本/构建版本`。

## iOS AAD 验证记录（2026-10-12）

环境：Xcode 27.0、iPhone 17 Pro 模拟器、iOS 26.5。
重新构建 AAD XCFramework 和 TS 插件后，demo 的 common 依赖已链接到本地插件目录。
旧生成工程因包路径变更产生重复 Framework 引用，通过重新生成 iOS 平台目录解决。

使用 XCTest 对现有 NativeScript App 实际点击“测试”tab 和 AES 页面：

- “运行 AAD 与旧方式兼容测试”的六项全部通过。
- “运行本地加解密验证（含 AAD）”通过，日志出现 `AES_SELF_CHECK:PASS`。
- 临时密钥删除后逐个查询 Keychain，均确认不存在，日志为 `AES_TEST_KEY_CLEANUP:PASS:<测试别名>`。
- 输入框使用两个前导空格和两个尾随空格的 AAD（字符串 `"  AAD-space/v1  "`），相同 AAD 解密成功。
- 改为 `"AAD-space/v1"` 后认证失败，明文显示变为“尚未解密”；恢复原始空格后再次解密成功。
- 界面测试导入的手动测试密钥也通过删除按钮清理，并由检查按钮确认不存在。

10 项 TS/桥接测试和 3 项 XCTest UI 测试通过。XCTest 运行器需为模拟器 App 签名；
未签名测试构建会导致 Keychain 返回 -34018。本次使用模拟器开发签名后全部通过。
系统界面操作工具未获授权，因此输入流程采用 XCTest 自动界面操作，未由该工具手工点击。
本次未进行真实 iPhone 测试，未提交、推送或发布。

## 机器人设备密钥派生验证

AES 页面新增“运行机器人设备密钥派生测试”，验证公开 HKDF 向量、MAC 格式等价、派生后直接导入、重复别名拒绝、topic AAD 往返、不同设备密钥认证失败及临时密钥清理。完整 AES 自检也包含此检查；成功日志为 `AES_ROBOT_KEY_CHECK:PASS`。
测试使用公开主密钥，禁止用于真实机器人。v1 字节协议、公开向量和 ESP32 修改提示词见 [Keystore 与 AES 文档](../docs-src/src/keystore-aes.md)。

剪贴板验证：进入“测试”tab → “剪贴板测试”，可手动复制与读取原始文本，或点击“运行剪贴板自检”。通过时日志显示 `CLIPBOARD_SELF_CHECK:PASS`；自检验证 Unicode、换行、空格、空字符串和覆盖，并恢复先前可读文本。

剪贴板自检已在 Pixel 9 Pro XL / Android 15（API 35）和 iPhone 17 Pro / iOS 26.5 模拟器通过；iOS 手动复制/读取保留首尾空格、换行、中文和 emoji。跨应用粘贴授权与后台访问限制未验证。

### Toast 调用后的执行验证

进入“测试”tab → “Toast 执行连续性测试”，点击“运行 Toast 连续性测试”。页面约 6 秒后显示结果，并分别验证包入口的 `toast` 和当前 `common-helper.ts` 中的封装。

控制台按入口输出 `TOAST_FLOW` 阶段标记：`BEFORE_CALL`、`AFTER_CALL`（含调用耗时）、`SYNC_COUNTER=1`、`MICROTASK_AFTER_CALL`、调用前安排的计时器、调用后的计时器及 `DELAYED_3000MS`。全部执行后输出 `TOAST_FLOW_CHECK:PASS`；捕获的异常会在页面和日志显示失败及堆栈。

只看到 `BEFORE_CALL` 而没有 `AFTER_CALL` 时，可据此定位没有返回的调用；出现 `AFTER_CALL` 而缺少其他阶段时，再检查事件循环或后续异常。Toast 是否显示与后续代码是否执行分别观察，PASS 不替代显示效果检查。

自动运行参数：iOS 启动时传 `-toastFlowAutoCheck YES`；Android 启动 Intent 传布尔 extra `toastFlowAutoCheck=true`。自动验证仍在原有测试 tab 内打开页面。

本次验证：iPhone 17 Pro / iOS 26.5 与 Pixel 9 Pro XL / Android 15（API 35）前台主线程均通过，包入口与 `common-helper.ts` 两种封装的后续阶段全部执行，日志为 `TOAST_FLOW_CHECK:PASS`。当前场景未复现 Toast 之后停止执行；未覆盖历史版本或后台线程调用场景。

### 列表行与内部按钮的事件对照

进入“测试”tab → “列表与按钮事件测试”。页面使用真实 ListView，提供 12 个项目、内部按钮、独立计数和最近 30 条日志；控制台标记为 `LIST_TAP_CHECK`。切换模式会重建列表并清空计数，另可手动清空。

| 模式 | 行操作来源 | 用途 |
| --- | --- | --- |
| 原生 itemTap | ListView.itemTap | 观察原生列表选择与内部 Button.tap 是否独立 |
| itemTap 焦点修正（默认） | ListView.itemTap | Android 行内 Button 关闭焦点能力，保留原生按钮点击；正文不绑定 tap |
| 父层 tap | 每行 GridLayout.tap | 观察父层手势与子按钮的竞争或重复触发 |
| 分区 tap | 正文 GridLayout.tap | 正文和按钮各自处理操作；外层不绑定业务 tap，原生 itemTap 仅作诊断记录 |

先清空，再单独点击按钮：目标为按钮事件加 1、行事件不变。再点行正文：目标为行事件加 1、按钮事件不变。继续滚动列表，点击后续项目，以检查虚拟列表复用后事件是否仍对应正确项目。日志记录事件接收者与是否存在 stopPropagation，不调用不存在的方法，也不手工转发行事件。

iPhone 17 Pro / iOS 26.5 实际点击结果：

| 模式 | 仅点击按钮后的行事件 / 按钮事件 / 原生 itemTap |
| --- | --- |
| 原生 itemTap | 0 / 1 / 0 |
| 父层 tap | 1 / 0 / 0：父层处理了点击，按钮自己的回调没有执行 |
| 分区 tap | 0 / 1 / 0 |

原生 itemTap 与分区模式的行正文操作也通过；分区模式滚动后点击项目 11 的按钮和正文，仍分别只触发对应操作，滚动本身没有计入业务点击。当前事件对象未提供 stopPropagation；父层问题可能涉及原生手势竞争，不应直接等同 DOM 冒泡。父层模式故意保留该现象供对照。

Pixel 9 Pro XL / Android 15（API 35）已通过 Android Studio 的 Running Devices 窗口完成真实触摸对照：

| 模式 | 仅点按钮：行 / 按钮 / 原生 itemTap | 点击行正文 |
| --- | --- | --- |
| 原生 itemTap | 0 / 1 / 0 | 当前包含 Button 的布局未触发 itemTap，行计数仍为 0 |
| 父层 tap | 1 / 1 / 0 | 仅行事件增加；按钮点击会额外触发父层 |
| 分区 tap | 0 / 1 / 0 | 仅行事件增加 |

分区模式滚动后，项目 11 的按钮和正文也分别独立响应，滚动没有产生业务点击。以上是未修正焦点时的对照结果；后续排查找到了可保留原生整行 itemTap 的写法，见下文。没有使用 notify 或直接调用回调代替触摸测试。

#### Android itemTap 焦点修正（2026-10-14）

NativeScript Android ListView 通过 `android.widget.AdapterView.OnItemClickListener` 发出 `itemTap`。Android 15 的 [AbsListView.onTouchUp 源码](https://github.com/aosp-mirror/platform_frameworks_base/blob/android15-release/core/java/android/widget/AbsListView.java#L3910) 会检查整行 `child.hasExplicitFocusable()`，包含显式可获取焦点的子控件时跳过行点击。这与父子布局 tap 手势竞争是两个问题。

行内 Button 默认可获取焦点；在其 `loaded` 事件中调用 `setFocusableInTouchMode(false)` 和 `setFocusable(false)` 后，正文点击可以到达 ListView，按钮自己的原生点击仍然有效。社区 [Folding List View 的说明](https://github.com/PeterStaev/nativescript-folding-list-view#having-buttons-inside-the-cells-android) 也记录了相同焦点问题。

```vue
<ListView :items="items" @itemTap="onItemTap">
  <template #default="{ item }">
    <GridLayout columns="*,110" height="76">
      <Label :text="item.title" padding="12" />
      <Button
        col="1"
        text="操作"
        margin="6"
        @loaded="onButtonLoaded"
        @tap="onButtonTap(item)"
      />
    </GridLayout>
  </template>
</ListView>
```

```ts
import { isAndroid } from '@nativescript/core';
import type { Button, EventData } from '@nativescript/core';

/**
 * 只调整 Android 行内按钮的焦点能力，保留按钮的点击处理。
 */
function onButtonLoaded(event: EventData): void {
  if (!isAndroid)
    return;
  const button = event.object as Button;
  button.android.setFocusableInTouchMode(false);
  button.android.setFocusable(false);
}
```

此写法没有给正文划分业务 tap 区域：整行由 ListView.itemTap 处理，内部按钮由 Button.tap 处理。外层容器和正文均不绑定 tap，也不使用 stopPropagation、计时锁或手工转发。按钮 loaded 处理适用于创建及重新挂载，列表复用后的点击已单独验证。

| 模拟器 | 单独点击按钮（行 / 按钮 / itemTap 增量） | 单独点击正文或按钮外的行空白处 | 复用后项目 11 |
| --- | --- | --- | --- |
| Pixel 9 Pro XL / Android 15 API 35 | 0 / 1 / 0 | 1 / 0 / 1 | 按钮和行分别响应 |
| iPhone 17 Pro / iOS 26.5 | 0 / 1 / 0 | 1 / 0 / 1 | 按钮和行分别响应 |

Android 对照日志：未修正模式 `before=true:after=true:clickable=true`，正文不触发 itemTap；修正模式 `before=true:after=false:clickable=true`，正文触发 itemTap。修正模式使用 `LIST_TAP_FOCUS` 记录配置、`LIST_TAP_CHECK:native-fixed` 记录事件。

本轮 Vue 类型检查、Android 完整构建及安装通过。iOS 最初卡在 Swift Package 原生依赖下载；使用锁定 9.1.0 的 NativeScript Swift Package 浅克隆缓存、保留现有 Package.resolved 后，完整 Xcode 模拟器构建成功，正式构建产物重新安装并复核点击。没有修改原生源码或依赖版本。

Android 拖动滚动没有增加计数。iOS 一次界面工具拖拽额外产生了项目 3 的 itemTap，暂不能确定是输入工具还是原生列表行为；改用列表的 Scroll Up / Scroll Down 滚动动作复测，计数保持为零，随后项目 11 的按钮及行点击均独立。此异常作为未完成的拖拽验证保留，不能宣称所有滚动手势都已通过。

关闭 Android focusable 会影响键盘 / D-pad 对该按钮的焦点导航，此方案当前验证的是触摸点击；未测试键盘导航、TalkBack、VoiceOver 或真机。行内还有其他可获取焦点的控件时需重新评估，不能把此处理当作所有嵌套手势的通用停止传播接口。

### Android 模拟器界面连接

独立从命令行启动的模拟器在 macOS 上运行于 qemu 进程，ADB 可正常安装、启动和读取日志，但本机界面工具无法按应用名称或可执行文件路径选中该独立窗口。

本次通过 Android Studio 重新启动现有 Pixel 模拟器，并在 Running Devices 工具窗口显示设备，界面工具随后可选择 Android Studio 窗口完成点击与拖动。设置入口为 Settings → Tools → Emulator → Launch in the Running Devices tool window；本机该设置原本已启用，无需追加屏幕录制或辅助功能权限。建议后续由 Android Studio 的 Device Manager 启动模拟器，并保持 Running Devices 窗口可见。此方式不需要修改业务工程或清空模拟器数据。


### 原生 Confirm 测试（2026-10-15）

入口：“测试”tab → “原生 Confirm 测试”。组件使用 common 插件的 Java/Swift 实现，调用 `await confirm(options)`，确认返回 `true`，取消返回 `false`；参数或显示错误进入 `catch`。默认文案为中文，需要国际化时传入翻译后的标题与按钮文字。

页面检查默认确认/取消、自定义按钮颜色与 Unicode 文案、蒙层关闭策略、长正文滚动、连续两个弹窗和无效颜色。`完成回调` 与 `await 后代码` 计数、`CONFIRM_CHECK` 日志用于确认后续代码执行及单次结算。并发请求依次显示，错误不会阻塞后续请求。`position` 保留原组件的正文对齐含义，不控制弹窗位置。

| 模拟器 | 结果 |
| --- | --- |
| Pixel 9 Pro XL / Android 15 API 35 | 9 项真实界面检查通过；包括 Android 返回键取消、宿主进入后台后单次取消 |
| iPhone 17 Pro / iOS 26.5 | 5 项 XCTest 通过；包括确认/取消、蒙层策略、样式与长正文、队列与错误恢复、后台取消 |

common 插件的 19 项自动化测试通过，包含 Confirm 的平台桥接、参数验证、返回值、重复回调保护与队列错误恢复。已重新生成 Android JAR、设备/模拟器 XCFramework 与 TS 产物，demo 的双端构建及 Vue 类型检查通过。本轮未验证真机、屏幕旋转、键盘导航或读屏操作。

iOS 首次构建遇到 Swift Package 下载等待，使用本机已有且与 Package.resolved 一致的依赖缓存完成构建，未更改依赖版本。

复测前先构建 common 插件及 demo，并启动对应模拟器。在仓库根目录执行：

```sh
node demo-app/tests/confirm/run-android.mjs
node demo-app/tests/confirm/run-ios.mjs
```

Android 脚本要求 SDK 35、构建工具、JDK、默认 debug.keystore 及唯一已连接的模拟器，安装已有 debug APK 后，通过独立 Instrumentation 驱动现有 demo。SDK 可通过 ANDROID_HOME 或 ANDROID_SDK_ROOT 指定。iOS 脚本要求 Xcode 与唯一已启动的模拟器，也可通过 IOS_SIMULATOR_UDID 指定，安装已有 demo.app 后运行 XCTest。测试项目和驱动产物均位于临时目录，测试对象始终是本项目的 NativeScript App。

两个脚本输出临时产物路径；Android 保存自定义配色/长正文截图与结果日志，iOS 的 results.xcresult 保存结果和自定义配色截图附件。测试会重新安装并启动 demo，运行前请先保存模拟器内当前测试状态。

统一参数与迁移说明见 [通用工具文档](../docs-src/src/common-helper.md)。


### Token / MQTT 凭据安全存储（2026-10-15）

入口：“测试”tab → “安全存储测试”。使用包入口的 `setSecureItem/getSecureItem/removeSecureItem`，仅操作 `demo.secure-self-check.*` 测试项和公开虚拟凭据，不显示真实 Token 或密码；保留底部 tabs。

自检覆盖不存在返回 null、空字符串、Unicode/空格/换行/NUL 原样读回、覆盖、多项隔离、并发调用顺序、64 KiB UTF-8 边界与非法输入拒绝、ApplicationSettings 旧值写入成功后删除、幂等删除、机器人 AES 密钥隔离及 finally 清理。成功日志为 `SECURE_STORAGE_SELF_CHECK:PASS`。另先点“写入重启测试数据”，结束 App 进程再重新进入页面，点“验证重启后数据并清理”，应得到 `SECURE_STORAGE_RESTART:PASS:CLEANED`。

| 模拟器 | 验证结果 |
| --- | --- |
| Pixel 9 Pro XL / Android 15 API 35 | 3 项界面流程通过：完整自检、持久化写入、强制结束进程后读取并清理。另 4 项原生检查通过：密文无明文/位于 no_backup/nonce 每次不同、tag 篡改拒绝、换项密文因 AAD 不同被拒绝、截断密文报错；均清理临时项。 |
| iPhone 17 Pro / iOS 26.5 | 1 项完整 XCTest 流程通过：自检、写入、结束进程、重启后读回清理、再次自检。 |

插件 24 项自动化测试通过，覆盖两端桥接与异常传播；JAR、设备/模拟器 XCFramework、TS 与双端 demo 构建、Vue 类型检查通过。iOS 使用与 Package.resolved 一致的已有 Swift Package 缓存完成构建，未改依赖版本；首轮关闭代码签名的模拟器构建出现 Keychain 访问失败，改用模拟器本地签名后实际读写通过。调试 Keychain 请使用正常签名的模拟器/真机构建。

复测先构建 common 插件及 demo，启动模拟器，然后在仓库根目录执行：

```sh
node demo-app/tests/secure-storage/run-android.mjs
node demo-app/tests/secure-storage/run-ios.mjs
```

环境要求与 Confirm 测试脚本相同。Android 安全检查使用 debug 签名匹配的 Instrumentation 在现有 demo UID 中运行，仅读写 `demo.native-secure-check.*` 项；不删除或替换共享 Keystore 密钥。脚本保存界面结果、安全检查日志与截图；iOS results.xcresult 保留 XCTest 结果和页面截图附件，临时目录在输出中列明。

尚未验证真机、锁屏期间访问、系统备份/迁移、卸载重装、Keystore 密钥失效和多进程并发。不能据模拟器结果宣称这些场景通过。业务 App 的旧 Token 尚未自动迁移，实际旧键名、登录退出和后端刷新流程需在接入时按 [通用工具文档](../docs-src/src/common-helper.md) 配置。
