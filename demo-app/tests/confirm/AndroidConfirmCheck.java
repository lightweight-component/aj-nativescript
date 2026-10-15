package com.ajaxjs.confirm.check;

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
public final class AndroidConfirmCheck extends Instrumentation {
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
            click("TESTS");
            click("原生 Confirm 测试");
            waitText("默认 Confirm");

            click("默认 Confirm");
            click("确认");
            waitText("默认:RESULT:true:AFTER:1");
            pass("确认及 await 后代码");
            click("默认 Confirm");
            click("取消");
            waitText("默认:RESULT:false:AFTER:2");
            pass("取消返回 false");

            click("自定义配色与文案");
            waitText("左对齐第一行");
            screenshot("android-custom.png");
            click("继续");
            waitText("自定义:RESULT:true:AFTER:3");
            pass("配色文案及 Unicode");

            click("蒙层可关闭");
            waitText("点击卡片外的蒙层应返回 false。");
            tap(5, 200);
            waitText("蒙层可关闭:RESULT:false:AFTER:4");
            pass("蒙层取消");

            click("蒙层不可关闭");
            waitText("点击蒙层不会关闭");
            tap(5, 200);
            waitText("点击蒙层不会关闭");
            long backTime = SystemClock.uptimeMillis();
            for (int action : new int[] { KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP }) {
                KeyEvent key = new KeyEvent(backTime, SystemClock.uptimeMillis(), action, KeyEvent.KEYCODE_BACK, 0);
                if (!getUiAutomation().injectInputEvent(key, true))
                    throw new AssertionError("Unable to inject back key");
            }
            waitText("蒙层不可关闭:RESULT:false:AFTER:5");
            pass("蒙层不关闭及返回键取消");

            click("长正文（可滚动）");
            waitText("长正文测试");
            screenshot("android-long.png");
            click("确认");
            waitText("长正文:RESULT:true:AFTER:6");
            pass("长正文按钮可见");

            click("连续两个弹窗");
            waitText("队列 1");
            click("取消");
            waitText("队列 2");
            click("确认");
            waitText("队列:RESULT:false,true:AFTER:7");
            waitText("完成回调 8 | await 后代码 7");
            pass("并发队列与单次回调");
            click("无效配色错误");
            waitText("错误:ERROR:");
            waitText("完成回调 8 | await 后代码 7");
            pass("错误拒绝且不产生成功回调");
            click("默认 Confirm");
            waitText("默认确认：继续操作吗？");
            if (!getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME))
                throw new AssertionError("Unable to navigate home");
            getUiAutomation().waitForIdle(1000, 5000);
            SystemClock.sleep(1500);
            getContext().startActivity(intent);
            waitText("默认:RESULT:false:AFTER:8");
            waitText("完成回调 9 | await 后代码 8");
            pass("宿主进入后台后单次取消");
            result.putString("stream", "CONFIRM_NATIVE_UI:PASS:9 checks\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("stream", "CONFIRM_NATIVE_UI:FAIL:" + error + "\n");
            finish(Activity.RESULT_CANCELED, result);
        }
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
        update.putString("stream", "CONFIRM_NATIVE_UI:PASS:" + name + "\n");
        sendStatus(0, update);
    }
}
