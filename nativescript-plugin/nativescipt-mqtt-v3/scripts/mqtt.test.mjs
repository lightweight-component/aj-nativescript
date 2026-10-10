import { registerHooks } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
let observer;
let failBinding = false;
const calls = [];
const manager = {
    addObserver(value) { observer = value; },
    start() { if (failBinding) throw new Error('binding failed'); },
    stop() { calls.push(['stop']); },
    subscribe(...args) { calls.push(['subscribe', ...args]); },
    subscribeOnce(...args) { calls.push(['once', ...args]); },
    unsubscribe(...args) { calls.push(['unsubscribe', ...args]); },
    publish(...args) { calls.push(['publish', ...args]); },
    reconnect() { calls.push(['reconnect']); }
};
const builder = new Proxy({}, { get: (_, name) => name === 'build' ? () => ({}) : () => builder });
globalThis.com = { ajaxjs: { nativescript: { android: { mqttv3: {
    MqttConfig: { builder: () => builder }, MqttManager: { getInstance: () => manager },
    MqttObserver: class { constructor(value) { return value; } }
} } } } };
globalThis.java = { util: { function: { Consumer: class { constructor(value) { return value; } } } } };
registerHooks({ resolve(name, context, next) {
    if (name === '@nativescript/core') return { url: 'data:text/javascript,export const isAndroid=true;export const Utils={android:{getApplicationContext:()=>({})}};', shortCircuit: true };
    return next(name, context);
} });
const { mqtt } = await import('../dist/index.js');
const options = { serverUri: 'tcp://localhost:1883', clientId: 'test' };

test('waits for connection and routes typed messages, rejects premature operations and duplicate starts', async () => {
    let message;
    const started = mqtt.start(options, { onMessage: value => message = value });
    assert.throws(() => mqtt.publish('test', 'hello'), /Await/);
    await assert.rejects(mqtt.start(options), /already started/);
    observer.onConnected(false);
    await started;
    observer.onMessage('test', '中文', 1, false);
    assert.equal(message.payload, '中文');
    mqtt.publish('test', 'hello');
    assert.deepEqual(calls.pop(), ['publish', 'test', 'hello', 1, false]);
    mqtt.stop();
});

test('retains one-time callbacks, prevents conflicts and cancels stale delivery', async () => {
    const started = mqtt.start(options); observer.onConnected(false); await started;
    mqtt.subscribe('normal');
    assert.throws(() => mqtt.subscribeOnce('normal', () => {}), /normal subscription/);
    let count = 0;
    mqtt.subscribeOnce('once', () => count++);
    const consumer = calls.at(-1)[3];
    assert.throws(() => mqtt.subscribeOnce('once', () => {}), /already exists/);
    const message = { getTopic: () => 'once', getPayload: () => 'x', getQos: () => 1, isRetained: () => false };
    consumer.accept(message); consumer.accept(message);
    assert.equal(count, 1);
    mqtt.subscribeOnce('cancel', () => count++);
    const cancelled = calls.at(-1)[3]; mqtt.unsubscribe('cancel'); cancelled.accept(message);
    assert.equal(count, 1);
    mqtt.stop();
});

test('stop rejects a pending start, stale observer cannot affect the next connection', async () => {
    const started = mqtt.start(options); const old = observer; mqtt.stop();
    await assert.rejects(started, /stopped/);
    const restarted = mqtt.start(options); old.onConnected(false);
    assert.throws(() => mqtt.publish('test', 'x'), /Await/);
    observer.onConnected(false); await restarted; mqtt.stop();
});

test('timeout and binding failure clean up and allow a later start', async () => {
    await assert.rejects(mqtt.start({ ...options, startTimeoutMs: 5 }), /Timed out/);
    failBinding = true; await assert.rejects(mqtt.start(options), /binding failed/); failBinding = false;
    const started = mqtt.start(options); observer.onConnected(false); await started; mqtt.stop();
});

test('rejects invalid configuration before starting native service', async () => {
    for (const change of [{ serverUri: 'http://localhost' }, { clientId: '' }, { connectionTimeoutSeconds: 0 }, { keepAliveSeconds: 1.5 }, { startTimeoutMs: Infinity }])
        await assert.rejects(mqtt.start({ ...options, ...change }));
});
