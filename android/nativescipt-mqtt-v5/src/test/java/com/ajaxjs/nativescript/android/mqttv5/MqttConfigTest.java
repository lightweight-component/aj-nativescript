package com.ajaxjs.nativescript.android.mqttv5;

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
    void sessionExpirySupportsUnsigned32BitRange() {
        MqttConfig.Builder builder = MqttConfig.builder().serverUri("tcp://localhost:1883").clientId("test");
        assertEquals(0L, builder.sessionExpirySeconds(0).cleanStart(true).build().getSessionExpirySeconds());
        assertTrue(builder.build().isCleanStart());
        assertEquals(4294967295L, builder.sessionExpirySeconds(4294967295L).build().getSessionExpirySeconds());
        assertThrows(IllegalArgumentException.class, () -> builder.sessionExpirySeconds(-1).build());
        assertThrows(IllegalArgumentException.class, () -> builder.sessionExpirySeconds(4294967296L).build());
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
        assertFalse(config.isCleanStart());
        assertEquals(86400L, config.getSessionExpirySeconds());
        MqttReceivedMessage message = new MqttReceivedMessage("test", "中文", 2, true);
        assertEquals("中文", message.getPayload());
        assertTrue(message.isRetained());
    }
}
