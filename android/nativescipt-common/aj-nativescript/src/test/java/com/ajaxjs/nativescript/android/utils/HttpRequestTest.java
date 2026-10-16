package com.ajaxjs.nativescript.android.utils;

import org.junit.jupiter.api.Test;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.IOException;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class HttpRequestTest {
    @Test
    void decodesUtf8Response() {
        String body = "{\"message\":\"中文 🔐\"}";
        assertEquals(body, HttpRequest.readInputStream(
                new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8))));
    }

    @Test
    void reportsHttpFailureWithoutSuccessCallback() {
        AtomicInteger successes = new AtomicInteger();
        AtomicReference<String> failure = new AtomicReference<>();
        HttpRequest.dispatchResult(body -> successes.incrementAndGet(), failure::set,
                "denied", "HTTP 401 response body: denied");
        assertEquals(0, successes.get());
        assertEquals("HTTP 401 response body: denied", failure.get());
    }

    @Test
    void callbackExceptionDoesNotInvokeErrorCallback() {
        AtomicInteger failures = new AtomicInteger();
        RuntimeException exception = new RuntimeException("Business callback failed");
        assertSame(exception, assertThrows(RuntimeException.class,
                () -> HttpRequest.dispatchResult(body -> { throw exception; },
                        error -> failures.incrementAndGet(), "ok", null)));
        assertEquals(0, failures.get());
    }

    @Test
    void deliversEmptySuccessfulResponse() {
        AtomicReference<String> result = new AtomicReference<>();
        HttpRequest.dispatchResult(result::set, error -> fail(error), "", null);
        assertEquals("", result.get());
    }

    @Test
    void executesRealGetAndPostWithUtf8AndCustomHeaders() throws Exception {
        HttpServer server = startServer();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/";
            String get = HttpRequest.executeConnection((HttpURLConnection) new URL(url).openConnection(), "GET", null,
                    connection -> connection.setRequestProperty("Authorization", "Bearer test"));
            assertEquals("GET|Bearer test|null|", get);
            String post = HttpRequest.executeConnection((HttpURLConnection) new URL(url).openConnection(), "POST", "中文 🔐",
                    connection -> {
                        connection.setRequestProperty("Authorization", "Bearer post");
                        connection.setRequestProperty("Content-Type", "text/plain; charset=utf-8");
                    });
            assertEquals("POST|Bearer post|text/plain; charset=utf-8|中文 🔐", post);
            String json = HttpRequest.executeConnection((HttpURLConnection) new URL(url).openConnection(), "POST", "{}", null);
            assertEquals("POST|null|application/json|{}", json);
            String empty = HttpRequest.executeConnection((HttpURLConnection) new URL(url).openConnection(), "POST", null,
                    connection -> connection.setRequestProperty("Authorization", "Bearer empty"));
            assertEquals("POST|Bearer empty|null|", empty);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void throwsForHttpErrorsAndReturnsEmptyFor204() throws Exception {
        HttpServer server = startServer();
        try {
            String url = "http://127.0.0.1:" + server.getAddress().getPort();
            IOException error = assertThrows(IOException.class, () -> HttpRequest.executeConnection(
                    (HttpURLConnection) new URL(url + "/error").openConnection(), "GET", null, null));
            assertTrue(error.getMessage().contains("HTTP 401"));
            assertTrue(error.getMessage().contains("denied"));
            assertEquals("", HttpRequest.executeConnection((HttpURLConnection) new URL(url + "/empty").openConnection(),
                    "GET", null, null));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void releasesConnectionWhenHeaderConfigurationFails() throws Exception {
        AtomicInteger disconnects = new AtomicInteger();
        HttpURLConnection connection = new HttpURLConnection(new URL("http://example.test")) {
            @Override
            public void disconnect() {
                disconnects.incrementAndGet();
            }
            @Override
            public boolean usingProxy() {
                return false;
            }
            @Override
            public void connect() {
                fail("Must not connect after header configuration failure");
            }
        };
        RuntimeException failure = new RuntimeException("Invalid header");
        assertSame(failure, assertThrows(RuntimeException.class, () -> HttpRequest.executeConnection(connection,
                "POST", "{}", headers -> {
                    throw failure;
                })));
        assertEquals(1, disconnects.get());
    }

    private static HttpServer startServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try {
                if (exchange.getRequestURI().getPath().equals("/empty")) {
                    exchange.sendResponseHeaders(204, -1);
                    return;
                }
                boolean error = exchange.getRequestURI().getPath().equals("/error");
                String body = error ? "denied" : exchange.getRequestMethod() + "|"
                        + exchange.getRequestHeaders().getFirst("Authorization") + "|"
                        + exchange.getRequestHeaders().getFirst("Content-Type") + "|"
                        + HttpRequest.readInputStream(exchange.getRequestBody());
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(error ? 401 : 200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } finally {
                exchange.close();
            }
        });
        server.start();
        return server;
    }
}
