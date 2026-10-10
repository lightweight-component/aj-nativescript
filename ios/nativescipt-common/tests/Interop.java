package com.ajaxjs.nativescript.android.crypto;
import javax.crypto.spec.SecretKeySpec;

/**
 * Uses the production Android cipher on the JVM to generate and verify wire messages.
 * Arguments: key size, then optional nonce/data; prints nonce/data or decrypted UTF-8.
 */
public final class Interop {
    public static void main(String[] args) throws Exception {
        SecretKeySpec key = new SecretKeySpec(new byte[Integer.parseInt(args[0])], "AES");
        if (args.length == 3) {
            System.out.print(JsonBodyCipher.decryptWithKey(key, args[1], args[2]));
        } else {
            EncryptedBody body = JsonBodyCipher.encryptWithKey(key, "{\"message\":\"中文 🔐\",\"count\":1}");
            System.out.println(body.getNonce());
            System.out.println(body.getData());
        }
    }
}
