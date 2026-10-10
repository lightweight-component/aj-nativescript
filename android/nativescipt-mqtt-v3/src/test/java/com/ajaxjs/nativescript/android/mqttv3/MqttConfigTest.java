package com.ajaxjs.nativescript.android.mqttv3;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MqttConfigTest {
    @Test
    void validatesRequiredFieldsAndTiming() {
        assertThrows(IllegalArgumentException.class, () -> MqttConfig.builder().build());
        assertThrows(IllegalArgumentException.class, () -> MqttConfig.builder().serverUri("tcp://localhost:1883").clientId(" ").build());
        assertThrows(IllegalArgumentException.class, () -> MqttConfig.builder().serverUri("tcp://localhost:1883").clientId("test").keepAliveSeconds(0).build());
    }

    @Test
    void passwordCopiesDoNotMutateConfiguration() {
        char[] input = "test-secret".toCharArray();
        MqttConfig.Builder builder = MqttConfig.builder().serverUri("tcp://localhost:1883").clientId("test").password(input);
        input[0] = 'X';
        MqttConfig config = builder.build();
        char[] output = config.getPassword();
        output[0] = 'Y';
        builder.password("replacement");
        assertArrayEquals("test-secret".toCharArray(), config.getPassword());
    }

    @Test
    void defaultsAndMessageSnapshotAreStable() {
        MqttConfig config = MqttConfig.builder().serverUri("tcp://localhost:1883").clientId("test").build();
        assertEquals(10, config.getConnectionTimeoutSeconds());
        assertEquals(60, config.getKeepAliveSeconds());
        assertFalse(config.isWatchDog());
        assertNull(config.getPassword());
        MqttReceivedMessage message = new MqttReceivedMessage("test", "中文", 2, true);
        assertEquals("中文", message.getPayload());
        assertTrue(message.isRetained());
    }
}
