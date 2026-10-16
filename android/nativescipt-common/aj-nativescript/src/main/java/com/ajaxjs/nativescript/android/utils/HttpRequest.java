package com.ajaxjs.nativescript.android.utils;

import android.net.Network;
import android.os.Looper;
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
 * HTTP 文本请求工具；异步方法使用内部线程池，同步方法必须在调用方后台线程执行。
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
     * @param callback       HTTP 2xx 响应正文回调，在后台线程执行
     * @param network        指定请求使用的网络；为 {@code null} 时使用系统默认网络
     * @param headerConsumer 连接建立后、发送请求前的 Header 配置回调，可为空
     */
    public static void get(String urlString, Consumer<String> callback, Network network, Consumer<HttpURLConnection> headerConsumer) {
        get(urlString, callback, network, headerConsumer, null);
    }

    /**
     * GET 请求，成功和错误回调均在后台线程、连接释放后执行。
     *
     * @param urlString 请求地址
     * @param callback HTTP 2xx 响应正文回调
     * @param network 指定网络，可为空
     * @param headerConsumer 发送前的请求头配置，可为空
     * @param onError HTTP 非 2xx 或请求异常回调，可为空
     */
    public static void get(String urlString, Consumer<String> callback, Network network,
                           Consumer<HttpURLConnection> headerConsumer, Consumer<String> onError) {
        requestAsync("GET", urlString, null, callback, network, headerConsumer, onError);
    }

    /**
     * 使用指定网络发起 JSON POST 请求。
     *
     * @param urlString 请求地址
     * @param body      JSON 请求正文，可为空
     * @param callback  HTTP 2xx 响应正文回调，在后台线程执行
     * @param network   指定请求使用的网络；为 {@code null} 时使用系统默认网络
     * @param onError   HTTP 非 2xx 或请求异常回调，在后台线程执行
     */
    public static void post(String urlString, String body, Consumer<String> callback, Network network, Consumer<String> onError) {
        post(urlString, body, callback, network, null, onError);
    }

    /**
     * 使用指定网络发起可自定义请求头的 POST 请求。
     * 有非空正文时默认 Content-Type 为 application/json，自定义请求头可覆盖该值。
     * 请求头配置在后台线程、发送请求前执行；配置异常通过 onError 返回。
     * 成功和错误回调均在后台线程、连接释放后执行。
     *
     * @param urlString      请求地址。
     * @param body           UTF-8 请求正文，可为空；JSON 由调用方提前序列化。
     * @param callback       HTTP 2xx 响应正文回调，可为空。
     * @param network        指定网络；为 null 时使用系统默认网络。
     * @param headerConsumer 请求头配置回调，可为空；仅配置连接，不应主动连接或读写正文。
     * @param onError        HTTP 非 2xx、请求头配置或请求异常回调，可为空。
     */
    public static void post(String urlString, String body, Consumer<String> callback, Network network,
                            Consumer<HttpURLConnection> headerConsumer, Consumer<String> onError) {
        requestAsync("POST", urlString, body, callback, network, headerConsumer, onError);
    }

    /**
     * 同步 GET 请求，仅可在后台线程调用，返回前释放连接。
     *
     * @param urlString 完整 HTTP/HTTPS 请求地址。
     * @return HTTP 2xx 响应正文，按 UTF-8 解码并去除首尾空白；空正文返回空字符串。
     * @throws IOException HTTP 非 2xx、连接、超时或读取失败。
     * @throws IllegalStateException 在 Android 主线程调用。
     * @throws RuntimeException 请求头配置回调抛出的异常原样传播。
     */
    public static String getSync(String urlString) throws IOException {
        return getSync(urlString, null, null);
    }

    /**
     * 同步 GET 请求，仅可在后台线程调用，返回前释放连接。
     *
     * @param urlString 完整 HTTP/HTTPS 请求地址。
     * @param headerConsumer 发送前的连接配置回调，可为空；不得主动连接或读写正文。
     * @return HTTP 2xx 响应正文，按 UTF-8 解码并去除首尾空白；空正文返回空字符串。
     * @throws IOException HTTP 非 2xx、连接、超时或读取失败。
     * @throws IllegalStateException 在 Android 主线程调用。
     * @throws RuntimeException 请求头配置回调抛出的异常原样传播。
     */
    public static String getSync(String urlString, Consumer<HttpURLConnection> headerConsumer) throws IOException {
        return getSync(urlString, null, headerConsumer);
    }

    /**
     * 同步 GET 请求，仅可在后台线程调用，返回前释放连接。
     *
     * @param urlString 完整 HTTP/HTTPS 请求地址。
     * @param network 指定网络；为 null 时使用系统默认网络。
     * @param headerConsumer 发送前的连接配置回调，可为空；不得主动连接或读写正文。
     * @return HTTP 2xx 响应正文，按 UTF-8 解码并去除首尾空白；空正文返回空字符串。
     * @throws IOException HTTP 非 2xx、连接、超时或读取失败。
     * @throws IllegalStateException 在 Android 主线程调用。
     * @throws RuntimeException 请求头配置回调抛出的异常原样传播。
     */
    public static String getSync(String urlString, Network network, Consumer<HttpURLConnection> headerConsumer) throws IOException {
        if (Looper.myLooper() == Looper.getMainLooper())
            throw new IllegalStateException("Synchronous HTTP requests must run on a background thread.");

        return request("GET", urlString, null, network, headerConsumer);
    }

    /**
     * 同步 POST 请求，仅可在后台线程调用，返回前释放连接。
     * 非空正文默认 Content-Type 为 application/json，可由请求头配置回调覆盖。
     *
     * @param urlString 完整 HTTP/HTTPS 请求地址。
     * @param body UTF-8 请求正文，可为 null 或空字符串；JSON 由调用方序列化。
     * @return HTTP 2xx 响应正文，按 UTF-8 解码并去除首尾空白；空正文返回空字符串。
     * @throws IOException HTTP 非 2xx、连接、超时或读取失败。
     * @throws IllegalStateException 在 Android 主线程调用。
     * @throws RuntimeException 请求头配置回调抛出的异常原样传播。
     */
    public static String postSync(String urlString, String body) throws IOException {
        return postSync(urlString, body, null, null);
    }

    /**
     * 同步 POST 请求，仅可在后台线程调用，返回前释放连接。
     * 非空正文默认 Content-Type 为 application/json，可由请求头配置回调覆盖。
     *
     * @param urlString 完整 HTTP/HTTPS 请求地址。
     * @param body UTF-8 请求正文，可为 null 或空字符串；JSON 由调用方序列化。
     * @param headerConsumer 发送前的连接配置回调，可为空；不得主动连接或读写正文。
     * @return HTTP 2xx 响应正文，按 UTF-8 解码并去除首尾空白；空正文返回空字符串。
     * @throws IOException HTTP 非 2xx、连接、超时或读取失败。
     * @throws IllegalStateException 在 Android 主线程调用。
     * @throws RuntimeException 请求头配置回调抛出的异常原样传播。
     */
    public static String postSync(String urlString, String body, Consumer<HttpURLConnection> headerConsumer) throws IOException {
        return postSync(urlString, body, null, headerConsumer);
    }

    /**
     * 同步 POST 请求，仅可在后台线程调用，返回前释放连接。
     * 非空正文默认 Content-Type 为 application/json，可由请求头配置回调覆盖。
     *
     * @param urlString 完整 HTTP/HTTPS 请求地址。
     * @param body UTF-8 请求正文，可为 null 或空字符串；JSON 由调用方序列化。
     * @param network 指定网络；为 null 时使用系统默认网络。
     * @param headerConsumer 发送前的连接配置回调，可为空；不得主动连接或读写正文。
     * @return HTTP 2xx 响应正文，按 UTF-8 解码并去除首尾空白；空正文返回空字符串。
     * @throws IOException HTTP 非 2xx、连接、超时或读取失败。
     * @throws IllegalStateException 在 Android 主线程调用。
     * @throws RuntimeException 请求头配置回调抛出的异常原样传播。
     */
    public static String postSync(String urlString, String body, Network network, Consumer<HttpURLConnection> headerConsumer) throws IOException {
        if (Looper.myLooper() == Looper.getMainLooper())
            throw new IllegalStateException("Synchronous HTTP requests must run on a background thread.");

        return request("POST", urlString, body, network, headerConsumer);
    }

    private static void requestAsync(String method, String urlString, String body, Consumer<String> callback,
                                     Network network, Consumer<HttpURLConnection> headerConsumer, Consumer<String> onError) {
        EXECUTOR.execute(() -> {
            String responseBody = null;
            String error = null;
            try {
                responseBody = request(method, urlString, body, network, headerConsumer);
            } catch (Exception e) {
                error = "Network request [" + urlString + "] failed with exception: " + e.getMessage();
                Log.e(Helper.TAG, error, e);
            }
            dispatchResult(callback, onError, responseBody, error);
        });
    }

    private static String request(String method, String urlString, String body, Network network,
                                  Consumer<HttpURLConnection> headerConsumer) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection connection = (HttpURLConnection) (network == null ? url.openConnection() : network.openConnection(url));
        return executeConnection(connection, method, body, headerConsumer);
    }

    /**
     * 共用请求实现；配置、写入或读取失败时也必须释放连接。
     */
    static String executeConnection(HttpURLConnection connection, String method, String body,
                                    Consumer<HttpURLConnection> headerConsumer) throws IOException {
        try {
            boolean post = "POST".equals(method);
            boolean hasBody = post && body != null && !body.isEmpty();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(post ? 55000 : 5000);
            connection.setReadTimeout(post ? 50000 : 10000);
            if (hasBody) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
            }
            if (headerConsumer != null)
                headerConsumer.accept(connection);
            if (hasBody) {
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body.getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300)
                throw new IOException("HTTP " + status + " [" + connection.getURL() + "] response body: " + readText(connection.getErrorStream()));

            return readText(connection.getInputStream());
        } finally {
            connection.disconnect();
        }
    }

    /**
     * 回调异常不得被当作请求失败，也不得触发第二次回调。
     */
    static void dispatchResult(Consumer<String> callback, Consumer<String> onError,
                               String responseBody, String error) {
        if (error != null) {
            if (onError != null)
                onError.accept(error);
        } else if (callback != null) {
            callback.accept(responseBody);
        }
    }

    /**
     * Read the inputstream to String
     *
     * @param in 输入流；为 {@code null} 时返回空字符串
     * @return 去除首尾空白后的文本
     * @throws UncheckedIOException 读取输入流失败时抛出
     */
    public static String readInputStream(InputStream in) {
        try {
            return readText(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String readText(InputStream in) throws IOException {
        if (in == null)
            return "";

        try (InputStream input = in;
             BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null)
                response.append(line).append("\n");

            return response.toString().trim();
        }
    }
}
