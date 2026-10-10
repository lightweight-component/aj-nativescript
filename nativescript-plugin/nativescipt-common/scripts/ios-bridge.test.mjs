import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export const isAndroid=false;export const isIOS=true;export const Http={};', shortCircuit: true };
    return next(specifier, context);
} });
const keys = new Map();
globalThis.AjaxJSAes = {
    importKeyKeyBase64(alias, key) {
        if (keys.has(alias))
            return { error: 'duplicate alias' };
        keys.set(alias, key);
        return { value: true };
    },
    hasKey: alias => ({ value: keys.has(alias) }),
    deleteKey(alias) { keys.delete(alias); return { value: true }; },
    encryptPlaintext: () => ({ value: { objectForKey: key => ({ nonce: 'nonce', data: 'data' })[key] } }),
    decryptNonceBase64DataBase64: () => ({ error: 'authentication failed' })
};
const api = await import('../dist/keystore.js');
test('iOS routes key lifecycle and dictionary result through Objective-C selectors', () => {
    api.importAesKey('test', 'key');
    assert.equal(api.hasAesKey('test'), true);
    assert.throws(() => api.importAesKey('test', 'key'), /duplicate alias/);
    assert.deepEqual(api.encryptJson('test', { unicode: '中文' }), { nonce: 'nonce', data: 'data' });
    assert.throws(() => api.decryptJson('test', { nonce: 'nonce', data: 'data' }), /authentication failed/);
    api.deleteAesKey('test');
    assert.equal(api.hasAesKey('test'), false);
});
