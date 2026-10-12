import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const imported = [];
let response = { statusCode: 200, content: { toJSON: () => ({ keyId: 'aes-v1', key: 'AAAAAAAAAAAAAAAAAAAAAA==' }) } };
let lastRequest;
globalThis.__keystoreCore = {
    isAndroid: true,
    Http: { request: async (options) => { lastRequest = options; return response; } }
};
globalThis.com = { ajaxjs: { nativescript: { android: { crypto: {
    AesKeyStore: { importKey: (...args) => imported.push(args) }
} } } } };
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export const Http=globalThis.__keystoreCore.Http;export const isAndroid=true;export const isIOS=false;', shortCircuit: true };
    return next(specifier, context);
} });
const { provisionAesKey, encryptJson, decryptJson } = await import('../dist/keystore.js');
const options = { endpoint: 'https://example.test/key', jwt: 'test-token' };

test('provisions the key, returns only metadata, disables redirects and sends bearer authorization', async () => {
    assert.deepEqual(await provisionAesKey(options), { keyId: 'aes-v1', alias: 'ajaxjs.aes.aes-v1' });
    assert.deepEqual(imported.pop(), ['ajaxjs.aes.aes-v1', 'AAAAAAAAAAAAAAAAAAAAAA==']);
    assert.equal(lastRequest.headers.Authorization, 'Bearer test-token');
    assert.equal(lastRequest.dontFollowRedirects, true);
});

test('rejects cleartext endpoints, embedded credentials, invalid tokens and timeouts', async () => {
    for (const override of [{ endpoint: 'http://example.test' }, { endpoint: 'https://user:secret@example.test' },
        { jwt: '' }, { jwt: 'token\r\nheader' }, { timeout: -1 }])
        await assert.rejects(provisionAesKey({ ...options, ...override }));
    assert.equal(imported.length, 0);
});

test('rejects HTTP errors and redirects without leaking response bodies', async () => {
    for (const statusCode of [302, 401, 500]) {
        response = { statusCode, content: { toJSON: () => ({ key: 'secret' }) } };
        await assert.rejects(provisionAesKey(options), new RegExp(`HTTP ${statusCode}`));
    }
    assert.equal(imported.length, 0);
});

test('rejects invalid JSON, key IDs and key encodings before import', async () => {
    for (const payload of [null, {}, { keyId: '../bad', key: 'AAAA' }, { keyId: 'aes-v1', key: 'invalid!' }]) {
        response = { statusCode: 200, content: { toJSON: () => payload } };
        await assert.rejects(provisionAesKey(options));
    }
    response = { statusCode: 200, content: { toJSON: () => { throw new Error('secret response'); } } };
    await assert.rejects(provisionAesKey(options), /invalid JSON/);
    assert.equal(imported.length, 0);
});

test('rejects unsupported JSON values and malformed encrypted envelopes', () => {
    assert.throws(() => encryptJson('test', undefined), /JSON serializable/);
    assert.throws(() => decryptJson('test', { nonce: 1, data: 'x' }), /nonce and data/);
});

const aadApi = await import('../dist/keystore.js');
test('Android AAD methods preserve UTF-8 strings and JSON envelopes', () => {
    const calls = [];
    globalThis.com.ajaxjs.nativescript.android.crypto.JsonBodyCipher = {
        encryptWithAssociatedData(...args) {
            calls.push(args);
            return { getNonce: () => 'nonce', getData: () => 'data' };
        },
        decryptWithAssociatedData(...args) {
            calls.push(args);
            return '{"message":"中文"}';
        }
    };
    const aad = '设备/类型 🔐';
    const body = aadApi.encryptJsonWithAssociatedData('test', { message: '中文' }, aad);
    assert.deepEqual(body, { nonce: 'nonce', data: 'data' });
    assert.deepEqual(aadApi.decryptJsonWithAssociatedData('test', body, aad), { message: '中文' });
    assert.deepEqual(calls, [['test', '{"message":"中文"}', aad], ['test', 'nonce', 'data', aad]]);
    for (const invalid of [null, undefined, 1, {}]) {
        assert.throws(() => aadApi.encryptJsonWithAssociatedData('test', {}, invalid), /Associated data/);
        assert.throws(() => aadApi.decryptJsonWithAssociatedData('test', body, invalid), /Associated data/);
    }
    assert.throws(() => aadApi.encryptJsonWithAssociatedData('test', undefined, ''), /JSON serializable/);
    assert.throws(() => aadApi.decryptJsonWithAssociatedData('test', {}, ''), /nonce and data/);
});
