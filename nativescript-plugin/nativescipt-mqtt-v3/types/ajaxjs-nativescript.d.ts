/// <reference types="@nativescript/types" />

/**
 * Android MQTT 3.1.1 原生接口，需要 npm 包中的 JAR 和 Paho 依赖。
 */
declare namespace com.ajaxjs.nativescript.android.mqttv3 {
    class MqttConfig extends java.lang.Object {
        private constructor();
        /**
         * @returns 新的配置构建器。
         */
        static builder(): MqttConfig.Builder;
        /**
         * @returns Broker URI。
         */
        getServerUri(): string;
        /**
         * @returns 客户端标识。
         */
        getClientId(): string;
        /**
         * @returns 用户名；未设置时为 null。
         */
        getUsername(): string | null;
        /**
         * @returns 密码字符数组的防御性副本；未设置时为 null。
         */
        getPassword(): native.Array<string> | null;
        /**
         * @returns 连接超时秒数。
         */
        getConnectionTimeoutSeconds(): number;
        /**
         * @returns 心跳间隔秒数。
         */
        getKeepAliveSeconds(): number;
        /**
         * @returns 是否启用 watchdog。
         */
        isWatchDog(): boolean;
    }
    namespace MqttConfig {
        class Builder extends java.lang.Object {
            private constructor();
            /**
             * @param value 完整 Broker URI。
             * @returns 当前构建器。
             */
            serverUri(value: string): Builder;
            /**
             * @param value 非空白且唯一的客户端标识。
             * @returns 当前构建器。
             */
            clientId(value: string): Builder;
            /**
             * @param value 用户名，null 表示未设置。
             * @returns 当前构建器。
             */
            username(value: string | null): Builder;
            /**
             * @param value 密码字符串或 Java char 数组，null 表示未设置。
             * @returns 当前构建器，数组会被复制。
             */
            password(value: string | native.Array<string> | null): Builder;
            /**
             * @param seconds 正整数秒数，默认 10。
             * @returns 当前构建器。
             */
            connectionTimeoutSeconds(seconds: number): Builder;
            /**
             * @param seconds 正整数秒数，默认 60。
             * @returns 当前构建器。
             */
            keepAliveSeconds(seconds: number): Builder;
            /**
             * @param enabled 是否启用 watchdog，默认 false。
             * @returns 当前构建器。
             */
            watchDog(enabled: boolean): Builder;
            /**
             * @returns 不可变配置。
             * @throws 必填字符串为空或秒数非正数时抛出异常。
             */
            build(): MqttConfig;
        }
    }
    class MqttObserver extends java.lang.Object {
        /**
         * @param implementation 所有事件的实现，回调在主线程执行。
         */
        constructor(implementation: {
            onConnected(reconnect: boolean): void;
            onConnectionLost(error: java.lang.Throwable | null): void;
            onMessage(topic: string, payload: string, qos: number, retained: boolean): void;
            onSubscribed(topic: string, error: java.lang.Throwable | null): void;
            onPublished(topic: string, error: java.lang.Throwable | null): void;
        });
    }
    class AfterConnectedMqtt extends java.lang.Object {
        /**
         * @param implementation 重连成功回调，在主线程执行。
         */
        constructor(implementation: { callback(): void });
    }
    class MqttReceivedMessage extends java.lang.Object {
        /**
         * @param topic 消息主题。
         * @param payload UTF-8 文本消息。
         * @param qos QoS 等级。
         * @param retained 是否为保留消息。
         */
        constructor(topic: string, payload: string, qos: number, retained: boolean);
        /**
         * @returns 消息主题。
         */
        getTopic(): string;
        /**
         * @returns UTF-8 文本消息。
         */
        getPayload(): string;
        /**
         * @returns QoS 等级。
         */
        getQos(): number;
        /**
         * @returns 是否为 Broker 保留消息。
         */
        isRetained(): boolean;
    }
    class MqttManager extends java.lang.Object {
        /**
         * @returns 进程内单例管理器。
         */
        static getInstance(): MqttManager;
        /**
         * @param context Android 应用上下文。
         * @param config 连接配置，重复启动不会改变配置。
         * @returns 无返回值；绑定异步完成。
         * @throws 非主线程、参数为空或绑定失败时抛出异常。
         */
        start(context: android.content.Context, config: MqttConfig): void;
        /**
         * @returns 无返回值；解绑并异步释放资源，清除观察者及预订阅。
         * @throws 非主线程调用时抛出异常。
         */
        stop(): void;
        /**
         * @param topic QoS 1 预订阅主题过滤器，绑定后自动订阅。
         * @returns 无返回值。
         */
        preSubscribe(topic: string): void;
        /**
         * @param topic 主题过滤器。
         * @param qos QoS 等级，单参数重载默认 1。
         * @param callback 成功确认回调，可为 null；令牌类型来自 Paho。
         * @returns 无返回值，结果也通过观察者通知。
         * @throws 服务未绑定或参数无效时抛出异常。
         */
        subscribe(topic: string): void;
        /**
         * @param topic MQTT 主题过滤器。
         * @param qos QoS 等级 0、1 或 2。
         * @param callback Broker 成功确认回调，可为 null。
         * @returns 无返回值。
         */
        subscribe(topic: string, qos: number, callback: java.util.function.Consumer<org.eclipse.paho.client.mqttv3.IMqttToken> | null): void;
        /**
         * @param topic 不含通配符的精确主题。
         * @param qos QoS 等级，默认重载为 1。
         * @param callback 首条消息回调。
         * @returns 无返回值；重复或普通订阅占用的主题会被拒绝。
         */
        subscribeOnce(topic: string, qos: number, callback: java.util.function.Consumer<MqttReceivedMessage>): void;
        /**
         * @param topic 不含通配符且未被普通订阅占用的主题。
         * @param callback 首条消息回调，在主线程执行。
         * @returns 无返回值，使用 QoS 1。
         */
        subscribeOnce(topic: string, callback: java.util.function.Consumer<MqttReceivedMessage>): void;
        /**
         * @param topic 主题过滤器。
         * @param callback 成功确认回调，可为 null。
         * @returns 无返回值。
         */
        unsubscribe(topic: string, callback: java.util.function.Consumer<org.eclipse.paho.client.mqttv3.IMqttToken> | null): void;
        /**
         * @param topic 不含通配符的主题。
         * @param payload UTF-8 消息文本。
         * @param qos QoS 等级，双参数重载默认 1。
         * @param retained 是否保留，双参数重载默认 false。
         * @returns 无返回值，结果通过观察者通知。
         */
        publish(topic: string, payload: string): void;
        /**
         * @param topic 精确发布主题。
         * @param payload UTF-8 文本正文。
         * @param qos QoS 等级 0、1 或 2。
         * @param retained 是否保留消息。
         * @returns 无返回值，结果由观察者通知。
         */
        publish(topic: string, payload: string, qos: number, retained: boolean): void;
        /**
         * @param callback 可选重连成功回调，null 表示不设置。
         * @returns 无返回值；已连接或正在连接时忽略。
         */
        reconnect(): void;
        /**
         * @param callback 重连成功回调，可为 null。
         * @returns 无返回值，回调在主线程执行。
         */
        reconnect(callback: AfterConnectedMqtt | null): void;
        /**
         * @param observer 观察者，不能为 null。
         * @returns 无返回值；允许绑定前注册。
         */
        addObserver(observer: MqttObserver): void;
        /**
         * @param observer 要移除的观察者，null 时忽略。
         * @returns 无返回值。
         */
        removeObserver(observer: MqttObserver | null): void;
    }
}

/**
 * Java 8 函数接口，NativeScript 基础声明未包含此接口。
 */
declare namespace java.util.function {
    class Consumer<T> extends java.lang.Object {
        /**
         * @param implementation 消费者实现，accept 接收一个值且无返回值。
         */
        constructor(implementation: { accept(value: T): void });
        /**
         * @param value 要消费的值。
         * @returns 无返回值。
         */
        accept(value: T): void;
    }
}

/**
 * Paho MQTT 异步令牌的常用只读接口。
 */
declare namespace org.eclipse.paho.client.mqttv3 {
    class IMqttToken extends java.lang.Object {
        private constructor();
        /**
         * @returns 操作是否已完成。
         */
        isComplete(): boolean;
        /**
         * @returns Broker 授予的 QoS 数组，128 表示订阅被拒绝。
         */
        getGrantedQos(): native.Array<number>;
    }
}
