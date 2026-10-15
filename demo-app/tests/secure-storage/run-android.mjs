import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

/**
 * 构建仅有 Instrumentation 的驱动 APK，在已连接模拟器验证现有 demo。
 * 测试输出及截图保存在临时目录，不改动业务 App 源码或其他 App 数据。
 */
const demo = fileURLToPath(new URL('../../', import.meta.url));
const output = mkdtempSync(path.join(os.tmpdir(), 'ajaxjs-secure-storage-android-'));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(os.homedir(), 'Library/Android/sdk');
const versions = readdirSync(path.join(sdk, 'build-tools')).filter(value => /^\d+\.\d+\.\d+$/.test(value))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
const build = path.join(sdk, 'build-tools', versions[0]);
const platform = path.join(sdk, 'platforms/android-35/android.jar');
const adb = path.join(sdk, 'platform-tools/adb');
const classes = path.join(output, 'classes');
const dex = path.join(output, 'dex');
mkdirSync(classes);
mkdirSync(dex);
const manifest = path.join(output, 'AndroidManifest.xml');
writeFileSync(manifest, `<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.ajaxjs.secure.check">
<uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35"/>
<application android:label="SecureStorage UI tests"/>
<instrumentation android:name="com.ajaxjs.secure.check.AndroidSecureStorageNativeCheck" android:targetPackage="org.nativescript.nsvuevitedemo"/>
<instrumentation android:name="com.ajaxjs.secure.check.AndroidSecureStorageCheck" android:targetPackage="com.ajaxjs.secure.check"/>
</manifest>`);

function run(command, args, capture = false) {
    const result = spawnSync(command, args, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        throw new Error(`${path.basename(command)} failed: ${result.stderr || result.status}`);
    return result.stdout || '';
}

const jar = path.resolve(demo, '../nativescript-plugin/nativescipt-common/platforms/android/aj-nativescript.jar');
run('javac', ['--release', '8', '-cp', [platform, jar].join(path.delimiter), '-d', classes,
    path.join(demo, 'tests/secure-storage/AndroidSecureStorageCheck.java'),
    path.join(demo, 'tests/secure-storage/AndroidSecureStorageNativeCheck.java')]);
run(path.join(build, 'd8'), ['--min-api', '26', '--lib', platform, '--classpath', jar, '--output', dex,
    ...readdirSync(path.join(classes, 'com/ajaxjs/secure/check')).filter(name => name.endsWith('.class'))
        .map(name => path.join(classes, 'com/ajaxjs/secure/check', name))]);
const unsigned = path.join(output, 'unsigned.apk');
const apk = path.join(output, 'tests.apk');
run(path.join(build, 'aapt2'), ['link', '-I', platform, '--manifest', manifest, '-o', unsigned]);
run('zip', ['-j', unsigned, path.join(dex, 'classes.dex')]);
run(path.join(build, 'apksigner'), ['sign', '--ks', path.join(os.homedir(), '.android/debug.keystore'),
    '--ks-key-alias', 'androiddebugkey', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', apk, unsigned]);
run(adb, ['install', '-r', path.join(demo, 'platforms/android/app/build/outputs/apk/debug/app-debug.apk')]);
run(adb, ['install', '-r', apk]);
run(adb, ['shell', 'am', 'force-stop', 'org.nativescript.nsvuevitedemo']);
const result = run(adb, ['shell', 'am', 'instrument', '-w', 'com.ajaxjs.secure.check/com.ajaxjs.secure.check.AndroidSecureStorageCheck'], true);
writeFileSync(path.join(output, 'results.log'), result);
process.stdout.write(result);
console.log(`Artifacts: ${output}`);
if (!result.includes('SECURE_STORAGE_NATIVE_UI:PASS:3 checks'))
    throw new Error('SecureStorage Android UI checks did not all pass.');
for (const image of ['android-secure-storage.png'])
    run(adb, ['pull', `/sdcard/Android/data/com.ajaxjs.secure.check/files/${image}`, path.join(output, image)]);

const security = run(adb, ['shell', 'am', 'instrument', '-w', 'com.ajaxjs.secure.check/com.ajaxjs.secure.check.AndroidSecureStorageNativeCheck'], true);
writeFileSync(path.join(output, 'security-results.log'), security);
process.stdout.write(security);
if (!security.includes('SECURE_STORAGE_NATIVE_SECURITY:PASS:4 checks'))
    throw new Error('SecureStorage Android native security checks did not all pass.');
