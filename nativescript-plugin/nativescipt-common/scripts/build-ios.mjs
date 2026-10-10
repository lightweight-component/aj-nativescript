import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.platform !== 'darwin')
    throw new Error('iOS builds require macOS and Xcode. Copy a macOS-built XCFramework before packing on Windows.');
const root = fileURLToPath(new URL('../', import.meta.url));
const project = path.resolve(root, '../../ios/nativescipt-common');
const build = path.join(project, 'build');
const output = path.join(root, 'platforms/ios/AjaxJSCommon.xcframework');
function run(args) {
    const result = spawnSync('xcodebuild', args, { stdio: 'inherit' });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        process.exit(result.status ?? 1);
}
for (const [name, destination] of [['device', 'generic/platform=iOS'], ['simulator', 'generic/platform=iOS Simulator']]) {
    run(['archive', '-project', path.join(project, 'AjaxJSCommon.xcodeproj'), '-scheme', 'AjaxJSCommon',
        '-configuration', 'Release', '-destination', destination, '-archivePath', path.join(build, name),
        '-derivedDataPath', path.join(build, 'DerivedData'), 'CODE_SIGNING_ALLOWED=NO', 'SKIP_INSTALL=NO',
        'BUILD_LIBRARY_FOR_DISTRIBUTION=YES']);
}
mkdirSync(path.dirname(output), { recursive: true });
rmSync(output, { recursive: true, force: true });
run(['-create-xcframework', '-framework', path.join(build, 'device.xcarchive/Products/Library/Frameworks/AjaxJSCommon.framework'),
    '-framework', path.join(build, 'simulator.xcarchive/Products/Library/Frameworks/AjaxJSCommon.framework'), '-output', output]);
