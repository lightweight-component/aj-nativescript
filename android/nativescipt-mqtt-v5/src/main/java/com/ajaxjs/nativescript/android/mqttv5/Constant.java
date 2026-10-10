package com.ajaxjs.nativescript.android.mqttv5;

/**
 * MQTT v5 模块共享的日志标签和默认连接参数。
 */
public interface Constant {
    /**
     * Android 日志标签。
     */
    String TAG = "MQTT_V3";

    /**
     * Watchdog 检查连接状态的间隔，单位为秒。
     */
    int WATCHDOG_INTERVAL_SECONDS = 5;

    /**
     * MQTT 超时时间，单位：秒
     */
   int CONNECT_TIMEOUT = 5;

    /**
     * MQTT 心跳时间，单位：秒
     */
   int KEEP_ALIVE_SECONDS = 8;
}
