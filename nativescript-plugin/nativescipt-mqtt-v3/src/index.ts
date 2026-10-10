/// <reference path="../types/ajaxjs-nativescript.d.ts" preserve="true" />

import { isAndroid, Utils } from '@nativescript/core';

/**
 * MQTT 服务质量等级。
 */
export type MqttQos = 0 | 1 | 2;

/**
 * Android MQTT 3.1.1 连接配置；组件不管理登录、业务主题或加密。
 */
export interface MqttOptions {
    /**
     * Broker URI，例如 tcp://host:1883 或 ssl://host:8883。
     */
    serverUri: string;
    /**
     * Broker 上唯一的客户端标识；持久会话应使用稳定的标识。
     */
    clientId: string;
    /**
     * Broker 用户名，默认不设置。
     */
    username?: string;
    /**
     * Broker 密码，默认不设置；请勿记录日志或硬编码生产凭据。
     */
    password?: string;
    /**
     * 单次连接超时秒数，默认 10，必须为正整数。
     */
    connectionTimeoutSeconds?: number;
    /**
     * 心跳间隔秒数，默认 60，必须为正整数。
     */
    keepAliveSeconds?: number;
    /**
     * 使用每 5 秒检查的 watchdog；默认 false，采用 Paho 自动重连。
     */
    watchDog?: boolean;
    /**
     * 等待首次连接成功的最大毫秒数，默认 20000；超时后停止本次连接。
     */
    startTimeoutMs?: number;
}

/**
 * UTF-8 文本消息快照，不执行 JSON 解析。
 */
export interface MqttMessage {
    /**
     * 实际收到消息的完整主题。
     */
    topic: string;
    /**
     * UTF-8 文本正文。
     */
    payload: string;
    /**
     * 收到消息的 QoS。
     */
    qos: MqttQos;
    /**
     * 是否为 Broker 保留消息。
     */
    retained: boolean;
}

/**
 * 可选 MQTT 事件回调，均在 Android 主线程执行。
 */
export interface MqttEvents {
    /**
     * @param reconnect 是否由 Paho 报告为重连。
     * @returns 无返回值。
     */
    onConnected?: (reconnect: boolean) => void;
    /**
     * @param error 原生连接错误；失联时可能为 null。
     * @returns 无返回值。首次连接失败时仍会重试到 start 超时。
     */
    onConnectionLost?: (error: java.lang.Throwable | null) => void;
    /**
     * @param message 收到的文本消息；一次性订阅消息也会触发此事件。
     * @returns 无返回值。
     */
    onMessage?: (message: MqttMessage) => void;
    /**
     * @param topic 订阅主题。
     * @param error 成功为 null，失败为原生异常。
     * @returns 无返回值。
     */
    onSubscribed?: (topic: string, error: java.lang.Throwable | null) => void;
    /**
     * @param topic 发布主题。
     * @param error 成功为 null，失败为原生异常。
     * @returns 无返回值。
     */
    onPublished?: (topic: string, error: java.lang.Throwable | null) => void;
}

function native() {
    if (!isAndroid) 
        throw new Error('MQTT v3 currently supports Android only.');

    return com.ajaxjs.nativescript.android.mqttv3;
}

function positive(value: number, name: string): number {
    if (!Number.isInteger(value) || value <= 0 || value > 2147483647)
        throw new Error(name + ' must be a positive 32-bit integer.');
    
    return value;
}

/**
 * 单进程 MQTT 客户端，内部使用一个 Android 绑定服务。
 * 连接与停止须在主线程调用；更换配置前必须先 stop。
 */
class AndroidMqttClient {
    private observer?: com.ajaxjs.nativescript.android.mqttv3.MqttObserver;
    private pending?: (error?: Error) => void;
    private ready = false;
    private readonly topics = new Set<string>();
    private readonly onceCallbacks = new Map<string, java.util.function.Consumer<com.ajaxjs.nativescript.android.mqttv3.MqttReceivedMessage>>();

