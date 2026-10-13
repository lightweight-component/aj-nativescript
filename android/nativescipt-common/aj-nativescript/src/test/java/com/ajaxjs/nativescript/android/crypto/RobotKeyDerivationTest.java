package com.ajaxjs.nativescript.android.crypto;

import org.junit.jupiter.api.Test;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;

class RobotKeyDerivationTest {
    private static byte[] hex(String text) {
        byte[] result = new byte[text.length() / 2];
        for (int i = 0; i < result.length; i++)
            result[i] = (byte) Integer.parseInt(text.substring(i * 2, i * 2 + 2), 16);
        return result;
    }

    @Test
    void matchesRfc5869Case1AcrossMultipleBlocks() throws Exception {
        byte[] ikm = new byte[22];
        Arrays.fill(ikm, (byte) 0x0b);
        assertArrayEquals(hex("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"),
                RobotKeyDerivation.hkdf(ikm, hex("000102030405060708090a0b0c"), hex("f0f1f2f3f4f5f6f7f8f9"), 42));
    }

    @Test
    void matchesPublicRobotVectorsAndMacFormats() throws Exception {
        String[][] vectors = {
            {"AAECAwQFBgcICQoLDA0ODw==", "001122aabbcc", "/T4dpdZXHizH3tolT76hp79ZE9UlPI2JqRWpGx5pEr0="},
            {"AAECAwQFBgcICQoLDA0ODxAREhMUFRYX", "aabbccddeeff", "s5NIvx/y07w6GAe7ju4X+7g+bAeib16SK//JINiekyY="},
            {"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=", "aabbccddeeff", "q0b0kWRcfgnZDBNyyZmxuI4SNp1PWus+XCZOPObeknc="},
            {"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=", "aabbccddee00", "3efudqTiMg12w630Chpct+tRd2NAVae8TqJUW+w+0bM="}
        };
        for (String[] vector : vectors)
            assertEquals(vector[2], RobotKeyDerivation.deriveKey(vector[0], vector[1]));
        assertEquals(vectors[2][2], RobotKeyDerivation.deriveKey(vectors[2][0], "AA:BB:CC:DD:EE:FF"));
        assertEquals(vectors[2][2], RobotKeyDerivation.deriveKey(vectors[2][0], "AA-BB-CC-DD-EE-FF"));
    }

    @Test
    void rejectsAmbiguousMacAndInvalidMasterEncoding() {
        for (String mac : new String[]{"", "aabbccddeeff\n", " aabbccddeeff", "AA:BB-CC:DD:EE:FF", "aabbccddeefg", "aabbccddeef"})
            assertThrows(IllegalArgumentException.class, () -> RobotKeyDerivation.deriveKey("AAAAAAAAAAAAAAAAAAAAAA==", mac));
        for (String key : new String[]{"", "AA==", "AAAAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAAAB==", "AAAAAAAAAAAAAAAAAAAAAA==\n"})
            assertThrows(IllegalArgumentException.class, () -> RobotKeyDerivation.deriveKey(key, "001122aabbcc"));
    }
}
