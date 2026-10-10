package com.ajaxjs.nativescript.android.mqttv3;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import org.eclipse.paho.client.mqttv3.IMqttToken;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

/**
 * MQTT 服务的进程内单例入口，负责服务绑定、订阅转发和观察者管理。
 */
public final class MqttManager implements Constant {
    /**
     * 单例
     */
    private static volatile MqttManager INSTANCE;

    /**
     * 获取 MQTT 管理器
     *
     * @return MQTT 管理器
     */
    public static MqttManager getInstance() {
        if (INSTANCE == null) {
            synchronized (MqttManager.class) {
                if (INSTANCE == null)
                    INSTANCE = new MqttManager();
            }
        }

        return INSTANCE;
    }

    /**
     * 保护服务绑定状态及 Binder 引用的锁。
     */
    private final Object serviceLock = new Object();

    /**
     * 是否已成功发起服务绑定。
     */
    private boolean started;

    /**
     * 启动服务时使用的 MQTT 配置。
     */
    private MqttConfig config;

    /**
     * 已绑定服务提供的本地 Binder。
     */
    private MqttService.MqttBinder binder;

    /**
     * Manager 持有观察者，使观察者可以在 Service 绑定完成前注册。
     */
    private final CopyOnWriteArraySet<MqttObserver> observers = new CopyOnWriteArraySet<>();

    /**
     * Just like a callback for service connection.
     * 绑定关系的回调凭证，用于 Manager 在绑定和解绑时都需要使用同一个对象
     */
    private Context bindingContext;
    private ServiceConnection serviceConnection;

