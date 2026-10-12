import UIKit;
import os.log;

@objc(AjaxJSIOSHelper)
@objcMembers
public final class Helper: NSObject {
    private static let logger: Logger = Logger(subsystem: "com.ajaxjs.nativescript.ios", category: "Helper");

    /**
     * 在当前活动窗口显示轻量 Toast，两秒后自动消失，不阻挡触摸操作。
     * - Parameter message: 要显示的提示内容；空白消息会忽略。
     * - Returns: 无；连续调用会替换旧提示，并重新计算显示时间。
     */
    public static func showToast(_ message: String) {
        AppToast.show(message);
    }

    /**
     * 获取应用的版本名称。
     * - Parameters: 无。
     * - Returns: `CFBundleShortVersionString`，读取失败时返回 `Unknown`。
     */
    public static func getAppVersionName() -> String {
        guard let version: String = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String else {
            logger.warning("Could not retrieve CFBundleShortVersionString from Info.plist.");

            return "Unknown";
        }

        return version;
    }

    /**
     * 获取应用的构建版本号。
     * - Parameters: 无。
     * - Returns: `CFBundleVersion`，读取失败时返回 `Unknown`。
     */
    public static func getAppBuildNumber() -> String {
        guard let build: String = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String else {
            logger.warning("Could not retrieve CFBundleVersion from Info.plist.");

            return "Unknown";
        }

        return build;
    }

    /**
     * 打开国内版 App Store 页面，保留原有单参数调用入口。
     * - Parameter appleID: App Store 中的应用数字 ID，不包含 `id` 前缀。
     * - Returns: 无；打开失败时尝试 HTTPS 链接。
     */
    public static func openAppInAppStore(_ appleID: String) {
        openAppInAppStore(appleID, isInternational: false);
    }

    /**
     * 根据国内版或国际版参数打开 App Store 页面。
     * - Parameters:
     * - appleID: 非空的 ASCII 数字应用 ID；国内版和国际版 ID 由调用方传入。
     * - isInternational: true 使用不限定地区的链接，false 使用中国区链接。
     * - Returns: 无；实际打开失败时尝试 HTTPS，最终失败记录日志。
     * NativeScript 调用名称为 openAppInAppStoreIsInternational(appleID, isInternational)。
     */
    @objc(openAppInAppStore:isInternational:)
    public static func openAppInAppStore(_ appleID: String, isInternational: Bool) {
        /**
         * 主线程调用直接执行；后台调用异步切回主线程，避免阻塞调用方。
         */
        guard Thread.isMainThread else {
            DispatchQueue.main.async { self.openAppInAppStore(appleID, isInternational: isInternational); };
            return;
        }

        guard !appleID.isEmpty && appleID.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else {
            logger.error("Cannot open App Store: appleID must contain only ASCII digits.");
            return;
        }

        let regionPath: String = isInternational ? "" : "/cn";
        guard let appStoreURL: URL = URL(string: "itms-apps://apps.apple.com\(regionPath)/app/id\(appleID)"),
         let webURL: URL = URL(string: "https://apps.apple.com\(regionPath)/app/id\(appleID)") else {
            logger.error("Cannot construct App Store URLs.");
            return;
        }

        logger.info("Opening App Store for app \(appleID), international=\(isInternational).");
        /**
         * 以 open 的实际结果为准；无需依赖 canOpenURL 的预检查。
         */
        UIApplication.shared.open(appStoreURL, options: [:]) { success in
            if !success {
                self.logger.info("Could not open itms-apps URL, trying HTTPS.");
                UIApplication.shared.open(webURL, options: [:]) { webSuccess in
                    if !webSuccess {
                        self.logger.error("Could not open either App Store URL.");
                    }
                };
            }
        };
    }

    /**
     * 将设备界面方向设置为横屏向左。
     * - Parameters: 无。
     * - Returns: 无。
     */
    public static func setLandscapeOrientation() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { self.setLandscapeOrientation(); };
            return;
        }

        UIDevice.current.setValue(UIInterfaceOrientation.landscapeLeft.rawValue, forKey: "orientation");
    }

    /**
     * 将设备界面方向设置为竖屏。
     * - Parameters: 无。
     * - Returns: 无。
     */
    public static func setPortraitOrientation() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { self.setPortraitOrientation(); };
            return;
        }

        UIDevice.current.setValue(UIInterfaceOrientation.portrait.rawValue, forKey: "orientation");
    }

    /**
     * 请求当前窗口场景切换为横屏向右。
     * - Parameters: 无。
     * - Returns: 无；失败信息通过系统回调写入日志。
     */
    @available(iOS 16.0, *)
    public static func requestOrientationChange() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { self.requestOrientationChange(); };
            return;
        }

        logger.info("Requesting landscape orientation.");
        let scene: UIWindowScene? = UIApplication.shared.connectedScenes.first as? UIWindowScene;
        let geometryPreferences: UIWindowScene.GeometryPreferences.iOS = UIWindowScene.GeometryPreferences.iOS();
        geometryPreferences.interfaceOrientations = .landscapeRight;

        scene?.requestGeometryUpdate(geometryPreferences) { error in
            logger.error("Failed to request landscape orientation: \(error.localizedDescription)");
        };
    }

    /**
     * 请求当前窗口场景强制切换为竖屏。
     * - Parameters: 无。
     * - Returns: 无；失败信息通过系统回调写入日志。
     */
    @available(iOS 16.0, *)
    public static func forcePortrait() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { self.forcePortrait(); };
            return;
        }

        logger.info("Requesting portrait orientation.");
        let scene: UIWindowScene? = UIApplication.shared.connectedScenes.first as? UIWindowScene;
        let geometryPreferences: UIWindowScene.GeometryPreferences.iOS = UIWindowScene.GeometryPreferences.iOS();
        geometryPreferences.interfaceOrientations = .portrait;

        scene?.requestGeometryUpdate(geometryPreferences) { error in
            logger.error("Failed to request portrait orientation: \(error.localizedDescription)");
        };
    }
}
