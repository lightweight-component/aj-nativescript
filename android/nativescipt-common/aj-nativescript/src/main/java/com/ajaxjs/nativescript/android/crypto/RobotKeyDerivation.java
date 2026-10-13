package com.ajaxjs.nativescript.android.crypto;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.Base64;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Robot key v1: RFC 5869 HKDF-SHA256, fixed public salt/info, 32-byte output.
 * Pure derivation does not access Keystore; returned Base64 is secret material.
 */
public final class RobotKeyDerivation {
    private RobotKeyDerivation() {
    }

    /**
     * Accepts exactly 12 hex digits or six pairs separated consistently by ':' or '-'.
     * Returns lowercase separator-free MAC, preserving leading zeros; never trims input.
     * @throws IllegalArgumentException Invalid MAC, whitespace, mixed separators or null.
     */
    public static String normalizeMac(String mac) {
        if (mac == null || !mac.matches("(?i)(?:[0-9a-f]{12}|[0-9a-f]{2}(?::[0-9a-f]{2}){5}|[0-9a-f]{2}(?:-[0-9a-f]{2}){5})"))
            throw new IllegalArgumentException("Robot MAC must contain exactly six hexadecimal bytes.");
        return mac.replace(":", "").replace("-", "").toLowerCase(Locale.ROOT);
    }

    /**
     * masterKeyBase64: canonical standard Base64 of a random 16/24/32-byte master key.
     * robotMac: stable robot MAC accepted by normalizeMac. No password stretching.
     * Returns canonical Base64 of the 32-byte device key; same inputs always match.
     * @throws IllegalArgumentException Invalid MAC, encoding or master key length.
     * @throws GeneralSecurityException HMAC provider failure.
     */
    public static String deriveKey(String masterKeyBase64, String robotMac) throws GeneralSecurityException {
        String mac = normalizeMac(robotMac);
        if (masterKeyBase64 == null || !masterKeyBase64.matches("(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?"))
            throw new IllegalArgumentException("Master key must use canonical standard Base64.");
        byte[] master = Base64.getDecoder().decode(masterKeyBase64);
        byte[] derived = null;
        try {
            if ((master.length != 16 && master.length != 24 && master.length != 32)
                    || !Base64.getEncoder().encodeToString(master).equals(masterKeyBase64))
                throw new IllegalArgumentException("Master key must be 16, 24, or 32 bytes in canonical Base64.");
            derived = hkdf(master, "ajaxjs/robot/key-derivation/v2".getBytes(StandardCharsets.UTF_8),
                    mac.getBytes(StandardCharsets.UTF_8), 32);
            return Base64.getEncoder().encodeToString(derived);
        } finally {
            Arrays.fill(master, (byte) 0);
            if (derived != null)
                Arrays.fill(derived, (byte) 0);
        }
    }

    /**
     * Derives v1 key and imports it into Keystore under alias without returning key material.
     * alias: nonblank, <=128 UTF-16 units, must not exist. Other parameters match deriveKey.
     * @throws IllegalArgumentException Invalid input.
     * @throws IllegalStateException Duplicate alias.
     * @throws GeneralSecurityException Derivation or Keystore failure.
     * @throws IOException Keystore load failure.
     */
    public static void deriveAndImportKey(String alias, String masterKeyBase64, String robotMac)
            throws GeneralSecurityException, IOException {
        AesKeyStore.validateAlias(alias);
        AesKeyStore.importKey(alias, deriveKey(masterKeyBase64, robotMac));
    }

    /**
     * RFC 5869 extract and expand; package-private for standard known-answer tests.
     */
    static byte[] hkdf(byte[] ikm, byte[] salt, byte[] info, int length) throws GeneralSecurityException {
        if (length < 1 || length > 255 * 32)
            throw new IllegalArgumentException("Invalid HKDF output length.");
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = hmac.doFinal(ikm);
        byte[] previous = new byte[0];
        byte[] output = new byte[length];
        try {
            hmac.init(new SecretKeySpec(prk, "HmacSHA256"));
            int offset = 0;
            for (int counter = 1; offset < length; counter++) {
                hmac.update(previous);
                hmac.update(info);
                hmac.update((byte) counter);
                Arrays.fill(previous, (byte) 0);
                previous = hmac.doFinal();
                int count = Math.min(previous.length, length - offset);
                System.arraycopy(previous, 0, output, offset, count);
                offset += count;
            }
            return output;
        } finally {
            Arrays.fill(prk, (byte) 0);
            Arrays.fill(previous, (byte) 0);
        }
    }
}
