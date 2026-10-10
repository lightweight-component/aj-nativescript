package com.ajaxjs.nativescript.android.mqttv5;

import org.eclipse.paho.mqttv5.client.*;
import org.eclipse.paho.mqttv5.client.persist.MemoryPersistence;
import org.eclipse.paho.mqttv5.common.*;
import org.eclipse.paho.mqttv5.common.packet.MqttProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 可选真实 Broker 测试；设置 MQTT_TEST_BROKER 后才运行，不依赖 Android 服务。
 */
@EnabledIfEnvironmentVariable(named = "MQTT_TEST_BROKER", matches = ".+")
class MqttBrokerIntegrationTest {
    @Test
    void mqtt5UnicodeRoundTripAndSessionResume() throws Exception {
        String id = "ajaxjs-v5-test-" + System.currentTimeMillis();
        String topic = "ajaxjs/test/v5/" + id;
        String payload = "你好，MQTT 5";
        CountDownLatch received = new CountDownLatch(1);
        AtomicReference<String> actual = new AtomicReference<>();
        MqttAsyncClient client = new MqttAsyncClient(System.getenv("MQTT_TEST_BROKER"), id, new MemoryPersistence());
        client.setCallback(new MqttCallback() {
            public void disconnected(MqttDisconnectResponse response) {
            }
            public void mqttErrorOccurred(MqttException error) {
            }
            public void connectComplete(boolean reconnect, String uri) {
            }
            public void deliveryComplete(IMqttToken token) {
            }
            public void authPacketArrived(int reasonCode, MqttProperties properties) {
            }
            public void messageArrived(String receivedTopic, MqttMessage message) {
                actual.set(new String(message.getPayload(), StandardCharsets.UTF_8));
                received.countDown();
            }
        });
        MqttConnectionOptions options = new MqttConnectionOptions();
        options.setCleanStart(true);
        options.setSessionExpiryInterval(60L);
        options.setConnectionTimeout(10);
        try {
            client.connect(options).waitForCompletion(15000);
            IMqttToken subscription = client.subscribe(topic, 1);
            subscription.waitForCompletion(10000);
            MqttAcknowledgement.requireSuccess(subscription.getReasonCodes());
            IMqttToken publication = client.publish(topic, payload.getBytes(StandardCharsets.UTF_8), 1, false);
            publication.waitForCompletion(10000);
            MqttAcknowledgement.requireSuccess(publication.getReasonCodes());
            assertTrue(received.await(10, TimeUnit.SECONDS), "MQTT 5 message not received");
            assertEquals(payload, actual.get());
            client.disconnect().waitForCompletion(10000);
            options.setCleanStart(false);
            IMqttToken resumed = client.connect(options);
            resumed.waitForCompletion(15000);
            assertTrue(resumed.getSessionPresent(), "Broker did not resume the MQTT 5 session");
            client.unsubscribe(topic).waitForCompletion(10000);
        } finally {
            if (client.isConnected())
                client.disconnect(1000, null, null, 0, sessionDeletion()).waitForCompletion(10000);
            client.close(true);
        }
    }

    /**
     * @return 将测试会话过期时间设为 0 的断线属性，清理 Broker 测试会话
     */
    private static MqttProperties sessionDeletion() {
        MqttProperties properties = new MqttProperties();
        properties.setSessionExpiryInterval(0L);
        return properties;
    }
}
