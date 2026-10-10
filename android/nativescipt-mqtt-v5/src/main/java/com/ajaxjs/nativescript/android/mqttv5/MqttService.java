package com.ajaxjs.nativescript.android.mqttv5;

import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import org.eclipse.paho.mqttv5.client.MqttActionListener;
import org.eclipse.paho.mqttv5.client.IMqttToken;
import org.eclipse.paho.mqttv5.client.MqttAsyncClient;
import org.eclipse.paho.mqttv5.client.MqttCallback;
import org.eclipse.paho.mqttv5.client.MqttConnectionOptions;
import org.eclipse.paho.mqttv5.common.MqttException;
import org.eclipse.paho.mqttv5.client.MqttDisconnectResponse;
import org.eclipse.paho.mqttv5.client.MqttClientException;
import org.eclipse.paho.mqttv5.common.packet.MqttProperties;
import org.eclipse.paho.mqttv5.common.MqttMessage;
import org.eclipse.paho.mqttv5.common.util.MqttTopicValidator;
import org.eclipse.paho.mqttv5.client.persist.MqttDefaultFilePersistence;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * 基于 Paho 异步客户端的 MQTT 后台服务。
 * 所有连接和主题状态变更均由单线程 worker 串行处理，业务回调切回主线程。
 */
public class MqttService extends Service implements Constant {
    /**
     * 用于处理 MQTT 操作的单线程执行器。
     * 希望所有操作串行化，降低连接、重连、订阅、发布、关闭之间的竞态
     */
    private final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor();

    /**
     * 主线程的 Handler，用于在主线程中更新 UI。
     */
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    /**
     * The state of current MQTT
     */
    private State state = State.STOPPED;
    private boolean everConnected;

    /**
     * Configuration for MQTT client instance
     */
    private MqttConfig config;

    /**
     * Paho MQTT client instance
     */
    private volatile MqttAsyncClient client;

    /**
     * Service 进入销毁流程后，不再连接或安排重试任务。
     */
    private volatile boolean destroyed;

    /**
     * 每个主题的期望 QoS 和订阅状态；所有访问都在 worker 中完成。
     */
    private final Map<String, TopicInfo> topics = new HashMap<>();

    /**
     * 精确主题对应的一次性消息回调；与 topics 一样只允许 worker 访问。
     */
    private final Map<String, Consumer<MqttReceivedMessage>> onceSubscriptions = new HashMap<>();

    /**
     * 根据内存中的期望状态，在连接建立后恢复订阅或取消订阅操作。
     */
    private void restoreSubscriptions() {
        if (client == null || !client.isConnected())
            return;

        for (Map.Entry<String, TopicInfo> entry : topics.entrySet()) {
            TopicInfo info = entry.getValue();

            if (info.isDesired())
                subscribeOnBroker(entry.getKey(), null);
            else
                unsubscribeOnBroker(entry.getKey(), null);
        }
    }

    /**
     * 暴露当前服务实例的本地 Binder。
     */
    private final MqttBinder binder = new MqttBinder();