    /**
     * 启动并等待 Broker 连接成功；导入模块不会自动建立连接。
     *
     * @param options 连接配置及首次连接等待超时。
     * @param events 可选事件回调；整个连接生命周期持续生效。
     * @returns 首次成功连接后完成的 Promise。
     * @throws 非 Android、参数无效、已启动、服务绑定失败或等待超时时 Promise 拒绝。
     */
    async start(options: MqttOptions, events: MqttEvents = {}): Promise<void> {
        const api = native();

        if (this.observer) 
            throw new Error('MQTT is already started; stop it before changing configuration.');

        if (!options || typeof options.serverUri !== 'string' || !new RegExp('^(tcp|ssl|ws|wss)://').test(options.serverUri))
            throw new Error('A tcp, ssl, ws or wss Broker URI is required.');

        if (!options.clientId?.trim()) 
            throw new Error('A clientId is required.');

        const timeout = positive(options.startTimeoutMs ?? 20000, 'startTimeoutMs');
        const builder = api.MqttConfig.builder().serverUri(options.serverUri).clientId(options.clientId)
            .connectionTimeoutSeconds(positive(options.connectionTimeoutSeconds ?? 10, 'connectionTimeoutSeconds'))
            .keepAliveSeconds(positive(options.keepAliveSeconds ?? 60, 'keepAliveSeconds'))
            .watchDog(options.watchDog ?? false);

        if (options.username !== undefined)
            builder.username(options.username);

        if (options.password !== undefined)
            builder.password(options.password);

        const config = builder.build();

        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                finish(new Error('Timed out waiting for the MQTT connection.'));
                this.stop();
            }, timeout);
            const finish = (error?: Error) => {
                clearTimeout(timer);
                this.pending = undefined;
                if (error) reject(error); else resolve();
            };

            this.pending = finish;

            const observer = new api.MqttObserver({
                onConnected: (reconnect: boolean) => {
                    if (this.observer !== observer) return;
                    this.ready = true;
                    this.pending?.();
                    events.onConnected?.(reconnect);
                },
                onConnectionLost: (error: java.lang.Throwable | null) => {
                    if (this.observer === observer) events.onConnectionLost?.(error);
                },
                onMessage: (topic: string, payload: string, qos: number, retained: boolean) => {
                    if (this.observer === observer) events.onMessage?.({ topic, payload, qos: qos as MqttQos, retained });
                },
                onSubscribed: (topic: string, error: java.lang.Throwable | null) => {
                    if (this.observer === observer) events.onSubscribed?.(topic, error);
                },
                onPublished: (topic: string, error: java.lang.Throwable | null) => {
                    if (this.observer === observer) events.onPublished?.(topic, error);
                }
            });

            this.observer = observer;

            try {
                const manager = api.MqttManager.getInstance();
                manager.addObserver(observer);
                manager.start(Utils.android.getApplicationContext(), config);
            } catch (error) {
                finish(error instanceof Error ? error : new Error('Unable to start MQTT Service.'));
                this.stop();
            }
        });
    }

    /**
     * 停止并解绑服务，清除监听器及一次性回调；允许重复调用和之后重新启动。
     *
     * @returns 无返回值；尚未完成的 start 会被拒绝，原生资源异步释放。
     * @throws 非 Android 平台或未在主线程调用时抛出异常。
     */
    stop(): void {
        const manager = native().MqttManager.getInstance();
        manager.stop();
        this.observer = undefined;
        this.ready = false;
        this.onceCallbacks.clear();
        this.topics.clear();
        this.pending?.(new Error('MQTT stopped before the connection completed.'));
    }

    private manager() {
        if (!this.ready) 
            throw new Error('Await mqtt.start() before performing MQTT operations.');

        return native().MqttManager.getInstance();
    }

    /**
     * 订阅主题；断线时记录订阅意图，重连后恢复。
     *
     * @param topic MQTT 主题过滤器，允许 + 和 # 通配符。
     * @param qos QoS 等级，默认 1。
     * @returns 无返回值，Broker 结果通过 onSubscribed 通知。
     * @throws 未完成 start 或主题、QoS 无效时抛出异常。
     */
    subscribe(topic: string, qos: MqttQos = 1): void {
        this.manager().subscribe(topic, qos, null);
        this.onceCallbacks.delete(topic);
        this.topics.add(topic);
    }

    /**
     * 订阅精确主题并消费第一条消息，随后自动取消订阅。
     *
     * @param topic 不含通配符且未被普通订阅占用的主题。
     * @param callback 首条消息回调，在主线程执行。
     * @param qos QoS 等级，默认 1。
     * @returns 无返回值；未收到消息时保持等待，unsubscribe 或 stop 可取消。
     * @throws 未完成 start、参数无效或重复一次性订阅时抛出异常。
     */
    subscribeOnce(topic: string, callback: (message: MqttMessage) => void, qos: MqttQos = 1): void {
        const manager = this.manager();
        if (typeof callback !== 'function') 
            throw new Error('A message callback is required.');

        if (this.topics.has(topic)) 
            throw new Error('The topic already has a normal subscription.');

        if (this.onceCallbacks.has(topic)) 
            throw new Error('A one-time subscription already exists for this topic.');

        const observer = this.observer;
        const consumer = new java.util.function.Consumer<com.ajaxjs.nativescript.android.mqttv3.MqttReceivedMessage>({
            accept: (message: com.ajaxjs.nativescript.android.mqttv3.MqttReceivedMessage) => {
                if (this.observer !== observer || this.onceCallbacks.get(topic) !== consumer) 
                    return;

                this.onceCallbacks.delete(topic);
                callback({ topic: message.getTopic(), payload: message.getPayload(), qos: message.getQos() as MqttQos, retained: message.isRetained() });
            }
        });
        manager.subscribeOnce(topic, qos, consumer);
        this.onceCallbacks.set(topic, consumer);
    }

    /**
     * 取消普通或一次性订阅。
     *
     * @param topic 原订阅的主题过滤器。
     * @returns 无返回值，不等待 Broker 确认。
     * @throws 未完成 start 或主题无效时抛出异常。
     */
    unsubscribe(topic: string): void {
        this.manager().unsubscribe(topic, null);
        this.onceCallbacks.delete(topic);
        this.topics.delete(topic);
    }

    /**
     * 发布 UTF-8 文本；断线时不缓存，失败通过 onPublished 通知。
     *
     * @param topic 不含通配符的消息主题。
     * @param payload 文本正文；JSON 请自行序列化。
     * @param qos QoS 等级，默认 1。
     * @param retained 是否保留消息，默认 false。
     * @returns 无返回值，Broker 结果通过 onPublished 通知。
     * @throws 未完成 start 或参数无效时抛出异常。
     */
    publish(topic: string, payload: string, qos: MqttQos = 1, retained = false): void {
        this.manager().publish(topic, payload, qos, retained);
    }

    /**
     * 发起一次手动重连；已连接或正在连接时忽略。
     *
     * @returns 无返回值，连接结果通过事件通知。
     * @throws 未完成 start 时抛出异常。
     */
    reconnect(): void {
        this.manager().reconnect();
    }
}

/**
 * 进程内共享客户端；不支持同时连接多个 Broker。
 */
export const mqtt = new AndroidMqttClient();
