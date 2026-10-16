import { defineConfig, mergeConfig, UserConfig } from "vite";
import { fileURLToPath } from "node:url";
import { vueConfig } from "@nativescript/vite/vue";
import { androidHmrActivityPlugin } from "./scripts/android-hmr-activity.mjs";

/**
 * HMR 需要解析 demo 外部的本地插件源码；补丁使用此路径作为工作区根目录。
 */
process.env.NS_WORKSPACE_ROOT = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig(({ mode }): UserConfig => {
  return mergeConfig(vueConfig({ mode }), { plugins: [androidHmrActivityPlugin()] });
});

