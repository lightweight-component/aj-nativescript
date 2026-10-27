import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const items = new Map();
const context = {};
let failure = false;
let failPassword = false;
let writes = 0;
globalThis.__credentialContext = context;
function get(key) {
    if (failure)
        throw new Error('simulated storage failure');
    return items.get(key) ?? null;
}
function set(username, password) {
    if (failure)
        throw new Error('simulated storage failure');
    writes++;
    items.set('mqtt_username', username);
    if (failPassword)
        throw new Error('simulated password write failure');
    items.set('mqtt_password', password);
}
globalThis.com = { ajaxjs: { nativescript: { android: { storage: { GetCredential: {
    saveAesKey: (ctx, value) => { assert.equal(ctx, context); saveAes(value); },
    getAesKey: ctx => { assert.equal(ctx, context); return get('AES_KEY'); },
    removeAesKey: ctx => { assert.equal(ctx, context); remove(['AES_KEY']); },
    removeMqttCredential: ctx => { assert.equal(ctx, context); remove(['mqtt_username', 'mqtt_password']); },
    saveClientCredential: (ctx, token) => { assert.equal(ctx, context); saveClient(token); },
    getClientCredential: ctx => { assert.equal(ctx, context); return get('client_credential'); },
    removeClientCredential: ctx => { assert.equal(ctx, context); remove(['client_credential']); },
    getMqttUsername: ctx => { assert.equal(ctx, context); return get('mqtt_username'); },
    getMqttPassword: ctx => { assert.equal(ctx, context); return get('mqtt_password'); },
    setMqttCredential: (ctx, username, password) => { assert.equal(ctx, context); set(username, password); }
} } } } } };
function remove(keys) {
    if (failure)
        throw new Error('simulated storage failure');
    for (const key of keys)
        items.delete(key);
    return true;
}
function saveClient(token) {
    if (failure)
        throw new Error('simulated storage failure');
    items.set('client_credential', token);
    return true;
}
function saveAes(value) {
    if (failure)
        throw new Error('simulated storage failure');
    items.set('AES_KEY', value);
    return true;
}
function result(action) {
    try { return { value: action(), error: null }; }
    catch (error) { return { value: null, error: error.message }; }
}
globalThis.AjaxJSGetCredential = {
    saveAesKey: value => result(() => saveAes(value)),
    getAesKey: () => result(() => get('AES_KEY')),
    removeAesKey: () => result(() => remove(['AES_KEY'])),
    removeMqttCredential: () => result(() => remove(['mqtt_username', 'mqtt_password'])),
    saveClientCredential: token => result(() => saveClient(token)),
    getClientCredential: () => result(() => get('client_credential')),
    removeClientCredential: () => result(() => remove(['client_credential'])),
    getMqttUsername: () => result(() => get('mqtt_username')),
    getMqttPassword: () => result(() => get('mqtt_password')),
    setMqttCredentialPassword: (username, password) => result(() => { set(username, password); return true; })
};
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export let isAndroid=true;export let isIOS=false;export const Utils={android:{getApplicationContext:()=>globalThis.__credentialContext}};export function platform(a,i){isAndroid=a;isIOS=i;}', shortCircuit: true };
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const api = await import('../dist/credential.js');

test('both platforms synchronously store separate fixed MQTT keys and preserve Unicode, spaces, underscores and empty values', () => {
    assert.equal(api.MQTT_USERNAME_KEY, 'mqtt_username');
    assert.equal(api.MQTT_PASSWORD_KEY, 'mqtt_password');
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        items.clear();
        items.set('user_token', 'public-token');
        assert.equal(api.getMqttUsername(), null);
        assert.equal(api.getMqttPassword(), null);
        assert.equal(api.setMqttCredential(' 用户_name 🤖 ', '  password_🔐\n  '), undefined);
        assert.equal(api.getMqttUsername(), ' 用户_name 🤖 ');
        assert.equal(api.getMqttPassword(), '  password_🔐\n  ');
        api.setMqttCredential('', '');
        assert.equal(api.getMqttUsername(), '');
        assert.equal(api.getMqttPassword(), '');
        api.setMqttCredential('replacement', 'cGFzcw==');
        assert.equal(api.getMqttPassword(), 'cGFzcw==');
        assert.equal(items.get('user_token'), 'public-token');
    }
});

