import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

/**
 * 在临时目录生成 XCTest UI 测试目标，测试对象始终是现有 NativeScript demo。
 * 不创建替代业务 App；默认选择唯一已启动的 iOS 模拟器，可通过环境变量指定设备。
 */
const demo = fileURLToPath(new URL('../../', import.meta.url));
const output = mkdtempSync(path.join(os.tmpdir(), 'ajaxjs-secure-storage-ios-'));
const project = path.join(output, 'SecureStorageUITests.xcodeproj');
mkdirSync(path.join(project, 'xcshareddata/xcschemes'), { recursive: true });

function run(command, args, capture = false) {
    const result = spawnSync(command, args, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
    if (result.error)
        throw result.error;
    if (result.status !== 0)
        throw new Error(`${command} failed: ${result.stderr || result.status}`);
    return result.stdout || '';
}

const booted = Object.values(JSON.parse(run('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], true)).devices)
    .flat().filter(device => device.state === 'Booted' && device.isAvailable);
const udid = process.env.IOS_SIMULATOR_UDID || (booted.length === 1 ? booted[0].udid : undefined);
if (!udid)
    throw new Error('Boot one iOS simulator or set IOS_SIMULATOR_UDID.');
const source = JSON.stringify(path.join(demo, 'tests/secure-storage/SecureStorageUITests.m'));
writeFileSync(path.join(project, 'project.pbxproj'), `{
archiveVersion = 1; objectVersion = 56; objects = {
A00000000000000000000001 = {isa = PBXProject; buildConfigurationList = A00000000000000000000010; compatibilityVersion = "Xcode 14.0"; mainGroup = A00000000000000000000002; targets = (A00000000000000000000004); };
A00000000000000000000002 = {isa = PBXGroup; children = (A00000000000000000000005, A00000000000000000000006); sourceTree = "<group>"; };
A00000000000000000000004 = {isa = PBXNativeTarget; buildConfigurationList = A00000000000000000000011; buildPhases = (A00000000000000000000007, A00000000000000000000009); buildRules = (); dependencies = (); name = SecureStorageUITests; productName = SecureStorageUITests; productReference = A00000000000000000000006; productType = "com.apple.product-type.bundle.ui-testing"; };
A00000000000000000000005 = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.objc; path = ${source}; sourceTree = "<absolute>"; };
A00000000000000000000006 = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = SecureStorageUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
A00000000000000000000007 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000008); runOnlyForDeploymentPostprocessing = 0; };
A00000000000000000000008 = {isa = PBXBuildFile; fileRef = A00000000000000000000005; };
A00000000000000000000009 = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
A00000000000000000000010 = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000012); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
A00000000000000000000011 = {isa = XCConfigurationList; buildConfigurations = (A00000000000000000000013); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
A00000000000000000000012 = {isa = XCBuildConfiguration; name = Debug; buildSettings = { IPHONEOS_DEPLOYMENT_TARGET = 15.0; SDKROOT = iphonesimulator; CLANG_ENABLE_OBJC_ARC = YES; ALWAYS_SEARCH_USER_PATHS = NO; }; };
A00000000000000000000013 = {isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = com.ajaxjs.confirm.uitests; GENERATE_INFOPLIST_FILE = YES; CODE_SIGN_STYLE = Manual; CODE_SIGN_IDENTITY = "-"; TARGETED_DEVICE_FAMILY = "1,2"; }; };
}; rootObject = A00000000000000000000001;
}`);
writeFileSync(path.join(project, 'xcshareddata/xcschemes/SecureStorageUITests.xcscheme'), `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A00000000000000000000004" BuildableName="SecureStorageUITests.xctest" BlueprintName="SecureStorageUITests" ReferencedContainer="container:SecureStorageUITests.xcodeproj" /></BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="A00000000000000000000004" BuildableName="SecureStorageUITests.xctest" BlueprintName="SecureStorageUITests" ReferencedContainer="container:SecureStorageUITests.xcodeproj" /></TestableReference></Testables></TestAction>
</Scheme>`);
run('xcrun', ['simctl', 'install', udid, path.join(demo, 'platforms/ios/build/Debug-iphonesimulator/demoapp.app')]);
console.log(`Artifacts: ${output}`);
run('xcodebuild', ['test', '-project', project, '-scheme', 'SecureStorageUITests', '-destination', `id=${udid}`,
    '-derivedDataPath', path.join(output, 'DerivedData'), '-resultBundlePath', path.join(output, 'results.xcresult'), 'CODE_SIGN_IDENTITY=-']);