    /**
     * 返回供进程内调用方访问服务的 Binder。
     * @param intent 绑定服务的 Intent
     * @return 当前服务的 Binder
     */
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    /**
     * Creates MQTT client instance and connects to server
     *
     * @param config Configuration for MQTT client instance
     */
    public void start(MqttConfig config) {
        try {
            if (config == null) {
                Log.e(TAG, "config cannot be null");
                throw new IllegalArgumentException("config cannot be null");
            }

            worker.execute(() -> {
                if (destroyed)
                    return;

                if (client != null) {
                    Log.w(TAG, "MQTT client has already been created");
                    return;
                }

                this.config = config;
                File dir = new File(getFilesDir(), "ajaxjs-mqtt-v5");

                try {
                    client = new MqttAsyncClient(config.getServerUri(), config.getClientId(), new MqttDefaultFilePersistence(dir.getAbsolutePath()));
                    client.setCallback(new MqttCallback() {
                        @Override
                        public void connectComplete(boolean reconnect, String serverURI) {
                            execute(() -> {
                                Log.i(TAG, "MQTT connected, reconnect=" + reconnect);
                                state = State.CONNECTED;
                                everConnected = true;
                                restoreSubscriptions();
                                notifyObservers(observer -> observer.onConnected(reconnect));

                                if (connectSuccess != null) {
                                    postBusinessCallback(connectSuccess);
                                    connectSuccess = null;
        /*
         * run it once
         */
                                }

                            });
                        }

                        @Override
                        public void disconnected(MqttDisconnectResponse response) {
                            Throwable cause = response.getException() != null ? response.getException()
                                    : new MqttException(response.getReturnCode());
                            execute(() -> {
                                Log.w(TAG, "MQTT connection lost", cause);
                                state = State.DISCONNECTED;

                                for (TopicInfo info : topics.values()) {
                                    if (info.isDesired())
                                        info.setSubscribed(false);
                                }

                                notifyObservers(observer -> observer.onConnectionLost(cause));
                            });
                        }

                        @Override
                        public void messageArrived(String topic, MqttMessage message) {
                            String payload = new String(message.getPayload().clone(), StandardCharsets.UTF_8);
                            int qos = message.getQos();
                            boolean retained = message.isRetained();
                            execute(() -> handleMessage(topic, payload, qos, retained));
                        }

                        @Override
                        public void deliveryComplete(IMqttToken token) {
                        }

                        @Override
                        public void mqttErrorOccurred(MqttException error) {
                            Log.e(TAG, "MQTT protocol error", error);
                        }

                        @Override
                        public void authPacketArrived(int reasonCode, MqttProperties properties) {
                            /*
                             * 此组件使用用户名密码认证，未实现增强认证交换。
                             */
                        }
                    });

                    startWatchdog();
                    connect();
                    Log.i(TAG, "Created MQTT Client.");
                } catch (MqttException error) {
                    state = State.DISCONNECTED;
                    Log.e(TAG, "Failed to create MQTT client", error);
                    startWatchdog();
                    notifyObservers(observer -> observer.onConnectionLost(error));
                }
            });
        } catch (RejectedExecutionException ignored) {
            /*
             * Service 正在销毁，不再创建 MQTT 客户端。
             */
        }
    }

    /**
     * watchdog 周期任务；启用时由它代替 Paho 自动重连。
     */
    private ScheduledFuture<?> watchDogFuture;

    /**
     * 启动唯一的周期 watchdog；任务运行期间始终保留其 Future。
     */
    private void startWatchdog() {
        if (destroyed || (watchDogFuture != null && !watchDogFuture.isDone()))
            return;

        try {
            watchDogFuture = worker.scheduleWithFixedDelay(() -> {
                if (destroyed || (everConnected && !config.isWatchDog()))
                    return;

                if (client == null)
                    start(config);
                else if (!client.isConnected())
                    connect();
            }, 0, WATCHDOG_INTERVAL_SECONDS, TimeUnit.SECONDS);
        } catch (RejectedExecutionException ignored) {
            /*
             * Service 正在销毁，不再启动 watchdog。
             */
        }
    }

    /**
     * 使用当前配置发起一次异步 MQTT 连接。
     */
    private void connect() {
        if (destroyed || client == null || client.isConnected() || state == State.CONNECTING)
            return;

        state = State.CONNECTING;
        MqttConnectionOptions options = new MqttConnectionOptions();
        options.setCleanStart(config.isCleanStart());
        options.setSessionExpiryInterval(config.getSessionExpirySeconds());
        /*
         * watchdog 和 Paho 自动重连互斥，避免同时发起连接。
         */
        options.setAutomaticReconnect(!config.isWatchDog());
        options.setConnectionTimeout(config.getConnectionTimeoutSeconds());
        options.setKeepAliveInterval(config.getKeepAliveSeconds());

        if (config.getUsername() != null)
            options.setUserName(config.getUsername());

        char[] password = config.getPassword();
        if (password != null)
            options.setPassword(new String(password).getBytes(StandardCharsets.UTF_8));

        try {
            client.connect(options, null, new MqttActionListener() {
                @Override
                public void onSuccess(IMqttToken token) {
                    /*
                     * 状态和订阅恢复统一在 connectComplete() 中处理。
                     */
                }

                @Override
                public void onFailure(IMqttToken token, Throwable error) {
                    execute(() -> {
                        Log.e(TAG, "MQTT connect failed", error);
                        state = State.DISCONNECTED;
                        notifyObservers(observer -> observer.onConnectionLost(error));
                        startWatchdog();
                    });
                }
            });
        } catch (MqttException error) {
            Log.e(TAG, "MQTT connect failed", error);
            state = State.DISCONNECTED;
            notifyObservers(observer -> observer.onConnectionLost(error));
            startWatchdog();
        }
    }

