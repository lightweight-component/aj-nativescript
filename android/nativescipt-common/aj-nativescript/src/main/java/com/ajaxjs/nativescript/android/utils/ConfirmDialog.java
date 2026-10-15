package com.ajaxjs.nativescript.android.utils;

import android.app.Activity;
import android.app.Application;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;

/**
 * 自定义原生确认框，无 XML 或 AndroidX 依赖，所有界面及回调均在主线程执行。
 */
public final class ConfirmDialog {
    private ConfirmDialog() {
    }

    /**
     * 单次完成回调；onResult 和 onError 最多执行其中一个一次。
     */
    public interface Callback {
        /**
         * 确认返回 true；取消、返回键、允许的蒙层点击或宿主停止/销毁返回 false。
         */
        void onResult(boolean confirmed);

        /**
         * JSON、颜色或显示错误；message 不包含传入的正文内容。
         */
        void onError(String message);
    }

    /**
     * 显示确认框；无可用 Activity 时返回 false，显示或参数错误走 onError。
     * optionsJson 使用统一 TS 配置字段，颜色为 #AARRGGBB，默认文案为中文。
     * position 为正文 Gravity，不控制窗口位置。maskClosable 默认 false，返回键仍可取消。
     * Java 调用方应持有有效前台 Activity，并避免同时显示多个确认框；TS 层按顺序排队。
     *
     * @param activity 当前页面 Activity，可为空。
     * @param optionsJson 含 message 的 JSON 对象；title、按钮文字、颜色及对齐方式可选。
     * @param callback 非空单次结果回调。
     * @throws IllegalArgumentException callback 为空时同步抛出。
     */
    public static void show(Activity activity, String optionsJson, Callback callback) {
        if (callback == null)
            throw new IllegalArgumentException("Confirm callback is required.");

        Runnable action = () -> showOnMain(activity, optionsJson, callback);

        if (Looper.myLooper() == Looper.getMainLooper())
            action.run();
        else
            new Handler(Looper.getMainLooper()).post(action);
    }

    /**
     * 主线程创建布局，并通过 dismiss 统一结算所有正常关闭路径。
     */
    private static void showOnMain(Activity activity, String optionsJson, Callback callback) {
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            callback.onResult(false);
            return;
        }

        Completion completion = new Completion(activity, callback);

        try {
            JSONObject options = new JSONObject(optionsJson);
            String message = options.getString("message");
            float density = activity.getResources().getDisplayMetrics().density;
            int padding = Math.round(32 * density);
            LinearLayout root = new LinearLayout(activity);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setPadding(padding, padding, padding, padding);
            root.setBackground(background(Color.WHITE, 16 * density));

            TextView title = new TextView(activity);
            title.setText(options.optString("title", "提示"));
            title.setTextSize(17);
            title.setTextColor(Color.rgb(51, 51, 51));
            title.setGravity(Gravity.CENTER);

            if (Build.VERSION.SDK_INT >= 28)
                title.setAccessibilityHeading(true);

            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2);
            titleParams.bottomMargin = Math.round(16 * density);
            root.addView(title, titleParams);

            int maxHeight = (int) (activity.getResources().getDisplayMetrics().heightPixels * 0.45);
            ScrollView scroll = new ScrollView(activity) {
                @Override
                protected void onMeasure(int widthSpec, int heightSpec) {
                    super.onMeasure(widthSpec, View.MeasureSpec.makeMeasureSpec(maxHeight, View.MeasureSpec.AT_MOST));
                }
            };
            TextView body = new TextView(activity);
            body.setText(message);
            body.setTextSize(15);
            body.setTextColor(Color.rgb(102, 102, 102));
            body.setGravity(messageGravity(options.optString("position", "CENTER")));
            scroll.addView(body, new ScrollView.LayoutParams(-1, -2));
            LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(-1, -2);
            messageParams.bottomMargin = Math.round(32 * density);
            root.addView(scroll, messageParams);

            LinearLayout buttons = new LinearLayout(activity);
            buttons.setOrientation(LinearLayout.HORIZONTAL);
            root.addView(buttons, new LinearLayout.LayoutParams(-1, -2));
            Button cancel = button(activity, options.optString("cancelText", "取消"),
                    options.optString("cancelColor", "#FFE2E2E2"), options.optString("cancelTextColor", "#FF333333"));
            Button ok = button(activity, options.optString("okText", "确认"),
                    options.optString("okColor", "#FF71A3DF"), options.optString("okTextColor", "#FFFFFFFF"));
            LinearLayout.LayoutParams cancelParams = new LinearLayout.LayoutParams(0, Math.round(44 * density), 1);
            cancelParams.rightMargin = Math.round(8 * density);
            LinearLayout.LayoutParams okParams = new LinearLayout.LayoutParams(0, Math.round(44 * density), 1);
            okParams.leftMargin = Math.round(8 * density);
            buttons.addView(cancel, cancelParams);
            buttons.addView(ok, okParams);