    private ServiceConnection createConnection() {
        return new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder iBinder) {
            synchronized (serviceLock) {
                if (!started || serviceConnection != this)
                    return;

                binder = (MqttService.MqttBinder) iBinder;
                MqttService service = binder.getService();

                /*
                 * 必须先注册观察者再启动连接，避免遗漏首次连接事件。
                 */
                for (MqttObserver observer : observers)
                    service.addObserver(observer);

                if (!preSubTopics.isEmpty()) {
                    for (String topic : preSubTopics)
                        service.subscribe(topic, 1, null);
                }

                service.start(config);
            }

            Log.i(TAG, "MQTT Service bound");
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            synchronized (serviceLock) {
                if (serviceConnection != this) return;
                binder = null;
            }

            Log.w(TAG, "MQTT Service disconnected");
        }
        };
    }

    /**
     * 绑定并启动 MQTT Service。重复调用不会重复绑定。
     *
     * @param context Android 上下文，内部使用 Application Context
     * @param config MQTT 连接配置
     * @throws IllegalArgumentException context 或 config 为 {@code null} 时抛出
     */
    public void start(Context context, MqttConfig config) {
        requireMainThread();
        if (context == null)
            throw new IllegalArgumentException("context cannot be null");

        if (config == null)
            throw new IllegalArgumentException("config cannot be null");

        synchronized (serviceLock) {
            if (started)
                return;

            this.config = config;
            Context ctx = context.getApplicationContext();
            bindingContext = ctx;
            serviceConnection = createConnection();
            Intent intent = new Intent(ctx, MqttService.class);
            started = ctx.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);

            if (!started) {
                this.config = null;
                bindingContext = null;
                serviceConnection = null;
                throw new IllegalStateException("Unable to bind MQTT Service; register MqttService in the host manifest.");
            }
        }
    }

    /**
     * 服务绑定前登记、绑定完成后自动订阅的主题集合。
     */
    private final Set<String> preSubTopics = new HashSet<>();

    /**
     * @param topic 服务连接后需要自动订阅的主题
     */
    public void preSubscribe(String topic) {
        org.eclipse.paho.client.mqttv3.MqttTopic.validate(topic, true);
        synchronized (serviceLock) {
            preSubTopics.add(topic);
            if (binder != null) binder.getService().subscribe(topic, 1, null);
        }
    }

    /**
     * 订阅主题。
     * @param topic MQTT 主题过滤器
     * @param qos 服务质量等级（0～2）
     * @param callback 代理确认后的回调，可为 {@code null}
     */
    public void subscribe(String topic, int qos, Consumer<IMqttToken> callback) {
        requireService().subscribe(topic, qos, callback);
    }

    /**
     * @param topic 使用 QoS 1 订阅的主题
     */
    public void subscribe(String topic) {
        subscribe(topic, 1, null);
    }

    /**
     * 订阅精确主题，并且只消费收到的第一条消息。
     *
     * @param topic 不含通配符的精确主题
     * @param qos 服务质量等级（0～2）
     * @param callback 首条消息回调
     */
    public void subscribeOnce(String topic, int qos, Consumer<MqttReceivedMessage> callback) {
        requireService().subscribeOnce(topic, qos, callback);
    }

    /**
     * 使用 QoS 1 创建一次性订阅。
     * @param topic 不含通配符的精确主题
     * @param callback 首条消息回调
     */
    public void subscribeOnce(String topic, Consumer<MqttReceivedMessage> callback) {
        subscribeOnce(topic, 1, callback);
    }

    /**
     * 取消订阅。
     * @param topic MQTT 主题过滤器
     * @param callback 代理确认后的回调，可为 {@code null}
     */
    public void unsubscribe(String topic, Consumer<IMqttToken> callback) {
        requireService().unsubscribe(topic, callback);
    }

    /**
     * 发布 MQTT 消息
     *
     * @param topic   主题
     * @param message 消息内容
     * @param qos 服务质量等级（0～2）
     * @param retained 是否由代理保留为主题最后一条消息
     */
    public void publish(String topic, String message, int qos, boolean retained) {
        requireService().publish(topic, message, qos, retained);
    }

    /**
     * 使用 QoS 1 发布非保留消息。
     * @param topic MQTT 主题
     * @param message 消息正文
     */
    public void publish(String topic, String message) {
        publish(topic, message, 1, false);
    }

    /**
     * MQTT 断开时立即触发一次重连尝试。
     */
    public void reconnect() {
        requireService().reconnect(null);
    }

    /**
     * 立即重连，并在连接成功后执行回调。
     * @param callback 连接成功回调
     */
    public void reconnect(AfterConnectedMqtt callback) {
        requireService().reconnect(callback == null ? null : callback::callback);
    }

    /**
     * @param observer 要注册的 MQTT 状态与消息观察者
     */
    public void addObserver(MqttObserver observer) {
        if (observer == null)
            throw new IllegalArgumentException("observer cannot be null");

        synchronized (serviceLock) {
            observers.add(observer);

            if (binder != null)
                binder.getService().addObserver(observer);
        }
    }

    /**
     * @param observer 要移除的观察者；为 {@code null} 时忽略
     */
    public void removeObserver(MqttObserver observer) {
        if (observer == null)
            return;

        synchronized (serviceLock) {
            observers.remove(observer);

            if (binder != null)
                binder.getService().removeObserver(observer);
        }
    }

    /**
     * 获取已经绑定的 Service；未就绪时给出明确错误，而不是产生空指针异常。
     *
     * @return 已绑定的 MQTT 服务
     * @throws IllegalStateException 服务尚未绑定完成时抛出
     */
    /**
     * 停止 MQTT 并解绑服务；清除观察者和预订阅，允许随后重新启动。
     * 必须在 Android 主线程调用。
     */
    public void stop() {
        requireMainThread();
        synchronized (serviceLock) {
            if (binder != null) binder.getService().shutdown();
            boolean wasStarted = started;
            Context context = bindingContext;
            ServiceConnection connection = serviceConnection;
            started = false;
            binder = null;
            bindingContext = null;
            serviceConnection = null;
            config = null;
            preSubTopics.clear();
            observers.clear();
            if (wasStarted && context != null && connection != null) context.unbindService(connection);
        }
    }

    private static void requireMainThread() {
        if (Looper.myLooper() != Looper.getMainLooper())
            throw new IllegalStateException("MQTT start/stop must be called on the Android main thread.");
    }

    private MqttService requireService() {
        synchronized (serviceLock) {
            if (binder == null)
                throw new IllegalStateException("MQTT Service is not ready");

            return binder.getService();
        }
    }
}
