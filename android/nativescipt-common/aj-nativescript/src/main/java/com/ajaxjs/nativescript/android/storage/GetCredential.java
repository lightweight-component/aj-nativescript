package com.ajaxjs.nativescript.android.storage;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 用户 Token、MQTT 账号密码、客户端 Token 及 AES 密钥字符串的本机安全存取。
 * 所有值通过 SecureStorage 加密保存，独立于原生 AES 密钥别名；不请求网络或刷新凭据。
 * 同步方法在当前线程读写磁盘及解密；Async 方法后台串行执行并在主线程通知结果。
 * 缺失项读取返回 null，空字符串原样保留；保存值上限为每项 65536 UTF-8 字节。
 * 双项写入/删除不是事务，失败可能部分完成；调用方须处理错误并重试。
 * 不要记录返回的 Token、密码或密钥；固定键只表示当前账户，账户切换与在途请求由业务管理。
 */
public class GetCredential {
    /**
     * Token 异步读写的进程内串行执行器；不包含同步调用或业务网络请求。
     */
    private static final ExecutorService TOKEN_EXECUTOR = Executors.newSingleThreadExecutor();

    /**
     * Token 异步操作的单次结果通知；onResult 与 onError 只调用其中之一，并在主线程执行。
     */
    public interface TokenCallback {
        /**
         * 异步操作成功通知。
         *
         * @param value 读取时为原始 Token，缺失为 null；保存成功也为 null。
         */
        void onResult(String value);

        /**
         * 异步操作失败通知，不返回部分明文或原始异常。
         *
         * @param message 不包含凭据内容的通用错误消息。
         */
        void onError(String message);
    }

    /**
     * 后台依次保存两个用户 Token，非事务；失败可能只更新第一项。
     *
     * @param context      有效的 Context，建议 Application Context；不得为 null。
     * @param userToken    原始登录 Token，合法字符串，可为空，不附加 Bearer 前缀。
     * @param refreshToken 原始刷新 Token，要求同 userToken。
     * @param callback     保存成功 onResult(null)，操作失败 onError；主线程单次通知。
     * @throws IllegalArgumentException callback 为 null；其他操作异常通过 onError 通知。
     */
    public static void saveUserTokenAsync(Context context, String userToken, String refreshToken, TokenCallback callback) {
        runTokenOperation(() -> {
            saveUserToken(context, userToken, refreshToken);
            return null;
        }, callback);
    }

    /**
     * 后台读取 user_token，不校验有效期或自动刷新。
     *
     * @param context  有效的 Context，建议 Application Context；不得为 null。
     * @param callback 原值或缺失 null 通过 onResult 返回，失败触发 onError；主线程单次通知。
     * @throws IllegalArgumentException callback 为 null。
     */
    public static void getUserTokenAsync(Context context, TokenCallback callback) {
        runTokenOperation(() -> getUserToken(context), callback);
    }

    /**
     * 后台读取 user_refresh_token，不校验有效期或自动刷新。
     *
     * @param context  有效的 Context，建议 Application Context；不得为 null。
     * @param callback 原值或缺失 null 通过 onResult 返回，失败触发 onError；主线程单次通知。
     * @throws IllegalArgumentException callback 为 null。
     */
    public static void getUserRefreshTokenAsync(Context context, TokenCallback callback) {
        runTokenOperation(() -> getUserRefreshToken(context), callback);
    }

    /**
     * 后台执行存储操作，捕获 Exception 并将单次结果派发至主线程。
     *
     * @param action   要执行的本机操作，不能为 null。
     * @param callback 主线程结果回调，不能为 null。
     * @throws IllegalArgumentException callback 为 null。
     */
    private static void runTokenOperation(Callable<String> action, TokenCallback callback) {
        if (callback == null)
            throw new IllegalArgumentException("Token callback is required.");
        Handler main = new Handler(Looper.getMainLooper());
        TOKEN_EXECUTOR.execute(() -> {
            String value;
            try {
                value = action.call();
            } catch (Exception error) {
                main.post(() -> callback.onError("User token secure storage operation failed."));
                return;
            }
            main.post(() -> callback.onResult(value));
        });
    }

    /**
     * 当前用户登录 Token 的固定安全存储键 user_token。
     */
    public static final String USER_TOKEN_KEY = "user_token";

    /**
     * 当前用户刷新 Token 的固定安全存储键 user_refresh_token。
     */
    public static final String USER_REFRESH_TOKEN_KEY = "user_refresh_token";

