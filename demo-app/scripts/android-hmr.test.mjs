import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { androidHmrActivityPlugin } from './android-hmr-activity.mjs';
import { rewriteFsAbsoluteToNsM } from '../node_modules/@nativescript/vite/hmr/server/websocket-module-specifiers.js';
import { createNsMRequestContext, resolveNsMTransformedModule } from '../node_modules/@nativescript/vite/hmr/server/websocket-ns-m-request.js';
import { rewriteImports } from '../node_modules/@nativescript/vite/hmr/server/rewrite-imports.js';

const app = process.cwd();
const workspace = path.resolve(app, '..');
process.env.NS_WORKSPACE_ROOT = workspace;

test('Android HMR emits a stable Activity bridge with scannable lifecycle implementation', () => {
    process.env.NATIVESCRIPT_BUNDLER_ENV = '{"android":true}';
    const assets = [];
    androidHmrActivityPlugin().generateBundle.call({ emitFile: asset => assets.push(asset) }, {}, {
        entry: { type: 'chunk', isEntry: true, code: 'import "http://127.0.0.1:5180/ns/core/globals";' }
    });
    assert.equal(assets[0].fileName, 'ns-android-activity.mjs');
    assert.match(assets[0].source, /http:\/\/127\.0\.0\.1:5180\/ns\/core\/ui\/frame\/activity/);
    assert.match(assets[0].source, /extend\('com.tns.NativeScriptActivity'/);
    assert.match(assets[0].source, /onCreate\(savedInstanceState\)/);
    assert.match(assets[0].source, /if \(false\)/);
});

test('iOS and non-HMR builds do not emit the Android bridge', () => {
    const emitFile = () => assert.fail('Unexpected Android bridge');
    process.env.NATIVESCRIPT_BUNDLER_ENV = '{"ios":true}';
    androidHmrActivityPlugin().generateBundle.call({ emitFile }, {}, {});
    process.env.NATIVESCRIPT_BUNDLER_ENV = '{"android":true}';
    androidHmrActivityPlugin().generateBundle.call({ emitFile }, {}, {
        entry: { type: 'chunk', isEntry: true, code: 'import "./vendor.mjs";' }
    });
});

test('filesystem JSON imports are inlined on Windows and POSIX', () => {
    const absolute = path.join(workspace, 'nativescript-plugin/nativescipt-common/test-vectors/robot-key-v2.json').replace(/\\/g, '/');
    const url = '/@fs/' + absolute.replace(/^\//, '');
    const result = rewriteImports(`import vectors from '${url}?import';`, 'src/components/AesDemo.vue', new Map(), new Map(), app);
    assert.match(result, /const vectors = /);
    assert.doesNotMatch(result, /JSON import failed/);
    assert.equal(rewriteFsAbsoluteToNsM(url, app, workspace), '/ns/m/nativescript-plugin/nativescipt-common/test-vectors/robot-key-v2.json');
});

test('extensionless sibling TypeScript imports resolve through the workspace', async () => {
    const result = createNsMRequestContext('/ns/m/nativescript-plugin/nativescipt-common/src/common-helper', app, '/src', workspace);
    assert.equal(result.kind, 'context');
    const resolved = await resolveNsMTransformedModule({
        context: result.value,
        transformRequest: async id => id.startsWith('/@fs/') && id.endsWith('common-helper.ts') ? { code: 'export const ok = true;' } : null,
        resolveId: async () => null,
        loadVirtualId: async () => null
    });
    assert.equal(resolved.transformed.code, 'export const ok = true;');
});
