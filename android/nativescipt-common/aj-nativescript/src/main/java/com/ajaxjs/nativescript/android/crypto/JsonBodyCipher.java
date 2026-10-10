package com.ajaxjs.nativescript.android.crypto;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * 使用 Keystore 中的 AES 密钥加解密 UTF-8 消息体；JSON 序列化由调用方负责。
 */
public final class JsonBodyCipher {
    private JsonBodyCipher() {
    }

    /**
     * 使用 Keystore AES 密钥加密 UTF-8 文本；AES/GCM/NoPadding，每次生成新的 12 字节 nonce。不验证文本是否为 JSON。
     *
     * @param alias     已导入的 AES 密钥别名，非空白且最多 128 个字符。
     * @param plaintext 待加密文本，不能为 null；允许空字符串。
     * @return 包含 Base64 nonce 和密文及 16 字节认证标签的消息体。
     * @throws GeneralSecurityException Keystore 或密码算法操作失败。
     * @throws IOException              Keystore 加载失败。
     * @throws IllegalArgumentException 入参格式或长度无效。
     * @throws IllegalStateException    对应 AES 密钥不存在。
     */
    public static EncryptedBody encrypt(String alias, String plaintext) throws GeneralSecurityException, IOException {
        return encryptWithKey(AesKeyStore.loadKey(alias), plaintext);
    }

    /**
     * 验证 GCM 认证标签并解密 UTF-8 文本；认证失败不返回明文。
     *
     * @param alias       已导入的 AES 密钥别名，非空白且最多 128 个字符。
     * @param nonceBase64 标准 Base64 nonce，解码后必须为 12 字节。
     * @param dataBase64  标准 Base64 密文及认证标签，解码后至少为 16 字节。
     * @return 解密后的 UTF-8 文本，不进行 JSON 解析。
     * @throws GeneralSecurityException Keystore 或密码算法操作失败。
     * @throws IOException              Keystore 加载失败。
     * @throws IllegalArgumentException 入参格式或长度无效。
     * @throws IllegalStateException    对应 AES 密钥不存在。
     */
    public static String decrypt(String alias, String nonceBase64, String dataBase64) throws GeneralSecurityException, IOException {
        return decryptWithKey(AesKeyStore.loadKey(alias), nonceBase64, dataBase64);
    }

    static EncryptedBody encryptWithKey(SecretKey key, String plaintext) throws GeneralSecurityException {
        if (plaintext == null)
            throw new IllegalArgumentException("Plaintext is required.");

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

        if (cipher.getIV().length != 12)
            throw new GeneralSecurityException("Expected a 12-byte GCM nonce.");

        return new EncryptedBody(Base64.getEncoder().encodeToString(cipher.getIV()), Base64.getEncoder().encodeToString(ciphertext));
    }

    static String decryptWithKey(SecretKey key, String nonceBase64, String dataBase64) throws GeneralSecurityException {
        if (nonceBase64 == null || dataBase64 == null)
            throw new IllegalArgumentException("Nonce and ciphertext are required.");

        byte[] nonce = Base64.getDecoder().decode(nonceBase64);
        byte[] ciphertext = Base64.getDecoder().decode(dataBase64);

        if (nonce.length != 12 || ciphertext.length < 16)
            throw new IllegalArgumentException("Invalid GCM nonce or ciphertext length.");

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, nonce));

        return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
    }
}
