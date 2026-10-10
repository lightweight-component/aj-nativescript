package com.ajaxjs.nativescript.android.mqttv3;

import java.util.Arrays;

/**
 * 与 Service 和 Paho 类型分离的不可变 MQTT 配置。
 */
public final class MqttConfig {
    /**
     * 完整 Broker URI，例如 {@code tcp://host:1883} 或 {@code ssl://host:8883}。
     */
    private final String serverUri;
    /**
     * MQTT 客户端唯一标识。
     */
    private final String clientId;
    /**
     * Broker 登录用户名，可为空。
     */
    private final String username;
    /**
     * Broker 登录密码的防御性副本，可为空。
     */
    private final char[] password;
    /**
     * 建立连接的超时时间，单位为秒。
     */
    private final int connectionTimeoutSeconds;
    /**
     * MQTT Keep Alive 间隔，单位为秒。
     */
    private final int keepAliveSeconds;
    /**
     * 是否使用 Service 自有 Watchdog 检查并恢复连接。
     */
    private final boolean watchDog;

    /**
     * 根据构建器生成并校验不可变配置。
     */
    private MqttConfig(Builder builder) {
        serverUri = requireText(builder.serverUri, "serverUri");
        clientId = requireText(builder.clientId, "clientId");
        username = normalize(builder.username);
        password = builder.password == null ? null : Arrays.copyOf(builder.password, builder.password.length);
        connectionTimeoutSeconds = requirePositive(builder.connectionTimeoutSeconds, "connectionTimeoutSeconds");
        keepAliveSeconds = requirePositive(builder.keepAliveSeconds, "keepAliveSeconds");
        watchDog = builder.watchDog;
    }

    /**
     * @return 新的配置构建器
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * @return 完整 Broker URI
     */
    public String getServerUri() {
        return serverUri;
    }

    /**
     * @return MQTT 客户端唯一标识
     */
    public String getClientId() {
        return clientId;
    }

    /**
     * @return Broker 登录用户名，未配置时为 {@code null}
     */
    public String getUsername() {
        return username;
    }

    /**
     * @return Broker 密码副本，未配置时为 {@code null}
     */
    public char[] getPassword() {
        return password == null ? null : Arrays.copyOf(password, password.length);
    }

    /**
     * @return 连接超时时间，单位为秒
     */
    public int getConnectionTimeoutSeconds() {
        return connectionTimeoutSeconds;
    }

    /**
     * @return Keep Alive 间隔，单位为秒
     */
    public int getKeepAliveSeconds() {
        return keepAliveSeconds;
    }

    /**
     * 是否使用 watchdog 代替 Paho 自动重连。
     */
    public boolean isWatchDog() {
        return watchDog;
    }

    /**
     * 校验并标准化必填字符串。
     */
    private static String requireText(String value, String name) {
        if (value == null || value.trim().isEmpty())
            throw new IllegalArgumentException(name + " cannot be empty");

        return value.trim();
    }

    /**
     * 将可选字符串去除首尾空白，空字符串转换为 {@code null}。
     */
    private static String normalize(String value) {
        if (value == null)
            return null;

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    /**
     * 校验数值必须为正数。
     */
    private static int requirePositive(int value, String name) {
        if (value <= 0)
            throw new IllegalArgumentException(name + " must be greater than 0");

        return value;
    }

    /**
     * MQTT 配置构建器。
     */
    public static final class Builder {
        /**
         * 待构建的 Broker URI。
         */
        private String serverUri;
        /**
         * 待构建的客户端标识。
         */
        private String clientId;
        /**
         * 待构建的登录用户名。
         */
        private String username;
        /**
         * 待构建的登录密码。
         */
        private char[] password;
        /**
         * 连接超时，默认 10 秒。
         */
        private int connectionTimeoutSeconds = 10;
        /**
         * Keep Alive，默认 60 秒。
         */
        private int keepAliveSeconds = 60;
        /**
         * 是否启用 Watchdog。
         */
        private boolean watchDog;

        /**
         * 仅允许通过 {@link MqttConfig#builder()} 创建。
         */
        private Builder() {
        }

        /**
         * @param serverUri 完整 Broker URI
     * @return 当前构建器
         */
        public Builder serverUri(String serverUri) {
            this.serverUri = serverUri;
            return this;
        }

        /**
         * @param clientId MQTT 客户端唯一标识
     * @return 当前构建器
         */
        public Builder clientId(String clientId) {
            this.clientId = clientId;
            return this;
        }

        /**
         * @param username Broker 用户名，可为空
     * @return 当前构建器
         */
        public Builder username(String username) {
            this.username = username;
            return this;
        }

        /**
         * @param password Broker 密码，可为空
     * @return 当前构建器
         */
        public Builder password(String password) {
            this.password = password == null ? null : password.toCharArray();
            return this;
        }

        /**
         * @param password Broker 密码字符数组，可为空；内部会复制
     * @return 当前构建器
         */
        public Builder password(char[] password) {
            this.password = password == null ? null : Arrays.copyOf(password, password.length);
            return this;
        }

        /**
         * @param seconds 连接超时秒数，必须大于 0
     * @return 当前构建器
         */
        public Builder connectionTimeoutSeconds(int seconds) {
            connectionTimeoutSeconds = seconds;
            return this;
        }

        /**
         * 启用后由 watchdog 定期检查连接，并关闭 Paho 自动重连。
         */
        public Builder watchDog(boolean watchDog) {
            this.watchDog = watchDog;
            return this;
        }

        /**
         * @param seconds Keep Alive 秒数，必须大于 0
     * @return 当前构建器
         */
        public Builder keepAliveSeconds(int seconds) {
            keepAliveSeconds = seconds;
            return this;
        }

        /**
         * @return 校验后的不可变 MQTT 配置
         */
        public MqttConfig build() {
            return new MqttConfig(this);
        }
    }
}
