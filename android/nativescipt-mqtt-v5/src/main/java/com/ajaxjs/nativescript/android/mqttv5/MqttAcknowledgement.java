package com.ajaxjs.nativescript.android.mqttv5;

import org.eclipse.paho.mqttv5.common.MqttException;

/**
 * MQTT 5 确认包原因码校验，避免将 Broker 拒绝误报为成功。
 */
final class MqttAcknowledgement {
    private MqttAcknowledgement() {
    }

    /**
     * @param reasonCodes 确认包原因码；无原因码时不额外处理
     * @throws MqttException 任意原因码大于等于 128 时抛出，保留原始原因码
     */
    static void requireSuccess(int[] reasonCodes) throws MqttException {
        if (reasonCodes == null)
            return;
        for (int code : reasonCodes) {
            if (code >= 128)
                throw new MqttException(code);
        }
    }
}