    /**
     * MQTT 连接服务器成功地回调
     */
    private volatile Runnable connectSuccess;

    /**
     * MQTT 断开时立即触发一次 Paho 重连尝试。
     * 已连接或正在连接时不重复操作；状态和订阅恢复仍由 Paho 回调统一处理。
     *
     * @param connectSuccess 重连成功后在主线程执行的回调，可为 {@code null}
     */
    public void reconnect(Runnable connectSuccess) {
        execute(() -> {
            MqttAsyncClient current = client;

            if (current == null) {
                Log.w(TAG, "MQTT client has not been created");
                return;
            }

            if (current.isConnected() || state == State.CONNECTING) {
                Log.i(TAG, "MQTT reconnect ignored: client is connected or connecting");
                return;
            }

            this.connectSuccess = connectSuccess;
            try {
                current.reconnect();
                Log.i(TAG, "MQTT manual reconnect requested");
            } catch (MqttException error) {
                if (error.getReasonCode() == MqttClientException.REASON_CODE_CLIENT_CONNECTED || error.getReasonCode() == MqttClientException.REASON_CODE_CONNECT_IN_PROGRESS) {
                    Log.i(TAG, "MQTT manual reconnect ignored: Paho is connected or connecting");
                    return;
                }

                Log.e(TAG, "MQTT manual reconnect failed", error);
                notifyObservers(observer -> observer.onConnectionLost(error));
            }
        });
    }

    /**
     * 取消并清空当前 watchdog 周期任务。
     */
    private void stopWatchdog() {
        if (watchDogFuture == null)
            return;

        watchDogFuture.cancel(false);
        watchDogFuture = null;
    }

    /**
     * 将主题状态操作串行提交到 worker。
     */
    private void execute(Runnable command) {
        if (destroyed)
            return;

        try {
            worker.execute(() -> {
                if (!destroyed)
                command.run();
            });
        } catch (RejectedExecutionException ignored) {
            /*
             * Service 正在销毁，不再处理主题状态。
             */
        }
    }

    /**
     * 订阅主题，不接收 SUBACK 业务回调。
     * @param topic MQTT 主题过滤器
     * @param qos 服务质量等级（0～2）
     */
    public void subscribe(String topic, int qos) {
        subscribe(topic, qos, null);
    }

    /**
     * 订阅主题。
     * @param topic MQTT 主题过滤器
     * @param qos 服务质量等级（0～2）
     * @param callback SUBACK 成功回调，可为 {@code null}
     */
    public void subscribe(String topic, int qos, Consumer<IMqttToken> callback) {
        validateTopic(topic, true);
        validateQos(qos);

        execute(() -> {
            /*
             * 普通订阅覆盖尚未消费的一次性订阅。
             */
            onceSubscriptions.remove(topic);
            subscribeInternal(topic, qos, callback);
        });
    }

    /**
     * 订阅精确主题，并且只消费收到的第一条消息。
     * @param topic 不含通配符的精确主题
     * @param qos 服务质量等级（0～2）
     * @param callback 首条消息回调，不可为 {@code null}
     */
    public void subscribeOnce(String topic, int qos, Consumer<MqttReceivedMessage> callback) {
        validateTopic(topic, false);
        validateQos(qos);

        if (callback == null)
            throw new IllegalArgumentException("callback cannot be null");

        execute(() -> {
            TopicInfo info = topics.get(topic);

            if (onceSubscriptions.containsKey(topic)) {
                Log.w(TAG, "MQTT one-time subscription already exists: " + topic);
                return;
            }

            if (info != null && info.isDesired()) {
                Log.w(TAG, "MQTT topic is already used by a normal subscription: " + topic);
                return;
            }

            onceSubscriptions.put(topic, callback);
            subscribeInternal(topic, qos, null);
        });
    }

