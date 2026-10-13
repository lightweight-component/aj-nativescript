import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const context = {};
let text = '';
let receivedContext;
globalThis.com = { ajaxjs: { nativescript: { android: { utils: { Helper: {
    copyToClipboard: (ctx, value) => { receivedContext = ctx; text = value; },
    getFromClipboard: ctx => { receivedContext = ctx; return text; }
} } } } } };
globalThis.AjaxJSIOSHelper = {
    copyToClipboard: value => { text = value; },
    getFromClipboard: () => text
};
globalThis.__clipboardContext = context;
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export let isAndroid=true;export let isIOS=false;export const Application={};export const Utils={android:{getApplicationContext:()=>globalThis.__clipboardContext}};export function platform(a,i){isAndroid=a;isIOS=i;}', shortCircuit: true };
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const api = await import('../dist/common-helper.js');
test('clipboard preserves Unicode, whitespace, empty values and replacement on both platforms', () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        for (const value of ['  中文 🔐\n第二行  ', ' \n ', '', 'replacement']) {
            assert.equal(api.copyToClipboard(value), undefined);
            assert.equal(api.getFromClipboard(), value);
        }
    }
    assert.equal(receivedContext, context);
});
test('clipboard rejects invalid types, unsupported platforms, unavailable context and old iOS binary', () => {
    assert.throws(() => api.copyToClipboard(null), TypeError);
    assert.throws(() => api.copyToClipboard(123), TypeError);
    core.platform(false, false);
    assert.throws(() => api.copyToClipboard(''), /requires Android or iOS/);
    assert.throws(() => api.getFromClipboard(), /requires Android or iOS/);
    core.platform(true, false);
    globalThis.__clipboardContext = undefined;
    assert.throws(() => api.getFromClipboard(), /context/);
    assert.throws(() => api.copyToClipboard('value'), /context/);
    core.platform(false, true);
    delete globalThis.AjaxJSIOSHelper.copyToClipboard;
    assert.throws(() => api.copyToClipboard('value'), /clipboard support/);
    delete globalThis.AjaxJSIOSHelper;
    assert.throws(() => api.getFromClipboard(), /clipboard support/);
});