    /**
     * 同步依次保存/覆盖用户登录及刷新 Token，保留空格、Unicode 和空值；不是事务。
     *
     * @param context      有效的 Context，建议 Application Context；不得为 null。
     * @param userToken    原始登录 Token，不附加 Bearer 前缀，每项最多 65536 UTF-8 字节。
     * @param refreshToken 原始刷新 Token，要求同 userToken。
     * @throws IllegalArgumentException 值无效，含未配对代理项或超过 65536 UTF-8 字节。
     * @throws IllegalStateException    安全存储、Keystore 或磁盘写入失败。
     */
    public static void saveUserToken(Context context, String userToken, String refreshToken) {
        SecureStorage.setItem(context, USER_TOKEN_KEY, userToken);
        SecureStorage.setItem(context, USER_REFRESH_TOKEN_KEY, refreshToken);
    }

    /**
     * 同步读取 user_token；仅访问本机存储，不请求网络或解码。
     *
     * @param context 有效的 Context，建议 Application Context；不得为 null。
     * @return 原始字符串，不存在返回 null；空字符串仍为 ""。
     * @throws IllegalStateException 存储、Keystore、解密、认证或磁盘读取失败，不伪装为未找到。
     */
    public static String getUserToken(Context context) {
        return SecureStorage.getItem(context, USER_TOKEN_KEY);
    }

    /**
     * 同步读取 user_refresh_token；仅访问本机存储，不请求网络或解码。
     *
     * @param context 有效的 Context，建议 Application Context；不得为 null。
     * @return 原始字符串，不存在返回 null；空字符串仍为 ""。
     * @throws IllegalStateException 存储、Keystore、解密、认证或磁盘读取失败，不伪装为未找到。
     */
    public static String getUserRefreshToken(Context context) {
        return SecureStorage.getItem(context, USER_REFRESH_TOKEN_KEY);
    }

    /**
     * 同步依次幂等删除用户登录及刷新 Token，不存在也成功，不影响其他类别。
     * 两项非事务，失败时可能只删除第一项；不会取消尚未完成的异步保存。
     *
     * @param context 有效的 Context，建议 Application Context；不得为 null。
     * @throws IllegalStateException 安全存储或文件删除失败。
     */
    public static void removeUserToken(Context context) {
        SecureStorage.removeItem(context, USER_TOKEN_KEY);
        SecureStorage.removeItem(context, USER_REFRESH_TOKEN_KEY);
    }

    /**
     * 当前账户 MQTT 用户名的固定安全存储键 mqtt_username。
     */
    public static final String MQTT_USERNAME_KEY = "mqtt_username";

    /**
     * 当前账户 MQTT 密码的固定安全存储键 mqtt_password。
     */
    public static final String MQTT_PASSWORD_KEY = "mqtt_password";

    /**
     * 同步读取 mqtt_username；仅访问本机存储，不请求网络或解码。
     *
     * @param context 有效的 Context，建议 Application Context；不得为 null。
     * @return 原始字符串，不存在返回 null；空字符串仍为 ""。
     * @throws IllegalStateException 存储、Keystore、解密、认证或磁盘读取失败，不伪装为未找到。
     */
    public static String getMqttUsername(Context context) {
        return SecureStorage.getItem(context, MQTT_USERNAME_KEY);
    }

    /**
     * 同步读取 mqtt_password；仅访问本机存储，不请求网络或解码。
     *
     * @param context 有效的 Context，建议 Application Context；不得为 null。
     * @return 原始字符串，不存在返回 null；空字符串仍为 ""。
     * @throws IllegalStateException 存储、Keystore、解密、认证或磁盘读取失败，不伪装为未找到。
     */
    public static String getMqttPassword(Context context) {
        return SecureStorage.getItem(context, MQTT_PASSWORD_KEY);
    }

    /**
     * 同步依次保存/覆盖 MQTT 用户名与密码，非事务，不请求网络、不拼接或解码。
     *
     * @param context  有效的 Context，建议 Application Context；不得为 null。
     * @param username 原始用户名，合法字符串，可为空，允许下划线，每项最多 65536 UTF-8 字节。
     * @param password 原始密码，要求同 username；第二项失败时第一项可能已更新。
     * @throws IllegalArgumentException 值无效，含未配对代理项或超过 65536 UTF-8 字节。
     * @throws IllegalStateException    安全存储、Keystore 或磁盘写入失败。
     */
    public static void setMqttCredential(Context context, String username, String password) {
        SecureStorage.setItem(context, MQTT_USERNAME_KEY, username);
        SecureStorage.setItem(context, MQTT_PASSWORD_KEY, password);
    }

