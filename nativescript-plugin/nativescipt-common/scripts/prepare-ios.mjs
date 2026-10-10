import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
if (process.platform === 'darwin') {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./build-ios.mjs', import.meta.url))], { stdio: 'inherit' });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        process.exit(result.status ?? 1);
} else {
    const files = [
        'Info.plist',
        'ios-arm64/AjaxJSCommon.framework/AjaxJSCommon',
        'ios-arm64/AjaxJSCommon.framework/Headers/AjaxJSCommon-Swift.h',
        'ios-arm64_x86_64-simulator/AjaxJSCommon.framework/AjaxJSCommon',
        'ios-arm64_x86_64-simulator/AjaxJSCommon.framework/Headers/AjaxJSCommon-Swift.h'
    ];
    for (const file of files) {
        if (!existsSync(new URL(`../platforms/ios/AjaxJSCommon.xcframework/${file}`, import.meta.url)))
            throw new Error('Copy the complete macOS-built AjaxJSCommon.xcframework to platforms/ios before packing on Windows/Linux.');
    }
}
