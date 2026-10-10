package com.ajaxjs.nativescript.android.mqttv5;

/**
 * MQTT 接收到的消息快照。
 */
public final class MqttReceivedMessage {
    /**
     * 消息主题。
     */
    private final String topic;
    /**
     * UTF-8 文本消息。
     */
    private final String payload;
    /**
     * 消息 QoS 等级。
     */
    private final int qos;
    /**
     * 是否为 Broker 保留消息。
     */
    private final boolean retained;

    /**
     * 创建不可变的接收消息快照。
     *
     * @param topic    消息主题
     * @param payload  UTF-8 文本消息
     * @param qos      消息 QoS 等级
     * @param retained 是否为 Broker 保留消息
     */
    public MqttReceivedMessage(String topic, String payload, int qos, boolean retained) {
        this.topic = topic;
        this.payload = payload;
        this.qos = qos;
        this.retained = retained;
    }

    /**
     * @return 消息主题
     */
    public String getTopic() {
        return topic;
    }

    /**
     * @return UTF-8 文本消息
     */
    public String getPayload() {
        return payload;
    }

    /**
     * @return 消息 QoS 等级
     */
    public int getQos() {
        return qos;
    }

    /**
     * @return 是否为 Broker 保留消息
     */
    public boolean isRetained() {
        return retained;
    }
}