    /**
     * 同步依次幂等删除MQTT 账号及密码，不存在也成功，不影响其他类别。
     * 两项非事务，失败时可能只删除第一项；不会取消尚未完成的异步保存。
     *
     * @param context 有效的 Context，建议 Application Context；不得为 null。
     * @throws IllegalStateException 安全存储或文件删除失败。
     */
    public static void removeMqttCredential(Context context) {
        SecureStorage.removeItem(context, MQTT_USERNAME_KEY);
        SecureStorage.removeItem(context, MQTT_PASSWORD_KEY);
    }

    /**
     * 客户端认证 Token 的固定安全存储键 client_credential。
     */
    public static final String CLIENT_CREDENTIAL_KEY = "client_credential";

    /**
     * 同步保存/覆盖客户端认证 Token，原样保留空格及 Unicode。
     * 不附加 Bearer 前缀，不校验有效期或请求后端。
     *
     * @param ctx   有效的 Context，建议 Application Context；不得为 null。
     * @param token 原始客户端 Token，合法字符串，可为空，最多 65536 UTF-8 字节。
     * @throws IllegalArgumentException 值无效，含未配对代理项或超过 65536 UTF-8 字节。
     * @throws IllegalStateException    安全存储、Keystore 或磁盘写入失败。
     */
    public static void saveClientCredential(Context ctx, String token) {
        SecureStorage.setItem(ctx, CLIENT_CREDENTIAL_KEY, token);
    }

    /**
     * 同步读取客户端认证 Token，不解码或执行加解密。
     *
     * @param ctx 有效的 Context，建议 Application Context；不得为 null。
     * @return 原始字符串，不存在为 null，空字符串保留；请勿记录日志。
     * @throws IllegalStateException 存储、Keystore、解密、认证或磁盘读取失败，不伪装为未找到。
     */
    public static String getClientCredential(Context ctx) {
        return SecureStorage.getItem(ctx, CLIENT_CREDENTIAL_KEY);
    }

    /**
     * 同步幂等删除客户端认证 Token，不存在也成功，不影响其他类别的存储项。
     *
     * @param ctx 有效的 Context，建议 Application Context；不得为 null。
     * @throws IllegalStateException 安全存储或文件删除失败。
     */
    public static void removeClientCredential(Context ctx) {
        SecureStorage.removeItem(ctx, CLIENT_CREDENTIAL_KEY);
    }

    /**
     * AES 密钥字符串的固定安全存储键 AES_KEY，不是密码学 Keystore 的密钥别名。
     */
    public static final String AES_KEY_KEY = "AES_KEY";

    /**
     * 同步保存/覆盖AES 密钥字符串，原样保留空格及 Unicode。
     * 不校验 AES 长度或 Base64、不导入密码学 Keystore、不执行 HKDF。
     *
     * @param ctx   有效的 Context，建议 Application Context；不得为 null。
     * @param token AES 密钥的字符串表示，通常为标准 Base64，合法字符串，可为空，最多 65536 UTF-8 字节。
     * @throws IllegalArgumentException 值无效，含未配对代理项或超过 65536 UTF-8 字节。
     * @throws IllegalStateException    安全存储、Keystore 或磁盘写入失败。
     */
    public static void saveAesKey(Context ctx, String token) {
        SecureStorage.setItem(ctx, AES_KEY_KEY, token);
    }

    /**
     * 同步读取AES 密钥字符串，不解码或执行加解密。
     *
     * @param ctx 有效的 Context，建议 Application Context；不得为 null。
     * @return 原始字符串，不存在为 null，空字符串保留；请勿记录日志。
     * @throws IllegalStateException 存储、Keystore、解密、认证或磁盘读取失败，不伪装为未找到。
     */
    public static String getAesKey(Context ctx) {
        return SecureStorage.getItem(ctx, AES_KEY_KEY);
    }

    /**
     * 同步幂等删除AES 密钥字符串，不存在也成功，不影响其他类别的存储项。
     * 不删除通过 importAesKey 导入的别名密钥。
     *
     * @param ctx 有效的 Context，建议 Application Context；不得为 null。
     * @throws IllegalStateException 安全存储或文件删除失败。
     */
    public static void removeAesKey(Context ctx) {
        SecureStorage.removeItem(ctx, AES_KEY_KEY);
    }
}
