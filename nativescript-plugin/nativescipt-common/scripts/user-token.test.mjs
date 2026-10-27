import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const items = new Map();
let failure = false;
let calls = 0;
const context = {};
globalThis.__userTokenContext = context;
const invoke = (method, token, refresh) => {
    calls++;
    if (failure)
        throw new Error('simulated storage failure');
    if (method === 'remove') {
        items.delete('user_token');
        items.delete('user_refresh_token');
        return null;
    }
    if (method === 'save') {
        items.set('user_token', token);
        items.set('user_refresh_token', refresh);
        return null;
    }
    return items.get(method === 'token' ? 'user_token' : 'user_refresh_token') ?? null;
};
const androidOperation = (method, ctx, token, refresh, callback) => {
    assert.equal(ctx, context);
    setTimeout(() => {
        try { callback.onResult(invoke(method, token, refresh)); }
        catch (error) { callback.onError(error.message); }
    }, 1);
};
globalThis.com = { ajaxjs: { nativescript: { android: { storage: { GetCredential: {
    removeUserToken: ctx => { assert.equal(ctx, context); return invoke('remove'); },
    getUserToken: ctx => { assert.equal(ctx, context); return invoke('token'); },
    getUserRefreshToken: ctx => { assert.equal(ctx, context); return invoke('refresh'); },
    TokenCallback: class { constructor(implementation) { Object.assign(this, implementation); } },
    saveUserTokenAsync: (ctx, token, refresh, callback) => androidOperation('save', ctx, token, refresh, callback),
    getUserTokenAsync: (ctx, callback) => androidOperation('token', ctx, null, null, callback),
    getUserRefreshTokenAsync: (ctx, callback) => androidOperation('refresh', ctx, null, null, callback)
} } } } } };
const ios = (method, token, refresh) => {
    try { return { value: invoke(method, token, refresh), error: null }; }
    catch (error) { return { value: null, error: error.message }; }
};
globalThis.AjaxJSGetCredential = {
    removeUserToken: () => ios('remove'),
    saveUserTokenRefreshToken: (token, refresh) => ios('save', token, refresh),
    getUserToken: () => ios('token'),
    getUserRefreshToken: () => ios('refresh')
};
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export let isAndroid=true;export let isIOS=false;export const Utils={android:{getApplicationContext:()=>globalThis.__userTokenContext}};export function platform(a,i){isAndroid=a;isIOS=i;}', shortCircuit: true };
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const api = await import('../dist/user-token.js');

test('both platforms use fixed Android keys and preserve missing, empty, Unicode and overwrite', async () => {
    assert.equal(api.USER_TOKEN_KEY, 'user_token');
    assert.equal(api.USER_REFRESH_TOKEN_KEY, 'user_refresh_token');
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        items.clear();
        assert.equal(await api.getUserToken(), null);
        assert.equal(await api.getUserRefreshToken(), null);
        assert.equal(await api.saveUserToken('  中文 🤖\n ', 'refresh.token'), undefined);
        assert.equal(await api.getUserToken(), '  中文 🤖\n ');
        assert.equal(await api.getUserRefreshToken(), 'refresh.token');
        await api.saveUserToken('', '');
        assert.equal(await api.getUserToken(), '');
        assert.equal(await api.getUserRefreshToken(), '');
    }
});

test('validates both tokens before writing, including UTF-8 length and unpaired surrogates', async () => {
    const before = calls;
    for (const invalid of [null, undefined, 12, {}, '\ud800', '\udc00', '🤖'.repeat(16385)]) {
        await assert.rejects(api.saveUserToken('valid', invalid));
        await assert.rejects(api.saveUserToken(invalid, 'valid'));
    }
    assert.equal(calls, before);
    await api.saveUserToken('🤖'.repeat(16384), 'a'.repeat(65536));
    assert.equal((await api.getUserToken()).length, 32768);
});

test('async Android completion is awaited and submitted save/read operations retain order', async () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        assert.deepEqual(await Promise.all([
            api.saveUserToken('one', 'refresh-one'), api.getUserToken(), api.getUserRefreshToken(),
            api.saveUserToken('two', 'refresh-two'), api.getUserToken(), api.getUserRefreshToken()
        ]), [undefined, 'one', 'refresh-one', undefined, 'two', 'refresh-two']);
        failure = true;
        await assert.rejects(api.saveUserToken('valid', 'valid'), /storage failure/);
        await assert.rejects(api.getUserToken(), /storage failure/);
        await assert.rejects(api.getUserRefreshToken(), /storage failure/);
        failure = false;
        await api.saveUserToken('recovered', 'valid');
        assert.equal(await api.getUserToken(), 'recovered');
    }
});

