import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * 为 Android HMR 留下可扫描的 Activity 实现，同时保持运行时使用同一份 HTTP core。
 * 仅影响 HMR 的 Android 构建，普通构建和 iOS 不变。
 *
 * @returns Vite 构建插件。
 */
export function androidHmrActivityPlugin() {
    const require = createRequire(import.meta.url);
    return {
        name: 'demo-android-hmr-activity',
        apply: 'build',
        enforce: 'post',
        generateBundle(_options, bundle) {
            const environment = JSON.parse(process.env.NATIVESCRIPT_BUNDLER_ENV || '{}');
            const android = environment.android || process.argv.includes('--env.android');
            if (!android)
                return;

            const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry);
            const origin = entry?.code.match(/["'](https?:\/\/[^"']+?)\/ns\/core(?:\/|["'])/)?.[1];
            if (!origin)
                return;

            const coreRoot = path.dirname(require.resolve('@nativescript/core/package.json'));
            const source = readFileSync(path.join(coreRoot, 'ui/frame/activity.android.js'), 'utf8')
                .replace(/^import .*;\r?\n/gm, '')
                .replace(/^\/\/# sourceMappingURL=.*$/gm, '');
            /**
             * SBG 扫描 AST，不会执行此文件。不可达分支仅用于生成 Java 生命周期绑定；
             * 真正的 JS 实现由上面的 HTTP import 注册，避免重复初始化 core。
             */
            this.emitFile({
                type: 'asset',
                fileName: 'ns-android-activity.mjs',
                source: `import '${origin}/ns/core/ui/frame/activity';\nif (false) {\n${source}\n}\n`
            });
        }
    };
}
