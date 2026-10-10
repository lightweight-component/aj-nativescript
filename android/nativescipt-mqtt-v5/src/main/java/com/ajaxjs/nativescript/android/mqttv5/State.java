package com.ajaxjs.nativescript.android.mqttv5;

/**
 * MQTT Engine 的连接状态。
 */
public enum State {
    /**
     * Engine 尚未启动或已经永久关闭。
     */
    STOPPED,

    /**
     * 当前未连接，可能正在等待下一次重连。
     */
    DISCONNECTED,

    /**
     * 正在建立 MQTT 连接。
     */
    CONNECTING,

    /**
     * MQTT 连接已经建立。
     */
    CONNECTED,

    /**
     * Engine 正在断开连接并释放资源。
     */
    DISCONNECTING
}
