package com.ajaxjs.nativescript.android.crypto;

import org.junit.jupiter.api.Test;
import javax.crypto.AEADBadTagException;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;

class JsonBodyCipherTest {
    @Test
    void roundTripsAllKeySizesAndUnicode() throws Exception {
        for (int size : new int[]{16, 24, 32}) {
            SecretKeySpec key = new SecretKeySpec(new byte[size], "AES");
            for (String text : new String[]{"", "{\"text\":\"中文 🔐\"}"}) {
                EncryptedBody encrypted = JsonBodyCipher.encryptWithKey(key, text);
                assertEquals(12, Base64.getDecoder().decode(encrypted.getNonce()).length);
                assertEquals(text, JsonBodyCipher.decryptWithKey(key, encrypted.getNonce(), encrypted.getData()));
            }
        }
    }

    @Test
    void rejectsTamperingAndMalformedPayload() throws Exception {
        SecretKeySpec key = new SecretKeySpec(new byte[32], "AES");
        EncryptedBody encrypted = JsonBodyCipher.encryptWithKey(key, "hello");
        byte[] bytes = Base64.getDecoder().decode(encrypted.getData());
        bytes[0] ^= 1;
        assertThrows(AEADBadTagException.class, () -> JsonBodyCipher.decryptWithKey(key,
                encrypted.getNonce(), Base64.getEncoder().encodeToString(bytes)));
        assertThrows(IllegalArgumentException.class, () -> JsonBodyCipher.decryptWithKey(key, "AA==", "AA=="));
        assertThrows(IllegalArgumentException.class, () -> JsonBodyCipher.decryptWithKey(key, "invalid!", encrypted.getData()));
    }

    @Test
    void generatesFreshNonces() throws Exception {
        SecretKeySpec key = new SecretKeySpec(new byte[32], "AES");
        assertNotEquals(JsonBodyCipher.encryptWithKey(key, "hello").getNonce(),
                JsonBodyCipher.encryptWithKey(key, "hello").getNonce());
    }
}
