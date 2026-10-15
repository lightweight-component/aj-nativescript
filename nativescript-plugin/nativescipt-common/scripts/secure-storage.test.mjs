import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const items = new Map();
let failure = false;
let calls = 0;
globalThis.__secureContext = {};
const invoke = (operation, key, value) => {
    calls++;
    if (failure)
        throw new Error('simulated storage failure');
    if (operation === 'get')
        return items.get(key) ?? null;
    if (operation === 'set')
        items.set(key, value);
    else
        items.delete(key);
    return true;
};
globalThis.com = { ajaxjs: { nativescript: { android: { storage: { SecureStorage: {
    setItem: (_context, key, value) => invoke('set', key, value),
    getItem: (_context, key) => invoke('get', key),
    removeItem: (_context, key) => invoke('remove', key)
} } } } } };
const ios = (operation, key, value) => {
    try { return { value: invoke(operation, key, value), error: null }; }
    catch (error) { return { value: null, error: error.message }; }
};
globalThis.AjaxJSSecureStorage = {
    setItemValue: (key, value) => ios('set', key, value),
    getItem: key => ios('get', key),
    removeItem: key => ios('remove', key)
};
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export let isAndroid=true;export let isIOS=false;export const Utils={android:{getApplicationContext:()=>globalThis.__secureContext}};export function platform(a,i){isAndroid=a;isIOS=i;}', shortCircuit: true };
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const api = await import('../dist/secure-storage.js');

test('both bridges preserve missing versus empty, Unicode, exact keys, overwrite and isolation', async () => {
    for (const isIOS of [false, true]) {
        core.platform(!isIOS, isIOS);
        items.clear();
        assert.equal(await api.getSecureItem('token'), null);
        await api.setSecureItem('token', '  中文 🤖\n\u0000  ');
        assert.equal(await api.getSecureItem('token'), '  中文 🤖\n\u0000  ');
        await api.setSecureItem(' token ', 'mqtt');
        await api.setSecureItem('token', '');
        assert.equal(await api.getSecureItem('token'), '');
        await api.removeSecureItem('token');
        await api.removeSecureItem('token');
        assert.equal(await api.getSecureItem('token'), null);
        assert.equal(await api.getSecureItem(' token '), 'mqtt');
    }
});

test('validates Unicode, UTF-16 keys and UTF-8 byte limits before native calls', async () => {
    const before = calls;
    for (const key of ['', ' \n ', null, 123, 'a'.repeat(129), '\ud800', '\udc00']) {
        await assert.rejects(api.getSecureItem(key), TypeError);
        await assert.rejects(api.removeSecureItem(key), TypeError);
        await assert.rejects(api.setSecureItem(key, 'value'), TypeError);
    }
    for (const value of [null, {}, 123, '\ud800', '\udc00'])
        await assert.rejects(api.setSecureItem('valid', value), TypeError);
    await assert.rejects(api.setSecureItem('valid', '🤖'.repeat(16385)), RangeError);
    assert.equal(calls, before);
    await api.setSecureItem('a'.repeat(128), '🤖'.repeat(16384));
    assert.equal((await api.getSecureItem('a'.repeat(128))).length, 32768);
});

test('submissions serialize and native errors reject without poisoning subsequent operations', async () => {
    for (const isIOS of [false, true]) {
        core.platform(!isIOS, isIOS);
        failure = true;
        await assert.rejects(api.getSecureItem('token'), /storage failure/);
        await assert.rejects(api.setSecureItem('token', 'secret'), /storage failure/);
        await assert.rejects(api.removeSecureItem('token'), /storage failure/);
        failure = false;
        const results = await Promise.all([
            api.setSecureItem('ordered', 'one'), api.getSecureItem('ordered'),
            api.setSecureItem('ordered', 'two'), api.getSecureItem('ordered'),
            api.removeSecureItem('ordered'), api.getSecureItem('ordered')
        ]);
        assert.deepEqual(results, [undefined, 'one', undefined, 'two', undefined, null]);
    }
});

test('missing context, unsupported platforms and old binaries reject explicitly', async () => {
    core.platform(false, false);
    await assert.rejects(api.getSecureItem('token'), /requires Android or iOS/);
    core.platform(true, false);
    globalThis.__secureContext = null;
    await assert.rejects(api.setSecureItem('token', 'value'), /context/);
    globalThis.__secureContext = {};
    const android = globalThis.com;
    delete globalThis.com;
    await assert.rejects(api.getSecureItem('token'), /SecureStorage support/);
    globalThis.com = android;
    core.platform(false, true);
    const native = globalThis.AjaxJSSecureStorage;
    delete globalThis.AjaxJSSecureStorage;
    await assert.rejects(api.getSecureItem('token'), /SecureStorage support/);
    globalThis.AjaxJSSecureStorage = native;
});

test('malformed iOS bridge results reject instead of returning an absent credential', async () => {
    core.platform(false, true);
    const original = globalThis.AjaxJSSecureStorage.getItem;
    globalThis.AjaxJSSecureStorage.getItem = () => null;
    await assert.rejects(api.getSecureItem('token'), /no native result/);
    globalThis.AjaxJSSecureStorage.getItem = () => ({ value: 123 });
    await assert.rejects(api.getSecureItem('token'), /invalid value/);
    globalThis.AjaxJSSecureStorage.getItem = original;
});
