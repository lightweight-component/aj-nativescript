package com.ajaxjs.secure.check;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import com.ajaxjs.nativescript.android.storage.SecureStorage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;

/**
 * 在现有 demo 的 UID 与进程中检查真实密文，仅读写专属的公开测试项，不操作其他凭据。
 */
public final class AndroidSecureStorageNativeCheck extends Instrumentation {
    @Override
    public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        start();
    }

    @Override
    public void onStart() {
        Context context = getTargetContext();
        String first = "demo.native-secure-check.first";
        String second = "demo.native-secure-check.second";
        String publicValue = "PUBLIC-NATIVE-TEST-ONLY-token-1234567890";
        Bundle result = new Bundle();
        try {
            SecureStorage.setItem(context, first, publicValue);
            File file = location(context, first);
            byte[] original = Files.readAllBytes(file.toPath());
            require(!new String(original, StandardCharsets.ISO_8859_1).contains(publicValue));
            require(file.getCanonicalPath().startsWith(context.getNoBackupFilesDir().getCanonicalPath() + File.separator));
            SecureStorage.setItem(context, first, publicValue);
            byte[] repeated = Files.readAllBytes(file.toPath());
            require(!Arrays.equals(Arrays.copyOfRange(original, 1, 13), Arrays.copyOfRange(repeated, 1, 13)));
            report("密文不含明文、位于 no_backup、重复写入 nonce 不同");

            byte[] tampered = repeated.clone();
            tampered[tampered.length - 1] ^= 1;
            Files.write(file.toPath(), tampered);
            rejects(() -> SecureStorage.getItem(context, first));
            Files.write(file.toPath(), repeated);
            require(publicValue.equals(SecureStorage.getItem(context, first)));
            report("认证标签篡改拒绝且错误后可恢复");

            SecureStorage.setItem(context, second, "PUBLIC-SECOND-ONLY");
            File secondFile = location(context, second);
            byte[] secondOriginal = Files.readAllBytes(secondFile.toPath());
            Files.write(secondFile.toPath(), repeated);
            rejects(() -> SecureStorage.getItem(context, second));
            Files.write(secondFile.toPath(), secondOriginal);
            require("PUBLIC-SECOND-ONLY".equals(SecureStorage.getItem(context, second)));
            report("逻辑键名绑定 AAD、替换另一项密文被拒绝");

            Files.write(file.toPath(), new byte[] { 1, 2, 3 });
            rejects(() -> SecureStorage.getItem(context, first));
            report("截断密文报错而不是返回 null");
            result.putString("stream", "SECURE_STORAGE_NATIVE_SECURITY:PASS:4 checks\n");
        } catch (Throwable error) {
            result.putString("stream", "SECURE_STORAGE_NATIVE_SECURITY:FAIL:" + error.getClass().getSimpleName() + "\n");
        } finally {
            try {
                SecureStorage.removeItem(context, first);
                SecureStorage.removeItem(context, second);
                require(SecureStorage.getItem(context, first) == null && SecureStorage.getItem(context, second) == null);
            } catch (Throwable error) {
                result.putString("stream", "SECURE_STORAGE_NATIVE_SECURITY:FAIL:cleanup\n");
            }
        }
        finish(result.getString("stream").contains(":FAIL:") ? Activity.RESULT_CANCELED : Activity.RESULT_OK, result);
    }

    private static File location(Context context, String key) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder();
        for (byte item : digest)
            name.append(String.format(Locale.ROOT, "%02x", item & 255));
        return new File(new File(context.getNoBackupFilesDir(), "ajaxjs-secure-storage-v1"), name + ".bin");
    }

    private static void rejects(Runnable action) {
        try {
            action.run();
        } catch (IllegalStateException expected) {
            return;
        }
        throw new AssertionError("Unauthenticated data must fail");
    }

    private static void require(boolean value) {
        if (!value)
            throw new AssertionError("Native secure storage assertion failed");
    }

    private void report(String name) {
        Bundle update = new Bundle();
        update.putString("stream", "SECURE_STORAGE_NATIVE_SECURITY:PASS:" + name + "\n");
        sendStatus(0, update);
    }
}