test('both input fields are validated before writing, including Unicode and UTF-8 limits', () => {
    const before = writes;
    for (const value of [null, 123, {}, '\ud800', '\udc00', '🤖'.repeat(16385)]) {
        assert.throws(() => api.setMqttCredential('valid', value));
        assert.throws(() => api.setMqttCredential(value, 'valid'));
    }
    assert.equal(writes, before);
    api.setMqttCredential('a'.repeat(65536), '🤖'.repeat(16384));
    assert.equal(api.getMqttPassword().length, 32768);
});

test('storage errors throw synchronously, including a partially completed pair write, and retry succeeds', () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        api.setMqttCredential('old-user', 'old-password');
        failure = true;
        try {
            assert.throws(() => api.getMqttUsername(), /storage failure/);
            assert.throws(() => api.getMqttPassword(), /storage failure/);
            assert.throws(() => api.setMqttCredential('new-user', 'new-password'), /storage failure/);
        } finally {
            failure = false;
        }
        failPassword = true;
        try {
            assert.throws(() => api.setMqttCredential('new-user', 'new-password'), /password write failure/);
            assert.equal(api.getMqttUsername(), 'new-user');
            assert.equal(api.getMqttPassword(), 'old-password');
        } finally {
            failPassword = false;
        }
        api.setMqttCredential('new-user', 'new-password');
        assert.equal(api.getMqttPassword(), 'new-password');
    }
});

test('unsupported platform, missing context and old native interfaces reject explicitly', () => {
    core.platform(false, false);
    assert.throws(() => api.getMqttUsername(), /requires Android or iOS/);
    assert.throws(() => api.setMqttCredential('user', 'password'), /requires Android or iOS/);
    core.platform(true, false);
    globalThis.__credentialContext = null;
    assert.throws(() => api.getMqttPassword(), /context/);
    globalThis.__credentialContext = context;
    const android = globalThis.com;
    try {
        delete globalThis.com;
        assert.throws(() => api.getMqttUsername(), /GetCredential support/);
    } finally {
        globalThis.com = android;
    }
    core.platform(false, true);
    const ios = globalThis.AjaxJSGetCredential;
    try {
        globalThis.AjaxJSGetCredential = {};
        assert.throws(() => api.getMqttPassword(), /GetCredential support/);
        assert.throws(() => api.setMqttCredential('user', 'password'), /GetCredential support/);
    } finally {
        globalThis.AjaxJSGetCredential = ios;
    }
});

test('malformed iOS results fail instead of becoming missing credentials', () => {
    core.platform(false, true);
    const original = globalThis.AjaxJSGetCredential.getMqttUsername;
    try {
        globalThis.AjaxJSGetCredential.getMqttUsername = () => null;
        assert.throws(() => api.getMqttUsername(), /no native result/);
        globalThis.AjaxJSGetCredential.getMqttUsername = () => ({ value: 123 });
        assert.throws(() => api.getMqttUsername(), /invalid value/);
    } finally {
        globalThis.AjaxJSGetCredential.getMqttUsername = original;
    }
});


test('client tokens and MQTT removal use independent fixed keys and preserve missing versus empty values', () => {
    assert.equal(api.CLIENT_CREDENTIAL_KEY, 'client_credential');
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        items.clear();
        items.set('user_token', 'public-user-token');
        assert.equal(api.getClientCredential(), null);
        assert.equal(api.saveClientCredential('  client_token 🤖\n '), undefined);
        assert.equal(api.getClientCredential(), '  client_token 🤖\n ');
        api.setMqttCredential('user', 'password');
        assert.equal(api.removeMqttCredential(), undefined);
        api.removeMqttCredential();
        assert.equal(api.getMqttUsername(), null);
        assert.equal(api.getMqttPassword(), null);
        assert.equal(api.getClientCredential(), '  client_token 🤖\n ');
        api.saveClientCredential('');
        assert.equal(api.getClientCredential(), '');
        api.setMqttCredential('user', 'password');
        assert.equal(api.removeClientCredential(), undefined);
        api.removeClientCredential();
        assert.equal(api.getClientCredential(), null);
        assert.equal(api.getMqttPassword(), 'password');
        assert.equal(items.get('user_token'), 'public-user-token');
    }
});

