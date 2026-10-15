package com.ajaxjs.nativescript.android.storage;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * 应用级字符串安全存储，独立于机器人 AES 密钥。
 * 本机 AES-256 密钥留在 AndroidKeyStore；带版本的 GCM 密文通过 AtomicFile 保存至 noBackupFilesDir。
 * 所有入口进程内串行；不支持多进程并发写入。异常不包含凭据、逻辑键名或文件内容。
 */
public final class SecureStorage {
    private static final String ALIAS = "com.ajaxjs.nativescript.common.secure-storage.v1";

    private static final int MAX_BYTES = 65536;

    private SecureStorage() {
    }

    /**
     * 写入或覆盖 UTF-8 字符串，允许空值，最多 65536 UTF-8 字节；返回时已提交到文件。
     * key 为非空白、最多 128 UTF-16 单元的字符串，保留大小写及空格；context 不得为空。
     * 存储、密钥或加密失败抛出 IllegalStateException，不自动清除旧数据或重建丢失密钥。
     */
    public static synchronized void setItem(Context context, String key, String value) {
        validate(key, value, true);
        byte[] plaintext = value.getBytes(StandardCharsets.UTF_8);

        try {
            File directory = directory(context);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, loadKey(directory, true));
            cipher.updateAAD(aad(key));
            byte[] encrypted = cipher.doFinal(plaintext);
            byte[] nonce = cipher.getIV();

            if (nonce.length != 12)
                throw new IllegalStateException();

            byte[] record = ByteBuffer.allocate(1 + 12 + encrypted.length).put((byte) 1).put(nonce).put(encrypted).array();
            AtomicFile file = new AtomicFile(file(directory, key));
            FileOutputStream output = null;

            try {
                output = file.startWrite();
                output.write(record);
                file.finishWrite(output);
            } catch (Exception error) {
                file.failWrite(output);
                throw error;
            }
        } catch (Exception error) {
            throw failure("write");
        } finally {
            Arrays.fill(plaintext, (byte) 0);
        }
    }

    /**
     * 读取原始字符串；不存在返回 null，空字符串仍返回空字符串。
     * 损坏、认证失败或密钥失效抛出 IllegalStateException，不能当作不存在或返回未认证明文。
     */
    public static synchronized String getItem(Context context, String key) {
        validate(key, null, false);
        byte[] plaintext = null;

        try {
            File directory = directory(context);
            File base = file(directory, key);

            if (!base.exists() && !new File(base.getPath() + ".bak").exists())
                return null;

            byte[] record = new AtomicFile(base).readFully();

            if (record.length < 29 || record.length > MAX_BYTES + 29 || record[0] != 1)
                throw new IllegalStateException();

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, loadKey(directory, false), new GCMParameterSpec(128, Arrays.copyOfRange(record, 1, 13)));
            cipher.updateAAD(aad(key));
            plaintext = cipher.doFinal(record, 13, record.length - 13);

            return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(plaintext)).toString();
        } catch (Exception error) {
            throw failure("read");
        } finally {
            if (plaintext != null)
                Arrays.fill(plaintext, (byte) 0);
        }
    }

    /**
     * 幂等删除对应密文；不存在也成功，不删除共享本机密钥或其他存储项。
     * 删除失败抛出 IllegalStateException；不承诺闪存物理安全擦除。
     */
    public static synchronized void removeItem(Context context, String key) {
        validate(key, null, false);

        try {
            File base = file(directory(context), key);
            new AtomicFile(base).delete();

            if (base.exists() || new File(base.getPath() + ".bak").exists() || new File(base.getPath() + ".new").exists())
                throw new IllegalStateException();
        } catch (Exception error) {
            throw failure("delete");
        }
    }

    private static SecretKey loadKey(File directory, boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);

        if (store.containsAlias(ALIAS))
            return (SecretKey) store.getKey(ALIAS, null);

        String[] existing = directory.list();

        if (!create || existing == null || existing.length != 0)
            throw new IllegalStateException();

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build());

        return generator.generateKey();
    }

    private static File directory(Context context) {
        if (context == null)
            throw new IllegalArgumentException("Secure storage requires an application context.");

        File result = new File(context.getNoBackupFilesDir(), "ajaxjs-secure-storage-v1");

        if (!result.isDirectory() && !result.mkdirs())
            throw new IllegalStateException();

        return result;
    }

    private static File file(File directory, String key) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder();

        for (byte item : digest)
            name.append(String.format(java.util.Locale.ROOT, "%02x", item & 255));

        return new File(directory, name + ".bin");
    }

    private static byte[] aad(String key) {
        return (ALIAS + ":" + key).getBytes(StandardCharsets.UTF_8);
    }

    private static void validate(String key, String value, boolean writing) {
        if (key == null || key.trim().isEmpty() || key.length() > 128 || !validUnicode(key))
            throw new IllegalArgumentException("Secure storage key must be nonblank, valid Unicode and at most 128 UTF-16 units.");

        if (writing && (value == null || !validUnicode(value) || value.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES))
            throw new IllegalArgumentException("Secure storage value must be valid Unicode and at most 65536 UTF-8 bytes.");
    }

    private static boolean validUnicode(String value) {
        for (int index = 0; index < value.length(); index++) {
            char item = value.charAt(index);

            if (Character.isHighSurrogate(item)) {
                if (++index >= value.length() || !Character.isLowSurrogate(value.charAt(index)))
                    return false;
            } else if (Character.isLowSurrogate(item))
                return false;
        }

        return true;
    }

    private static IllegalStateException failure(String operation) {
        return new IllegalStateException("Secure storage " + operation + " failed; data or device key may be unavailable.");
    }
}
