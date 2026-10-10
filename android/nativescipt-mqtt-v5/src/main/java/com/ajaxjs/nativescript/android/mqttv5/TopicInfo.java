package com.ajaxjs.nativescript.android.mqttv5;

/**
 * 保存单个主题的期望 QoS、是否期望订阅以及当前连接是否已提交订阅。
 */
final class TopicInfo {
    /**
     * 期望使用的 QoS。
     */
    private int qos;
    /**
     * 业务侧当前是否仍期望订阅此主题。
     */
    private boolean desired;
    /**
     * 当前 MQTT 连接是否已经向 Broker 提交订阅。
     */
    private boolean subscribed;

    /**
     * 创建主题状态。
     *
     * @param qos        期望 QoS
     * @param desired    是否期望订阅
     * @param subscribed 当前连接是否已订阅
     */
    TopicInfo(int qos, boolean desired, boolean subscribed) {
        this.qos = qos;
        this.desired = desired;
        this.subscribed = subscribed;
    }

    /**
     * @return 期望 QoS
     */
    int getQos() {
        return qos;
    }

    /**
     * @param qos 期望 QoS
     */
    void setQos(int qos) {
        this.qos = qos;
    }

    /**
     * @return 是否期望订阅
     */
    boolean isDesired() {
        return desired;
    }

    /**
     * @param desired 是否期望订阅
     */
    void setDesired(boolean desired) {
        this.desired = desired;
    }

    /**
     * @return 当前连接是否已订阅
     */
    boolean isSubscribed() {
        return subscribed;
    }

    /**
     * @param subscribed 当前连接是否已订阅
     */
    void setSubscribed(boolean subscribed) {
        this.subscribed = subscribed;
    }
}
