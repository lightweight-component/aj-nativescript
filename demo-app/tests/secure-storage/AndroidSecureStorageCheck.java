package com.ajaxjs.secure.check;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.File;
import java.io.FileOutputStream;

/**
 * 仅用于模拟器的独立 Instrumentation 驱动，操作现有 NativeScript demo，不实现替代 App。
 */
public final class AndroidSecureStorageCheck extends Instrumentation {
    @Override
    public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        start();
    }

    @Override
    public void onStart() {
        Bundle result = new Bundle();
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName("org.nativescript.nsvuevitedemo", "com.tns.NativeScriptActivity"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            openPage();
            click("运行安全存储自检");
            waitText("SECURE_STORAGE_SELF_CHECK:PASS");
            pass("原生自检及临时数据清理");
            click("写入重启测试数据");
            waitText("SECURE_STORAGE_RESTART:READY");
            pass("写入持久化数据");
            getUiAutomation().executeShellCommand("am force-stop org.nativescript.nsvuevitedemo").close();
            SystemClock.sleep(1000);
            getContext().startActivity(intent);
            openPage();
            click("验证重启后数据并清理");
            waitText("SECURE_STORAGE_RESTART:PASS:CLEANED");
            getUiAutomation().waitForIdle(500, 3000);
            SystemClock.sleep(500);
            screenshot("android-secure-storage.png");
            pass("重启后读取及删除");
            result.putString("stream", "SECURE_STORAGE_NATIVE_UI:PASS:3 checks\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("stream", "SECURE_STORAGE_NATIVE_UI:FAIL:" + error + "\n");
            finish(Activity.RESULT_CANCELED, result);
        }
    }

    private void openPage() throws Exception {
        click("TESTS");
        click("安全存储测试");
        waitText("运行安全存储自检");
    }

    /**
     * 读取真实无障碍树等待界面变化，禁止直接执行 JS 或调用业务回调。
     */
    private AccessibilityNodeInfo waitText(String text) {
        return waitText(text, false);
    }

    private AccessibilityNodeInfo waitText(String text, boolean exact) {
        long deadline = SystemClock.uptimeMillis() + 15000;
        do {
            AccessibilityNodeInfo node = find(getUiAutomation().getRootInActiveWindow(), text, exact);
            if (node != null)
                return node;
            SystemClock.sleep(100);
        } while (SystemClock.uptimeMillis() < deadline);
        throw new AssertionError("Missing UI text: " + text);
    }

    private AccessibilityNodeInfo find(AccessibilityNodeInfo node, String text, boolean exact) {
        if (node == null)
            return null;
        if (node.isVisibleToUser() && node.getText() != null
                && (exact ? node.getText().toString().equals(text) : node.getText().toString().contains(text)))
            return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo match = find(node.getChild(i), text, exact);
            if (match != null)
                return match;
        }
        return null;
    }

    /**
     * 按真实控件屏幕坐标发送触摸事件，覆盖原生 OnClick 与 Dialog 关闭路径。
     */
    private void click(String text) throws Exception {
        AccessibilityNodeInfo node = waitText(text, true);
        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        tap(bounds.centerX(), bounds.centerY());
    }

    private void tap(int x, int y) throws Exception {
        long down = SystemClock.uptimeMillis();
        for (int action : new int[] { MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP }) {
            MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
            event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            getUiAutomation().injectInputEvent(event, true);
            event.recycle();
        }
        getUiAutomation().waitForIdle(100, 3000);
    }

    private void screenshot(String name) throws Exception {
        Bitmap image = getUiAutomation().takeScreenshot();
        File file = new File(getContext().getExternalFilesDir(null), name);
        try (FileOutputStream output = new FileOutputStream(file)) {
            image.compress(Bitmap.CompressFormat.PNG, 100, output);
        }
        image.recycle();
    }

    private void pass(String name) {
        Bundle update = new Bundle();
        update.putString("stream", "SECURE_STORAGE_NATIVE_UI:PASS:" + name + "\n");
        sendStatus(0, update);
    }
}
