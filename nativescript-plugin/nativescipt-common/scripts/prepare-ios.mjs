import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
    for (const file of files.filter(file => file.endsWith('-Swift.h'))) {
        const header = readFileSync(new URL(`../platforms/ios/AjaxJSCommon.xcframework/${file}`, import.meta.url), 'utf8');
        if (!header.includes('copyToClipboard:') || !header.includes('getFromClipboard'))
            throw new Error('The XCFramework does not support clipboard access. Rebuild it on macOS before packing.');
        if (!header.includes('@interface AjaxJSRobotKey') || !header.includes('deriveAndImportKey:'))
            throw new Error('The XCFramework does not support robot key derivation. Rebuild it on macOS before packing.');
        if (!header.includes('encryptWithAssociatedData:') || !header.includes('decryptWithAssociatedData:'))
            throw new Error('The XCFramework does not support AAD. Rebuild it on macOS before packing.');
    }

}
