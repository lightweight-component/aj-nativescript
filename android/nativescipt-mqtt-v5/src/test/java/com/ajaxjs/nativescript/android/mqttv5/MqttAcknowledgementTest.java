package com.ajaxjs.nativescript.android.mqttv5;

import org.junit.jupiter.api.Test;
import org.eclipse.paho.mqttv5.common.MqttException;
import static org.junit.jupiter.api.Assertions.*;

class MqttAcknowledgementTest {
    @Test
    void acceptsGrantedQosAndNoMatchingSubscribers() {
        assertDoesNotThrow(() -> MqttAcknowledgement.requireSuccess(new int[] {0, 1, 2, 16}));
        assertDoesNotThrow(() -> MqttAcknowledgement.requireSuccess(null));
    }

    @Test
    void rejectsBrokerFailureAndPreservesReason() {
        MqttException error = assertThrows(MqttException.class,
                () -> MqttAcknowledgement.requireSuccess(new int[] {1, 135}));
        assertEquals(135, error.getReasonCode());
    }
}
