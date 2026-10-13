import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hkdfSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
const fixtures = JSON.parse(readFileSync(new URL('../test-vectors/robot-key-v2.json', import.meta.url)));
const calls = [];
globalThis.__robotCore = { os: 'android' };
const native = {
    deriveKey: (...args) => { calls.push(args); return 'derived'; },
    deriveAndImportKey: (...args) => calls.push(args)
};
globalThis.com = { ajaxjs: { nativescript: { android: { crypto: { RobotKeyDerivation: native } } } } };
globalThis.AjaxJSRobotKey = {
    deriveKeyRobotMac: (...args) => { calls.push(args); return { value: 'derived' }; },
    deriveAndImportKeyMasterKeyBase64RobotMac: (...args) => { calls.push(args); return { value: true }; }
};
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export let isAndroid=true;export let isIOS=false;export function platform(a,i){isAndroid=a;isIOS=i;}', shortCircuit: true };
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const api = await import('../dist/robot-key.js');
const master = fixtures.vectors[2].masterKeyBase64;
test('public vectors match independent Node HKDF implementation', () => {
    for (const vector of fixtures.vectors) {
        const result = Buffer.from(hkdfSync('sha256', Buffer.from(vector.masterKeyBase64, 'base64'),
            Buffer.from(api.ROBOT_KEY_DERIVATION_V2.salt), Buffer.from(vector.robotMac), 32));
        assert.equal(result.toString('base64'), vector.derivedKeyBase64);
        assert.equal(result.toString('hex'), vector.derivedKeyHex);
        assert.equal(Buffer.from(vector.robotMac).toString('hex'), vector.infoHex);
    }
    assert.notEqual(fixtures.vectors[2].derivedKeyBase64, fixtures.vectors[3].derivedKeyBase64);
});
test('TS normalization and both native selectors agree, direct import returns no key', () => {
    for (const os of ['android', 'ios']) {
        core.platform(os === 'android', os === 'ios');
        assert.equal(api.deriveRobotAesKey(master, 'AA:BB:CC:DD:EE:FF'), 'derived');
        assert.deepEqual(calls.pop(), [master, 'aabbccddeeff']);
        assert.equal(api.deriveAndImportRobotAesKey('alias', master, 'AA-BB-CC-DD-EE-FF'), undefined);
        assert.deepEqual(calls.pop(), ['alias', master, 'aabbccddeeff']);
    }
    assert.equal(api.normalizeRobotMac('00:11:22:AA:BB:CC'), '001122aabbcc');
});
test('rejects malformed parameters, native errors, unsupported platforms and old iOS binary', () => {
    for (const mac of [null, '', ' aabbccddeeff', 'aabbccddeeff\n', 'AA:BB-CC:DD:EE:FF', 'aabbccddeefg'])
        assert.throws(() => api.deriveRobotAesKey(master, mac));
    for (const key of [null, '', 'AA==', master + '\n', master.replace('+', '-') + '!'])
        assert.throws(() => api.deriveRobotAesKey(key, 'aabbccddeeff'));
    assert.throws(() => api.deriveAndImportRobotAesKey(' ', master, 'aabbccddeeff'));
    core.platform(false, true);
    globalThis.AjaxJSRobotKey.deriveKeyRobotMac = () => ({ error: 'native failure' });
    assert.throws(() => api.deriveRobotAesKey(master, 'aabbccddeeff'), /native failure/);
    delete globalThis.AjaxJSRobotKey;
    assert.throws(() => api.deriveRobotAesKey(master, 'aabbccddeeff'), /Rebuild/);
    core.platform(false, false);
    assert.throws(() => api.deriveRobotAesKey(master, 'aabbccddeeff'), /requires Android or iOS/);
});