    /**
     * 在 worker 中记录期望订阅，并在 MQTT 已连接时提交给 Broker。
     * @param topic MQTT 主题过滤器
     * @param qos 服务质量等级
     * @param callback SUBACK 成功回调，可为 {@code null}
     */
    private void subscribeInternal(String topic, int qos, Consumer<IMqttToken> callback) {
        Log.i(TAG, "MQTT subscribe：" + topic);
        TopicInfo info = topics.get(topic);

        if (info == null) {
            info = new TopicInfo(qos, true, false);
            topics.put(topic, info);
        } else if (info.isDesired() && info.isSubscribed() && info.getQos() == qos) {
            Log.w(TAG, "MQTT topic is already subscribed: " + topic + ", qos=" + qos);
            return;
        } else {
            info.setQos(qos);
            info.setDesired(true);
        }

        if (client == null || !client.isConnected()) {
            info.setSubscribed(false);
            Log.i(TAG, "MQTT client is not connected, subscription saved: " + topic);
            return;
        }

        subscribeOnBroker(topic, callback);
    }

    /**
     * 串行处理收到的消息，保证一次性回调最多只会被取出一次。
     * @param topic 消息主题
     * @param payload UTF-8 消息正文
     * @param qos 消息服务质量等级
     * @param retained 是否为保留消息
     */
    private void handleMessage(String topic, String payload, int qos, boolean retained) {
        Consumer<MqttReceivedMessage> onceCallback = onceSubscriptions.remove(topic);

        if (onceCallback != null) {
            unsubscribeInternal(topic, null);
            MqttReceivedMessage message = new MqttReceivedMessage(topic, payload, qos, retained);
            postBusinessCallback(() -> onceCallback.accept(message));
        }

        notifyObservers(observer -> observer.onMessage(topic, payload, qos, retained));
    }

    /**
     * 根据 TopicInfo 向 Broker 提交订阅。
     * @param topic MQTT 主题过滤器
     * @param callback SUBACK 成功回调，可为 {@code null}
     */
    private void subscribeOnBroker(String topic, Consumer<IMqttToken> callback) {
        TopicInfo info = topics.get(topic);
        if (info == null || !info.isDesired() || info.isSubscribed())
            return;

        if (client == null || !client.isConnected()) {
            info.setSubscribed(false);
            return;
        }

        int requestedQos = info.getQos();
        info.setSubscribed(true);
        /*
         * 在 SUBACK 返回前先标记为已提交，避免相同主题被重复订阅。
         */

        try {
            client.subscribe(topic, requestedQos, null, new MqttActionListener() {
                @Override
                public void onSuccess(IMqttToken token) {
                    execute(() -> handleSubscribeSuccess(topic, requestedQos, token, callback));
                }

                @Override
                public void onFailure(IMqttToken token, Throwable error) {
                    execute(() -> {
                        Log.e(TAG, "Subscribe failed: " + topic, error);

                        TopicInfo current = topics.get(topic);
                        if (current != null)
                            current.setSubscribed(false);

                        notifyObservers(observer -> observer.onSubscribed(topic, error));
                    });
                }
            });
        } catch (MqttException error) {
            info.setSubscribed(false);
            Log.e(TAG, "Subscribe failed: " + topic, error);
            notifyObservers(observer -> observer.onSubscribed(topic, error));
        }
    }

    /**
     * 串行处理 SUBACK，并协调订阅期间发生的 QoS 或期望状态变化。
     * @param topic MQTT 主题过滤器
     * @param requestedQos 本次请求使用的 QoS
     * @param token Paho 异步操作令牌
     * @param callback 业务成功回调，可为 {@code null}
     */
    private void handleSubscribeSuccess(String topic, int requestedQos, IMqttToken token, Consumer<IMqttToken> callback) {
        TopicInfo info = topics.get(topic);
        if (info == null)
            return;

        try {
            MqttAcknowledgement.requireSuccess(token.getReasonCodes());
        } catch (MqttException error) {
            info.setSubscribed(false);
            notifyObservers(observer -> observer.onSubscribed(topic, error));
            return;
        }

        Log.i(TAG, "Subscribed: " + topic + ", qos=" + requestedQos);

        if (client == null || !client.isConnected()) {
            info.setSubscribed(false);
            return;
        }

        /*
         * 取消订阅操作已经提交，这里不重复提交。
         */
        if (!info.isDesired())
            return;

        if (info.getQos() != requestedQos) {
            info.setSubscribed(false);
            subscribeOnBroker(topic, null);
            return;
        }

        if (callback != null)
            postBusinessCallback(() -> callback.accept(token));

        notifyObservers(observer -> observer.onSubscribed(topic, null));
    }