test('client validation and storage/delete errors propagate synchronously on both platforms', () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        api.saveClientCredential('existing');
        for (const value of [null, {}, 123, '\ud800', '\udc00', '🤖'.repeat(16385)])
            assert.throws(() => api.saveClientCredential(value));
        assert.equal(api.getClientCredential(), 'existing');
        api.saveClientCredential('🤖'.repeat(16384));
        assert.equal(api.getClientCredential().length, 32768);
        failure = true;
        try {
            assert.throws(() => api.saveClientCredential('new'), /storage failure/);
            assert.throws(() => api.getClientCredential(), /storage failure/);
            assert.throws(() => api.removeClientCredential(), /storage failure/);
            assert.throws(() => api.removeMqttCredential(), /storage failure/);
        } finally {
            failure = false;
        }
    }
});


test('AES key strings use the exact fixed key, preserve raw values and delete without touching other categories', () => {
    assert.equal(api.AES_KEY_KEY, 'AES_KEY');
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        items.clear();
        items.set('user_token', 'public-user-token');
        api.setMqttCredential('public-user', 'public-password');
        api.saveClientCredential('public-client-token');
        assert.equal(api.getAesKey(), null);
        for (const value of ['MDEyMzQ1Njc4OWFiY2RlZg==', '  原始密钥文本 🤖_\n ', '', 'not-base64']) {
            assert.equal(api.saveAesKey(value), undefined);
            assert.equal(api.getAesKey(), value);
            assert.equal(items.get('AES_KEY'), value);
        }
        assert.equal(api.removeAesKey(), undefined);
        api.removeAesKey();
        assert.equal(api.getAesKey(), null);
        assert.equal(items.get('user_token'), 'public-user-token');
        assert.equal(api.getMqttPassword(), 'public-password');
        assert.equal(api.getClientCredential(), 'public-client-token');
    }
});

test('AES string validation, native failures and old binaries fail explicitly while reads remain synchronous', () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        api.saveAesKey('existing');
        for (const value of [null, 123, {}, '\ud800', '\udc00', '🤖'.repeat(16385)])
            assert.throws(() => api.saveAesKey(value));
        assert.equal(api.getAesKey(), 'existing');
        api.saveAesKey('🤖'.repeat(16384));
        assert.equal(api.getAesKey().length, 32768);
        failure = true;
        try {
            assert.throws(() => api.saveAesKey('new'), /storage failure/);
            assert.throws(() => api.getAesKey(), /storage failure/);
            assert.throws(() => api.removeAesKey(), /storage failure/);
        } finally {
            failure = false;
        }
    }
    core.platform(false, false);
    assert.throws(() => api.getAesKey(), /requires Android or iOS/);
    assert.throws(() => api.saveAesKey('x'), /requires Android or iOS/);
    assert.throws(() => api.removeAesKey(), /requires Android or iOS/);
    core.platform(false, true);
    const original = globalThis.AjaxJSGetCredential;
    try {
        globalThis.AjaxJSGetCredential = {};
        assert.throws(() => api.getAesKey(), /GetCredential support/);
        assert.throws(() => api.saveAesKey('x'), /GetCredential support/);
        globalThis.AjaxJSGetCredential = { getAesKey: () => ({ value: 123 }) };
        assert.throws(() => api.getAesKey(), /invalid value/);
    } finally {
        globalThis.AjaxJSGetCredential = original;
    }
});
