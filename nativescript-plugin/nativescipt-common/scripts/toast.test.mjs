import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const calls = [];
const context = {};
globalThis.__toastApplication = { android: { context } };
globalThis.com = { ajaxjs: { nativescript: { android: { utils: { Helper: {
    toast: (...args) => calls.push(args)
} } } } } };
globalThis.AjaxJSIOSHelper = {
    showToast: message => calls.push([message]),
    getAppVersionName: () => '1.0', getAppBuildNumber: () => '2',
    openAppInAppStoreIsInternational: (...args) => calls.push(args),
    forcePortrait: () => calls.push(['portrait'])
};
registerHooks({ resolve(specifier, context, next) {
    if (specifier === '@nativescript/core')
        return { url: 'data:text/javascript,export let isAndroid=true;export let isIOS=false;export const Device={osVersion:"15.0"};export const Application=globalThis.__toastApplication;export function platform(a,i){isAndroid=a;isIOS=i;}', shortCircuit: true };
    return next(specifier, context);
} });
const core = await import('@nativescript/core');
const { toast } = await import('../dist/toast.js');
const { com: ios } = await import('../dist/ios.js');
test('unified toast routes Android context and iOS message, ignores blanks, rejects invalid inputs', () => {
    toast('Android');
    assert.deepEqual(calls.pop(), [context, 'Android']);
    core.platform(false, true);
    toast('iOS');
    assert.deepEqual(calls.pop(), ['iOS']);
    toast(' \n ');
    assert.equal(calls.length, 0);
    assert.throws(() => toast(null), TypeError);
    core.platform(false, false);
    assert.throws(() => toast('unsupported'), /requires Android or iOS/);
});
test('namespaced iOS helper delegates utilities and guards availability', () => {
    const helper = ios.ajaxjs.nativescript.ios.Helper;
    assert.throws(() => helper.getAppVersionName(), /requires iOS/);
    core.platform(false, true);
    assert.equal(helper.getAppVersionName(), '1.0');
    assert.equal(helper.getAppBuildNumber(), '2');
    helper.openAppInAppStore('123', true);
    assert.deepEqual(calls.pop(), ['123', true]);
    assert.throws(() => helper.forcePortrait(), /iOS 16/);
    core.Device.osVersion = '26.5';
    helper.forcePortrait();
    assert.deepEqual(calls.pop(), ['portrait']);
});
