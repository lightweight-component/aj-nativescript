package com.ajaxjs.nativescript.android.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UtilsTest {
    @Test
    void encodesStandardBase64WithoutLineBreaksAndRoundTripsUnicode() {
        assertEquals("aGVsbG8=", Utils.encodeBase64("hello"));
        String text = "中文 🔐\npassword with spaces ";
        String encoded = Utils.encodeBase64(text);
        assertFalse(encoded.contains("\n"));
        assertEquals(text, Utils.decodeBase64(encoded));
    }

    @Test
    void supportsEmptyTextAndOmittedPadding() {
        assertEquals("", Utils.encodeBase64(""));
        assertEquals("", Utils.decodeBase64(""));
        assertEquals("hello", Utils.decodeBase64("aGVsbG8"));
    }

    @Test
    void rejectsNullMalformedBase64AndInvalidUtf8WithoutEchoingInput() {
        assertThrows(IllegalArgumentException.class, () -> Utils.encodeBase64(null));
        assertThrows(IllegalArgumentException.class, () -> Utils.decodeBase64(null));
        for (String input : new String[]{"secret!", "a", "aGVsbG8=\n", "_w==", "/w=="}) {
            assertThrows(IllegalArgumentException.class, () -> Utils.decodeBase64(input));
        }
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> Utils.decodeBase64("secret!"));
        assertFalse(error.getMessage().contains("secret!"));
    }
}