            Dialog dialog = new Dialog(activity);
            completion.dialog = dialog;
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            dialog.setContentView(root);
            dialog.setCancelable(true);
            dialog.setCanceledOnTouchOutside(options.optBoolean("maskClosable", false));
            dialog.setOnDismissListener(value -> completion.result());
            cancel.setOnClickListener(value -> dialog.dismiss());
            ok.setOnClickListener(value -> {
                completion.confirmed = true;
                dialog.dismiss();
            });
            activity.getApplication().registerActivityLifecycleCallbacks(completion);
            completion.registered = true;
            dialog.show();
            Window window = dialog.getWindow();

            if (window != null) {
                window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
                int hostWidth = activity.getWindow().getDecorView().getWidth();
                if (hostWidth == 0)
                    hostWidth = activity.getResources().getDisplayMetrics().widthPixels;
                window.setLayout(Math.min((int) (hostWidth * 0.8), Math.round(420 * density)), -2);
                window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
                WindowManager.LayoutParams attributes = window.getAttributes();
                attributes.dimAmount = 0.35f;
                window.setAttributes(attributes);
            }
        } catch (Exception error) {
            completion.error(error);
        }
    }

    /**
     * 保留原组件 position 对正文 Gravity 的含义，未知值使用居中。
     */
    private static int messageGravity(String position) {
        switch (position) {
            case "LEFT": return Gravity.LEFT;
            case "RIGHT": return Gravity.RIGHT;
            case "TOP": return Gravity.TOP;
            case "BOTTOM": return Gravity.BOTTOM;
            default: return Gravity.CENTER;
        }
    }

    /**
     * 生成无系统按钮阴影、等宽的圆角按钮。
     */
    private static Button button(Activity activity, String text, String color, String textColor) {
        Button button = new Button(activity);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(Color.parseColor(textColor));
        button.setPadding(0, 0, 0, 0);
        button.setMinWidth(0);
        button.setMinimumWidth(0);
        button.setMinHeight(0);
        button.setMinimumHeight(0);
        button.setElevation(0);
        button.setStateListAnimator(null);
        button.setBackground(background(Color.parseColor(color), 100 * activity.getResources().getDisplayMetrics().density));

        return button;
    }

    /**
     * 创建纯色圆角背景。
     */
    private static GradientDrawable background(int color, float radius) {
        GradientDrawable result = new GradientDrawable();
        result.setColor(color);
        result.setCornerRadius(radius);
        return result;
    }

    /**
     * 绑定宿主生命周期并保证单次回调，完成后解除 Activity 与回调的注册关系。
     */
    private static final class Completion implements Application.ActivityLifecycleCallbacks {
        private final Activity activity;
        private final Callback callback;
        private Dialog dialog;
        private boolean registered;
        private boolean confirmed;
        private boolean finished;

        private Completion(Activity activity, Callback callback) {
            this.activity = activity;
            this.callback = callback;
        }

        private void result() {
            if (finished)
                return;

            finished = true;
            cleanup();
            callback.onResult(confirmed);
        }

        private void error(Exception error) {
            if (finished)
                return;

            finished = true;
            cleanup();

            if (dialog != null && dialog.isShowing())
                dialog.dismiss();

            callback.onError("Unable to show native confirm: " + error.getClass().getSimpleName());
        }

        private void cleanup() {
            if (registered) {
                activity.getApplication().unregisterActivityLifecycleCallbacks(this);
                registered = false;
            }
        }

        @Override
        public void onActivityStopped(Activity value) {
            if (value == activity && dialog != null && !finished)
                dialog.dismiss();
        }

        @Override
        public void onActivityDestroyed(Activity value) {
            if (value == activity && !finished) {
                if (dialog != null)
                    dialog.dismiss();
                result();
            }
        }

        @Override
        public void onActivityCreated(Activity value, Bundle state) {
        }

        @Override
        public void onActivityStarted(Activity value) {
        }

        @Override
        public void onActivityResumed(Activity value) {
        }

        @Override
        public void onActivityPaused(Activity value) {
        }

        @Override
        public void onActivitySaveInstanceState(Activity value, Bundle state) {
        }
    }
}
