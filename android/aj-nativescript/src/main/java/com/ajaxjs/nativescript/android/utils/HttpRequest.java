package com.ajaxjs.android.utils;

import android.net.Network;
import android.text.TextUtils;
import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/**
 * HTTP request helper class.
 * 在子线程中执行网络请求
 */
public class HttpRequest {
    /**
     * 串行执行网络请求的后台线程池，避免阻塞主线程。
     */
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    /**
     * 使用系统默认网络发起 GET 请求。
     *
     * @param urlString 请求地址
     * @param callback  成功响应正文回调，在后台线程执行
     */
    public static void get(String urlString, Consumer<String> callback) {
        get(urlString, callback, null, null);
    }

    /**
     * 使用系统默认网络发起可自定义请求头的 GET 请求。
     *
     * @param urlString      请求地址
     * @param callback       成功响应正文回调，在后台线程执行
     * @param headerConsumer 连接建立后、发送请求前的 Header 配置回调
     */
    public static void get(String urlString, Consumer<String> callback, Consumer<HttpURLConnection> headerConsumer) {
        get(urlString, callback, null, headerConsumer);
    }

    /**
     * Get request
     *
     * @param urlString      请求地址
     * @param callback       HTTP 200 响应正文回调，在后台线程执行
     * @param network        指定请求使用的网络；为 {@code null} 时使用系统默认网络
     * @param headerConsumer 连接建立后、发送请求前的 Header 配置回调，可为空
     */
    public static void get(String urlString, Consumer<String> callback, Network network, Consumer<HttpURLConnection> headerConsumer) {
        Log.d(Helper.TAG, "HTTP [" + urlString + "]start to request. isRequestNetwork: " + (network != null));

        EXECUTOR.execute(() -> {
            HttpURLConnection connection = null;
            String responseBody;

            try {
                URL url = new URL(urlString);
                connection = (HttpURLConnection) (network == null ? url.openConnection() : network.openConnection(url));
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(5000); // 5 秒连接超时
                connection.setReadTimeout(10000);   // 10 秒读取超时

                if (headerConsumer != null)
                    headerConsumer.accept(connection);

                int responseCode = connection.getResponseCode();
                Log.d(Helper.TAG, "HTTP [" + urlString + "]Response Code: " + responseCode);

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    responseBody = readInputStream(connection.getInputStream());
                    Log.v(Helper.TAG, "Response [" + urlString + "] successful, body content:\n" + responseBody); // 使用 VERBOSE 级别，因为内容可能很长

                    if (callback != null)
                        callback.accept(responseBody);
                } else {
                    responseBody = readInputStream(connection.getErrorStream());// 尝试读取错误流
                    String msg = "Error [" + urlString + "] response body: " + responseBody;
                    Log.e(Helper.TAG, msg);
                }
            } catch (Exception e) {
                String msg = "Network request [" + urlString + "] failed with exception: " + e.getMessage();
                Log.e(Helper.TAG, msg, e);
            } finally {
                if (connection != null)
                    connection.disconnect();
            }
        });
    }

    /**
     * 使用指定网络发起 JSON POST 请求。
     *
     * @param urlString 请求地址
     * @param body      JSON 请求正文，可为空
     * @param callback  HTTP 200 响应正文回调，在后台线程执行
     * @param network   指定请求使用的网络；为 {@code null} 时使用系统默认网络
     * @param onError   请求发生异常时的错误信息回调，在后台线程执行
     */
    public static void post(String urlString, String body, Consumer<String> callback, Network network, Consumer<String> onError) {
        EXECUTOR.execute(() -> {
            HttpURLConnection connection = null;
            String responseBody;

            try {
                URL url = new URL(urlString);
                connection = (HttpURLConnection) (network == null ? url.openConnection() : network.openConnection(url));
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(55000); // 45 秒连接超时
                connection.setReadTimeout(50000);   // 40 秒读取超时

                if (!TextUtils.isEmpty(body)) { // 确保有数据要发送
                    connection.setDoOutput(true); // 允许写入请求体
                    connection.setRequestProperty("Content-Type", "application/json"); // 设置内容类型为 JSON

                    try (OutputStream outputStream = connection.getOutputStream();) {// 获取输出流并写入请求体
                        byte[] outputBytes = body.getBytes(StandardCharsets.UTF_8); // 将 JSON 字符串转换为 UTF-8 字节数组
                        outputStream.write(outputBytes);
                        outputStream.flush(); // 确保数据被发送
                    }
                } else {
                    // 如果是 POST 但没有 body，也应设置 doOutput 以表明有请求体（即使是空的）
                    // 但这取决于服务器期望的行为，有时空 body 的 POST 不需要 setDoOutput
                    // connection.setDoOutput(true); // 视情况而定
                    Log.i(Helper.TAG, "POST request initiated without body data.");
                }

                int responseCode = connection.getResponseCode();
                Log.d(Helper.TAG, "HTTP [" + urlString + "]Response Code: " + responseCode);

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    responseBody = readInputStream(connection.getInputStream());
                    Log.v(Helper.TAG, "Response [" + urlString + "] successful, body content:\n" + responseBody); // 使用 VERBOSE 级别，因为内容可能很长

                    if (callback != null)
                        callback.accept(responseBody);
                } else {
                    responseBody = readInputStream(connection.getErrorStream());// 尝试读取错误流
                    String msg = "Error [" + urlString + "] response body: " + responseBody;
                    Log.e(Helper.TAG, msg);
                }
            } catch (Exception e) {
                String msg = "Network request [" + urlString + "] failed with exception: " + e.getMessage();

                if (onError != null)
                    onError.accept(msg);

                Log.e(Helper.TAG, msg, e);
            } finally {
                if (connection != null)
                    connection.disconnect();
            }
        });
    }

    /**
     * Read the inputstream to String
     *
     * @param in 输入流；为 {@code null} 时返回空字符串
     * @return 去除首尾空白后的文本
     * @throws UncheckedIOException 读取输入流失败时抛出
     */
    public static String readInputStream(InputStream in) {
        if (in == null) {
            Log.w(Helper.TAG, "The input stream is NULL.");

            return "";
        }

        try (InputStream in2 = in;
             BufferedReader reader = new BufferedReader(new InputStreamReader(in2))) {
            StringBuilder response = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null)
                response.append(line).append("\n");

            return response.toString().trim();
        } catch (IOException e) {
            Log.w(Helper.TAG, "Errors when reading inputstream to text");
            throw new UncheckedIOException(e);
        }
    }
}
