package com.ajaxjs.nativescript.android.mqttv5;

/**
 * MQTT 事件观察者。
 *
 * <p>Java 调用方需要实现所有事件；TS 封装允许只提供需要的回调。</p>
 */
public interface MqttObserver {
    /**
     * MQTT 连接成功。
     *
     * @param reconnect 是否为断线后的重新连接
     */
    void onConnected(boolean reconnect);

    /**
     * MQTT 连接丢失或连接失败。
     *
     * @param error 失败原因
     */
    void onConnectionLost(Throwable error);

    /**
     * 收到订阅消息。
     *
     * @param topic    消息主题
     * @param payload  UTF-8 文本消息
     * @param qos      消息 QoS 等级
     * @param retained 是否为 Broker 保留消息
     */
    void onMessage(String topic, String payload, int qos, boolean retained);

    /**
     * 订阅操作完成，error 为 null 表示订阅成功。
     *
     * @param topic 订阅主题
     * @param error 失败原因，成功时为 {@code null}
     */
    void onSubscribed(String topic, Throwable error);

    /**
     * 发布操作完成，error 为 null 表示发布成功。
     *
     * @param topic 发布主题
     * @param error 失败原因，成功时为 {@code null}
     */
    void onPublished(String topic, Throwable error);
}
