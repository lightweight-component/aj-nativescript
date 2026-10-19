package com.ajaxjs.nativescript.android.storage;

import android.content.Context;

import com.ajaxjs.nativescript.android.utils.HttpRequest;
import com.ajaxjs.nativescript.android.utils.Utils;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;

/**
 * 获取并缓存接口提供的用户名和密码；当前不处理 AES 密钥。
 * 所有方法都应在调用方的后台线程执行，包括从 Java 代码调用的情况。
 * 缓存读取涉及磁盘和解密；缓存未命中时会同步请求接口，阻塞调用线程。
 * 本类不自动创建后台线程，也不向主线程切换。
 */
public class GetCredential {
    public static final String USER_TOKEN_KEY = "user_token";

    public static final String USER_REFRESH_TOKEN_KEY = "user_refresh_token";

    public static void saveUserTokenKey(Context context, String userToken, String refreshToken) {
        SecureStorage.setItem(context, USER_TOKEN_KEY, userToken);
        SecureStorage.setItem(context, USER_REFRESH_TOKEN_KEY, refreshToken);
    }

    public static String getUserToken(Context context) {
       return SecureStorage.getItem(context, USER_TOKEN_KEY);
    }

    public static String getUserRefreshToken(Context context) {
       return SecureStorage.getItem(context, USER_REFRESH_TOKEN_KEY);
    }

    /**
     * 凭据接口完整地址，使用前应配置为实际的 HTTPS 地址。
     * 请求方法为 GET，携带 Bearer Token，禁止自动跟随重定向。
     */
    public static String URL = "https://...";

    /**
     * 从安全存储读取用户 Token，再获取缓存或接口中的凭据。
     * 必须在后台线程调用；即使凭据已缓存，也会先读取 Token，Token 不存在时失败。
     *
     * @param context      有效的 Android Context，建议传入 Application Context。
     * @param key          凭据缓存键，非空白且最多 128 个 UTF-16 单元；应按用户区分。
     * @return 长度为 2 的数组，索引 0 为用户名，索引 1 为 Base64 解码后的 UTF-8 密码。
     * @throws IllegalArgumentException 存储键无效，或接口提供的用户名、解码后的密码包含下划线。
     * @throws IllegalStateException    Token 不存在、存储操作失败、凭据格式无效，或缓存未命中时在主线程发起请求。
     * @throws RuntimeException         网络请求失败；原始 IOException 作为 cause 保留。
     */
    public static String[] getCredentialByUserTokenKey(Context context, String key) {
        String userToken = getUserToken(context);

        if (userToken == null)
            throw new IllegalStateException("获取用户 token 失败，用户未登录？");

        return getCredential(context, key, userToken);
    }

    /**
     * 从安全存储读取用户 Token，再获取缓存或接口中的凭据。
     * 必须在后台线程调用；即使凭据已缓存，也会先读取 Token，Token 不存在时失败。
     *
     * @param context      有效的 Android Context，建议传入 Application Context。
     * @param key          凭据缓存键，非空白且最多 128 个 UTF-16 单元；应按用户区分。
     * @param userTokenKey 已保存用户 Token 的安全存储键，非空白且最多 128 个 UTF-16 单元。
     * @return 长度为 2 的数组，索引 0 为用户名，索引 1 为 Base64 解码后的 UTF-8 密码。
     * @throws IllegalArgumentException 存储键无效，或接口提供的用户名、解码后的密码包含下划线。
     * @throws IllegalStateException    Token 不存在、存储操作失败、凭据格式无效，或缓存未命中时在主线程发起请求。
     * @throws RuntimeException         网络请求失败；原始 IOException 作为 cause 保留。
     */
    public static String[] getCredentialByUserTokenKey(Context context, String key, String userTokenKey) {
        String userToken = SecureStorage.getItem(context, userTokenKey);

        if (userToken == null)
            throw new IllegalStateException("获取用户 token 失败，用户未登录？");

        return getCredential(context, key, userToken);
    }

    /**
     * 优先读取安全缓存；未命中时同步请求接口，解析 data.username 和 data.password，
     * 将密码从标准 Base64 解码为 UTF-8 文本，再以 username_password 的形式加密保存。
     * 用户名和解码后的密码不得包含下划线；空字符串目前允许，读取缓存时保留空字段。
     * 必须在后台线程调用；缓存命中不会检查线程，未命中时同步 HTTP 会拒绝主线程调用。
     * 缓存存在时不会请求接口、验证 Token 或自动刷新；账号隔离、退出清理和刷新由调用方负责。
     *
     * @param context   有效的 Android Context，建议传入 Application Context。
     * @param key       凭据缓存键，非空白且最多 128 个 UTF-16 单元；应按用户区分。
     * @param userToken 用户 Token 原文，不含 Bearer 前缀；调用方应确保非空且不含换行符。
     * @return 长度为 2 的数组，索引 0 为用户名，索引 1 为解码后的密码；请勿记录到日志。
     * @throws IllegalArgumentException 存储键无效，或接口提供的用户名、解码后的密码包含下划线。
     * @throws IllegalStateException    存储读写失败、缓存格式无效、响应 JSON 或密码编码无效，
     *                                  或缓存未命中时在主线程发起请求。
     * @throws RuntimeException         网络请求失败，包括非 2xx HTTP 响应；原始 IOException 作为 cause 保留。
     */
    public static String[] getCredential(Context context, String key, String userToken) {
        String credentialStr = SecureStorage.getItem(context, key);
        String[] result;

        if (credentialStr == null) {
            String username, password;

            /*
             * 缓存未命中时，在当前后台线程同步请求接口。
             */
            String resultJson;

            try {
                resultJson = HttpRequest.getSync(URL, conn -> {
                    conn.setInstanceFollowRedirects(false);
                    conn.addRequestProperty("Authorization", "Bearer " + userToken);
                });
            } catch (IOException e) {
                throw new RuntimeException("获取用户 Credential 失败", e);
            }

            JSONObject json;

            try {
                json = new JSONObject(resultJson);
                JSONObject data = json.getJSONObject("data");

//                int ver = data.getInt("ver");
                username = data.getString("username");
                password = data.getString("password");

                password = Utils.decodeBase64(password);
            } catch (JSONException e) {
                throw new IllegalStateException("凭据响应 JSON 格式无效。");
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException("接口返回的密码不是有效的 Base64 UTF-8 文本。", e);
            }

            if (username.contains("_") || password.contains("_"))
                throw new IllegalArgumentException("用户名或密码不能包含下划线");

            credentialStr = username + "_" + password;
            SecureStorage.setItem(context, key, credentialStr);

            result = new String[]{username, password};
        } else {
            result = credentialStr.split("_", -1);
        }

        if (result.length != 2)
            throw new IllegalStateException("非法加密字段");

        return result;
    }
}