    /**
     * 取消订阅
     *
     * @param topic 主题
     * @param callback UNSUBACK 成功回调，可为 {@code null}
     */
    public void unsubscribe(String topic, Consumer<IMqttToken> callback) {
        validateTopic(topic, true);
        execute(() -> unsubscribeInternal(topic, callback));
    }

    /**
     * 在 worker 中记录取消订阅意图，并在已连接时提交给 Broker。
     * @param topic MQTT 主题过滤器
     * @param callback UNSUBACK 成功回调，可为 {@code null}
     */
    private void unsubscribeInternal(String topic, Consumer<IMqttToken> callback) {
        Log.i(TAG, "MQTT unsubscribe：" + topic);
        onceSubscriptions.remove(topic);
        TopicInfo info = topics.get(topic);

        if (info == null) {
            info = new TopicInfo(0, false, false);
            topics.put(topic, info);
        } else {
            info.setDesired(false);
            info.setSubscribed(false);
        }

        if (client == null || !client.isConnected()) {
            Log.i(TAG, "MQTT client is not connected, unsubscription saved: " + topic);
            return;
        }

        unsubscribeOnBroker(topic, callback);
    }

    /**
     * 根据 TopicInfo 向 Broker 提交取消订阅。
     * @param topic MQTT 主题过滤器
     * @param callback UNSUBACK 成功回调，可为 {@code null}
     */
    private void unsubscribeOnBroker(String topic, Consumer<IMqttToken> callback) {
        TopicInfo info = topics.get(topic);

        if (info == null || info.isDesired())
            return;

        MqttAsyncClient current = client;

        if (current == null || !current.isConnected())
            return;

        try {
            current.unsubscribe(topic, null, new MqttActionListener() {
                @Override
                public void onSuccess(IMqttToken token) {
                    execute(() -> handleUnsubscribeSuccess(topic, token, callback));
                }

                @Override
                public void onFailure(IMqttToken asyncActionToken, Throwable error) {
                    execute(() -> Log.e(TAG, "Unsubscribe failed: " + topic, error));
                }
            });
        } catch (MqttException e) {
            Log.e(TAG, "MQTT 取消订阅失败：" + topic, e);
        }
    }

    /**
     * 串行处理 UNSUBACK，并协调取消期间重新订阅的情况。
     * @param topic MQTT 主题过滤器
     * @param token Paho 异步操作令牌
     * @param callback 业务成功回调，可为 {@code null}
     */
    private void handleUnsubscribeSuccess(String topic, IMqttToken token, Consumer<IMqttToken> callback) {
        TopicInfo info = topics.get(topic);

        if (info == null)
            return;

        if (info.isDesired()) {
            /*
             * 取消期间又重新订阅时，subscribeInternal() 已经提交了最新订阅。
             */
            if (!info.isSubscribed())
                subscribeOnBroker(topic, null);

            return;
        }

        topics.remove(topic);
        Log.i(TAG, "Unsubscribed finally:::: " + topic);

        if (callback != null)
            postBusinessCallback(() -> callback.accept(token));
    }

    /**
     * 发布 MQTT 消息
     *
     * @param topic    主题
     * @param message  消息内容
     * @param qos      服务质量 0, 1, 2
     * @param retained 是否保留
     */
    public void publish(String topic, String message, int qos, boolean retained) {
        validateTopic(topic, false);
        validateQos(qos);

        if (message == null)
            throw new IllegalArgumentException("message cannot be null");

        execute(() -> {
            Log.i(TAG, "MQTT publish: " + topic);
            MqttAsyncClient current = client;

            if (current == null || !current.isConnected()) {
                IllegalStateException error = new IllegalStateException("MQTT client is not connected");
                Log.w(TAG, Objects.requireNonNull(error.getMessage()));
                notifyObservers(observer -> observer.onPublished(topic, error));

                return;
            }

            try {
                current.publish(topic, message.getBytes(StandardCharsets.UTF_8), qos, retained, null, new MqttActionListener() {
                    @Override
                    public void onSuccess(IMqttToken token) {
                        try {
                            MqttAcknowledgement.requireSuccess(token.getReasonCodes());
                            notifyObservers(observer -> observer.onPublished(topic, null));
                        } catch (MqttException error) {
                            notifyObservers(observer -> observer.onPublished(topic, error));
                        }
                    }

                    @Override
                    public void onFailure(IMqttToken token, Throwable error) {
                        notifyObservers(observer -> observer.onPublished(topic, error));
                    }
                });
            } catch (MqttException error) {
                Log.e(TAG, "MQTT publish failed: " + topic, error);
                notifyObservers(observer -> observer.onPublished(topic, error));
            }
        });
    }

