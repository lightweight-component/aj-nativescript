import UIKit;
import os.log;

/**
 * 非模态 Toast：负责窗口选择、提示布局及自动关闭，所有视图状态只在主线程访问。
 */
final class AppToast {
    private static let logger: Logger = Logger(subsystem: "com.ajaxjs.nativescript.ios", category: "Toast");

    /**
     * 当前显示的非模态提示；仅在主线程访问。
     */
    private static var toastView: UIView?;

    /**
     * 当前提示的关闭任务；新提示到来时取消旧任务。
     */
    private static var toastDismissTask: DispatchWorkItem?;

    /**
     * 在当前活动窗口显示轻量 Toast，两秒后自动消失，不阻挡触摸操作。
     * - Parameter message: 要显示的提示内容。
     * - Returns: 无；连续调用会替换旧提示，并重新计算显示时间。
     */
    static func show(_ message: String) {
        /**
         * 忽略空白提示，避免出现只有背景的小方块，也不打断已有提示。
         */
        guard !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return;
        }

        /**
         * NativeScript 或原生回调可能来自不同线程，窗口查找和视图操作统一进入主线程。
         */
        DispatchQueue.main.async {
            let windows: [UIWindow] = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.filter { $0.activationState == .foregroundActive }.flatMap { $0.windows };
            guard let window: UIWindow = windows.first(where: { $0.isKeyWindow && !$0.isHidden }) ?? windows.first(where: { !$0.isHidden && $0.alpha > 0 && $0.windowLevel == .normal }) else {
                self.logger.warning("Cannot show Toast: no active window.");
                return;
            }

            self.toastDismissTask?.cancel();
            self.toastView?.removeFromSuperview();

            let toast: UIView = UIView();
            toast.translatesAutoresizingMaskIntoConstraints = false;
            toast.backgroundColor = UIColor.black.withAlphaComponent(0.8);
            toast.layer.cornerRadius = 10;
            /**
             * 不使用模态弹窗；触摸穿过提示，底下的按钮和页面仍可操作。
             */
            toast.isUserInteractionEnabled = false;

            let label: UILabel = UILabel();
            label.translatesAutoresizingMaskIntoConstraints = false;
            label.text = message;
            label.textColor = .white;
            label.font = UIFont.systemFont(ofSize: 14);
            label.textAlignment = .center;
            label.numberOfLines = 0;
            toast.addSubview(label);

            /**
             * 直接添加到窗口，不依赖 rootViewController.present，已有弹窗时也能显示。
             */
            window.addSubview(toast);
            /**
             * 默认距底部安全区域 64 点；键盘出现时，优先保证提示在键盘上方。
             */
            let preferredBottom: NSLayoutConstraint = toast.bottomAnchor.constraint(equalTo: window.safeAreaLayoutGuide.bottomAnchor, constant: -64);
            preferredBottom.priority = .defaultHigh;
            NSLayoutConstraint.activate([
                toast.centerXAnchor.constraint(equalTo: window.safeAreaLayoutGuide.centerXAnchor),
                preferredBottom,
                toast.bottomAnchor.constraint(lessThanOrEqualTo: window.keyboardLayoutGuide.topAnchor, constant: -16),
                toast.widthAnchor.constraint(lessThanOrEqualTo: window.safeAreaLayoutGuide.widthAnchor, constant: -48),
                toast.widthAnchor.constraint(lessThanOrEqualToConstant: 360),
                label.leadingAnchor.constraint(equalTo: toast.leadingAnchor, constant: 16),
                label.trailingAnchor.constraint(equalTo: toast.trailingAnchor, constant: -16),
                label.topAnchor.constraint(equalTo: toast.topAnchor, constant: 12),
                label.bottomAnchor.constraint(equalTo: toast.bottomAnchor, constant: -12)
            ]);
            self.toastView = toast;

            let dismissTask: DispatchWorkItem = DispatchWorkItem { [weak toast] in
                /**
                 * 即使旧任务已进入队列，也只允许关闭它对应的提示，不能误删新提示。
                 */
                guard let toast: UIView = toast, self.toastView === toast else {
                    return;
                }

                toast.removeFromSuperview();
                self.toastView = nil;
                self.toastDismissTask = nil;
            };
            self.toastDismissTask = dismissTask;
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0, execute: dismissTask);
        };
    }
}