test('old bridges, missing context and unsupported platforms reject explicitly', async () => {
    core.platform(false, false);
    await assert.rejects(api.getUserToken(), /requires Android or iOS/);
    core.platform(true, false);
    globalThis.__userTokenContext = null;
    await assert.rejects(api.getUserRefreshToken(), /context/);
    globalThis.__userTokenContext = context;
    const android = globalThis.com;
    delete globalThis.com;
    await assert.rejects(api.getUserToken(), /GetCredential token support/);
    globalThis.com = android;
    core.platform(false, true);
    const ios = globalThis.AjaxJSGetCredential;
    delete globalThis.AjaxJSGetCredential;
    await assert.rejects(api.saveUserToken('valid', 'valid'), /GetCredential token support/);
    globalThis.AjaxJSGetCredential = ios;
});

test('malformed iOS responses do not silently become a missing token', async () => {
    core.platform(false, true);
    const original = globalThis.AjaxJSGetCredential.getUserToken;
    globalThis.AjaxJSGetCredential.getUserToken = () => null;
    await assert.rejects(api.getUserToken(), /no native result/);
    globalThis.AjaxJSGetCredential.getUserToken = () => ({ value: 123 });
    await assert.rejects(api.getUserToken(), /invalid value/);
    globalThis.AjaxJSGetCredential.getUserToken = original;
});


test('sync reads return actual strings or null on both platforms without async callback support', async () => {
    const android = globalThis.com.ajaxjs.nativescript.android.storage.GetCredential;
    const callbackType = android.TokenCallback;
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        items.clear();
        android.TokenCallback = undefined;
        try {
            assert.equal(api.getUserTokenSync(), null);
            assert.equal(api.getUserRefreshTokenSync(), null);
            items.set('user_token', '  中文 🤖\n  ');
            items.set('user_refresh_token', '');
            assert.equal(api.getUserTokenSync(), '  中文 🤖\n  ');
            assert.equal(api.getUserRefreshTokenSync(), '');
            items.set('user_refresh_token', 'refresh-value');
            assert.equal(api.getUserRefreshTokenSync(), 'refresh-value');
        } finally {
            android.TokenCallback = callbackType;
        }
    }
});

test('sync reads propagate native errors synchronously on both platforms', () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        failure = true;
        try {
            assert.throws(() => api.getUserTokenSync(), /storage failure/);
            assert.throws(() => api.getUserRefreshTokenSync(), /storage failure/);
        } finally {
            failure = false;
        }
    }
});

test('sync reads reject missing bridge, context and malformed iOS results', () => {
    core.platform(false, false);
    assert.throws(() => api.getUserTokenSync(), /requires Android or iOS/);
    core.platform(true, false);
    globalThis.__userTokenContext = null;
    assert.throws(() => api.getUserRefreshTokenSync(), /context/);
    globalThis.__userTokenContext = context;
    const android = globalThis.com;
    try {
        delete globalThis.com;
        assert.throws(() => api.getUserTokenSync(), /GetCredential token support/);
    } finally {
        globalThis.com = android;
    }
    core.platform(false, true);
    const ios = globalThis.AjaxJSGetCredential;
    try {
        delete globalThis.AjaxJSGetCredential;
        assert.throws(() => api.getUserRefreshTokenSync(), /GetCredential token support/);
        globalThis.AjaxJSGetCredential = { getUserToken: () => null };
        assert.throws(() => api.getUserTokenSync(), /no native result/);
        globalThis.AjaxJSGetCredential = { getUserToken: () => ({ value: 123 }) };
        assert.throws(() => api.getUserTokenSync(), /invalid value/);
    } finally {
        globalThis.AjaxJSGetCredential = ios;
    }
});

test('sync reads do not wait for queued saves, while awaiting the save exposes new values', async () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        await api.saveUserToken('before', 'refresh-before');
        const save = api.saveUserToken('after', 'refresh-after');
        assert.equal(api.getUserTokenSync(), 'before');
        assert.equal(api.getUserRefreshTokenSync(), 'refresh-before');
        await save;
        assert.equal(api.getUserTokenSync(), 'after');
        assert.equal(api.getUserRefreshTokenSync(), 'refresh-after');
        assert.equal(await api.getUserToken(), 'after');
    }
});


test('renamed save and user removal are synchronous where specified, idempotent and isolated', async () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        items.clear();
        items.set('mqtt_password', 'public-mqtt-password');
        items.set('client_credential', 'public-client-token');
        assert.equal('saveUserTokenKey' in api, false);
        await api.saveUserToken('renamed-token', 'renamed-refresh');
        assert.equal(api.getUserTokenSync(), 'renamed-token');
        assert.equal(api.removeUserToken(), undefined);
        assert.equal(api.removeUserToken(), undefined);
        assert.equal(api.getUserTokenSync(), null);
        assert.equal(await api.getUserRefreshToken(), null);
        assert.equal(items.get('mqtt_password'), 'public-mqtt-password');
        assert.equal(items.get('client_credential'), 'public-client-token');
        failure = true;
        try {
            assert.throws(() => api.removeUserToken(), /storage failure/);
        } finally {
            failure = false;
        }
    }
});
