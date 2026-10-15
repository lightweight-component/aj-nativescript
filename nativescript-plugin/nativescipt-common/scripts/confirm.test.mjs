import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
const activity = {};
globalThis.__confirmApplication = { android: { foregroundActivity: activity } };
const native = {
    Callback: class {
        constructor(callback) {
            Object.assign(this, callback);
        }
    },
    show(host, json, callback) {
        calls.push({ host, options: JSON.parse(json), result: (value, error) => error ? callback.onError(error) : callback.onResult(value) });
    }
};
globalThis.com = { ajaxjs: { nativescript: { android: { utils: { ConfirmDialog: native } } } } };
globalThis.AjaxJSConfirmDialog = {
    showCompletion(json, callback) {
        calls.push({ options: JSON.parse(json), result: callback });
    }
};
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core') {
        const code = `
            export let isAndroid=true; export let isIOS=false;
            export const Application=globalThis.__confirmApplication;
            export const Utils={};
            export function platform(a,i){isAndroid=a;isIOS=i;}
            export class Color {
                constructor(value) {
                    if (!/^#[0-9a-f]{6}$/i.test(value))
                        throw new Error('Invalid color');
                    this.argb=parseInt('ff'+value.slice(1),16);
                }
            }`;
        return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
    }
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const { confirm } = await import('../dist/common-helper.js');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('both bridges preserve Unicode, default options, styling and true/false results', async () => {
    for (const ios of [false, true]) {
        core.platform(!ios, ios);
        const promise = confirm({ message: '  确认 🤖\n继续？  ', maskClosable: true, okColor: '#123456', position: 'LEFT' });
        await tick();
        const call = calls.shift();
        assert.equal(call.options.message, '  确认 🤖\n继续？  ');
        assert.equal(call.options.title, '提示');
        assert.equal(call.options.okText, '确认');
        assert.equal(call.options.cancelText, '取消');
        assert.equal(call.options.okColor, '#FF123456');
        assert.equal(call.options.cancelColor, '#FFE2E2E2');
        assert.equal(call.options.maskClosable, true);
        assert.equal(call.options.position, 'LEFT');
        if (!ios)
            assert.equal(call.host, activity);
        call.result(true, null);
        call.result(false, 'duplicate');
        assert.equal(await promise, true);
        const canceled = confirm({ message: '' });
        await tick();
        const cancel = calls.shift();
        assert.equal(cancel.options.maskClosable, false);
        cancel.result(false, null);
        assert.equal(await canceled, false);
    }
});

test('concurrent requests are serial and native failure does not stall the queue', async () => {
    core.platform(true, false);
    const first = confirm({ message: 'first' });
    const failed = assert.rejects(first, /native failed/);
    const second = confirm({ message: 'second' });
    await tick();
    assert.equal(calls.length, 1);
    const call = calls.shift();
    assert.equal(call.options.message, 'first');
    call.result(false, 'native failed');
    await failed;
    await tick();
    assert.equal(calls.length, 1);
    const next = calls.shift();
    assert.equal(next.options.message, 'second');
    next.result(true);
    assert.equal(await second, true);
});

test('invalid options, absent native code and unsupported platforms reject; no activity returns false', async () => {
    for (const options of [null, {}, { message: 1 }, { message: '', title: 3 }, { message: '', maskClosable: 'yes' }, { message: '', okColor: 'bad' }])
        await assert.rejects(confirm(options));
    assert.equal(calls.length, 0);
    core.platform(true, false);
    delete globalThis.__confirmApplication.android.foregroundActivity;
    assert.equal(await confirm({ message: 'no activity' }), false);
    globalThis.__confirmApplication.android.foregroundActivity = activity;
    delete globalThis.com.ajaxjs.nativescript.android.utils.ConfirmDialog;
    await assert.rejects(confirm({ message: 'missing Android' }), /ConfirmDialog support/);
    globalThis.com.ajaxjs.nativescript.android.utils.ConfirmDialog = native;
    core.platform(false, true);
    delete globalThis.AjaxJSConfirmDialog;
    await assert.rejects(confirm({ message: 'missing iOS' }), /ConfirmDialog support/);
    core.platform(false, false);
    await assert.rejects(confirm({ message: 'unsupported' }), /requires Android or iOS/);
});
