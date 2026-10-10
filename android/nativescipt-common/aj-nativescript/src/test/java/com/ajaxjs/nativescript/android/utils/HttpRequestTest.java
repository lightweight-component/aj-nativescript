package com.ajaxjs.nativescript.android.utils;

import org.junit.jupiter.api.Test;

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
}