    /**
     * 校验主题格式。
     * @param topic 待校验主题
     * @param wildcardAllowed 是否允许主题通配符
     * @throws IllegalArgumentException 主题为空或格式非法时抛出
     */
    private static void validateTopic(String topic, boolean wildcardAllowed) {
        if (topic == null || topic.trim().isEmpty())
            throw new IllegalArgumentException("topic cannot be empty");

        MqttTopicValidator.validate(topic, wildcardAllowed, wildcardAllowed);
    }

    /**
     * 校验 MQTT QoS。
     * @param qos 待校验的服务质量等级
     * @throws IllegalArgumentException qos 不在 0～2 范围时抛出
     */
    private static void validateQos(int qos) {
        if (qos < 0 || qos > 2)
            throw new IllegalArgumentException("QoS must be 0, 1 or 2");
    }

    /**
     * 标记服务销毁并安排释放 MQTT 客户端及工作线程。
     */
    @Override
    public void onDestroy() {
        shutdown();
        super.onDestroy();
    }

    /**
     * 停止连接并异步释放资源；允许重复调用。
     */
    public synchronized void shutdown() {
        if (destroyed)
                return;
        destroyed = true;

        try {
            worker.execute(this::releaseResources);
        } catch (RejectedExecutionException ignored) {
            releaseResources();
        }

    }

    /**
     * 关闭 Paho 客户端和工作线程；可在 worker 或销毁线程中安全调用。
     */
    private void releaseResources() {
        stopWatchdog();

        MqttAsyncClient current = client;
        client = null;

        if (current != null) {
            try {
                if (current.isConnected())
                    current.disconnectForcibly(1000L, 1000L, false);
            } catch (Exception error) {
                Log.w(TAG, "MQTT disconnect failed", error);
            }

            try {
                current.close(true);
            } catch (Exception error) {
                Log.w(TAG, "MQTT close failed", error);
            }
        }

        worker.shutdownNow();
        topics.clear();
        onceSubscriptions.clear();
        observers.clear();
        state = State.STOPPED;
    }

    /**
     * 供进程内绑定方取得服务实例的 Binder。
     */
    public final class MqttBinder extends Binder {
        /**
         * @return 当前 MQTT 服务实例
         */
        public MqttService getService() {
            return MqttService.this;
        }
    }

    /**
     * 可在多线程环境安全增删的业务观察者集合。
     */
    private final CopyOnWriteArraySet<MqttObserver> observers = new CopyOnWriteArraySet<>();

    /**
     * 注册观察者；重复注册同一个实例不会收到重复通知。
     * @param observer 要注册的观察者
     */
    public void addObserver(MqttObserver observer) {
        if (observer == null)
            throw new IllegalArgumentException("observer cannot be null");

        observers.add(observer);
    }

    /**
     * 移除观察者。
     * @param observer 要移除的观察者；为 {@code null} 时忽略
     */
    public void removeObserver(MqttObserver observer) {
        if (observer != null)
            observers.remove(observer);
    }

    /**
     * 在主线程依次通知观察者，并隔离单个观察者抛出的异常。
     * @param action 要对每个观察者执行的通知动作
     */
    private void notifyObservers(Consumer<MqttObserver> action) {
        mainHandler.post(() -> {
            if (destroyed)
                return;
            for (MqttObserver observer : observers) {
                try {
                    action.accept(observer);
                } catch (Throwable callbackError) {
                    Log.e(TAG, "MQTT business callback failed", callbackError);
                }
            }
        });
    }

    /**
     * 在主线程执行并隔离业务回调异常。
     * @param callback 要执行的业务回调
     */
    private void postBusinessCallback(Runnable callback) {
        mainHandler.post(() -> {
            if (destroyed)
                return;
            try {
                callback.run();
            } catch (Throwable callbackError) {
                Log.e(TAG, "MQTT business callback failed", callbackError);
            }
        });
    }
}
