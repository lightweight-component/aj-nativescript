package com.ajaxjs.nativescript.android.crypto;

import android.security.keystore.KeyProperties;
import android.security.keystore.KeyProtection;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

/**
 * Android Keystore AES 密钥管理，不提供密钥导出接口。最低 Android 8.0。
 */
public final class AesKeyStore {
    private AesKeyStore() {
    }

    static void validateAlias(String alias) {
        if (alias == null || alias.trim().isEmpty() || alias.length() > 128)
            throw new IllegalArgumentException("Key alias must contain 1 to 128 characters.");
    }

    private static KeyStore open() throws GeneralSecurityException, IOException {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);

        return store;
    }

    /**
     * 将标准 Base64 AES 密钥导入 Android Keystore；已有别名拒绝覆盖，轮换时使用新别名。原始密钥暂时经过内存，请勿记录日志或持久化。
     *
     * @param alias     非空白密钥别名，最多 128 个字符。
     * @param keyBase64 标准 Base64 编码的密钥，解码后必须为 16、24 或 32 字节。
     * @throws GeneralSecurityException Keystore 或密码算法操作失败。
     * @throws IOException              Keystore 加载失败。
     * @throws IllegalArgumentException 入参格式或长度无效。
     * @throws IllegalStateException    密钥别名已存在。
     */
    public static synchronized void importKey(String alias, String keyBase64) throws GeneralSecurityException, IOException {
        validateAlias(alias);
        if (keyBase64 == null)
            throw new IllegalArgumentException("AES key is required.");

        byte[] bytes = Base64.getDecoder().decode(keyBase64);

        try {
            if (bytes.length != 16 && bytes.length != 24 && bytes.length != 32)
                throw new IllegalArgumentException("AES key must be 16, 24, or 32 bytes.");

            KeyStore store = open();

            if (store.containsAlias(alias))
                throw new IllegalStateException("Key alias already exists; use a new versioned alias.");

            KeyProtection protection = new KeyProtection.Builder(
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build();
            store.setEntry(alias, new KeyStore.SecretKeyEntry(new SecretKeySpec(bytes, "AES")), protection);
        } finally {
            Arrays.fill(bytes, (byte) 0);
        }
    }

    /**
     * 检查指定别名是否存在；存在不保证后续加解密成功。
     *
     * @param alias 非空白密钥别名，最多 128 个字符。
     * @return 存在为 true，否则为 false。
     * @throws GeneralSecurityException Keystore 或密码算法操作失败。
     * @throws IOException              Keystore 加载失败。
     * @throws IllegalArgumentException 入参格式或长度无效。
     */
    public static synchronized boolean hasKey(String alias) throws GeneralSecurityException, IOException {
        validateAlias(alias);

        return open().containsAlias(alias);
    }

    /**
     * 删除密钥；不存在时不执行操作。删除后旧密文需重新导入相同密钥才能解密。
     *
     * @param alias 非空白密钥别名，最多 128 个字符。
     * @throws GeneralSecurityException Keystore 或密码算法操作失败。
     * @throws IOException              Keystore 加载失败。
     * @throws IllegalArgumentException 入参格式或长度无效。
     */
    public static synchronized void deleteKey(String alias) throws GeneralSecurityException, IOException {
        validateAlias(alias);
        open().deleteEntry(alias);
    }

    static SecretKey loadKey(String alias) throws GeneralSecurityException, IOException {
        validateAlias(alias);
        java.security.Key key = open().getKey(alias, null);

        if (!(key instanceof SecretKey) || !"AES".equals(key.getAlgorithm()))
            throw new IllegalStateException("AES key was not found in Android Keystore.");

        return (SecretKey) key;
    }
}
