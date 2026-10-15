import UIKit

/**
 * 自定义确认框入口；JSON 字段与统一 TS 接口一致，颜色使用 #AARRGGBB。
 * completion 在主线程最多调用一次；确认返回 true，普通关闭返回 false，错误附带消息。
 */
@objc(AjaxJSConfirmDialog)
public final class ConfirmDialog: NSObject {
    /**
     * 从活动场景的最上层控制器显示确认框；没有可用前台窗口时返回 false。
     * position 控制正文对齐，不改变窗口位置；maskClosable 默认 false。
     * 主线程立即执行，后台调用异步切换主线程；不使用私有 UIAlertController 属性。
     * - Parameters:
     *   - optionsJson: 含 message 的 JSON 对象；其他字段可选，默认文案为中文。
     *   - completion: confirmed 与可空错误字符串；错误时不把失败当作用户确认。
     */
    @objc(show:completion:)
    public static func show(_ optionsJson: String, completion: @escaping (Bool, String?) -> Void) {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { show(optionsJson, completion: completion) }
            return
        }
        do {
            guard let data = optionsJson.data(using: .utf8),
                  let options = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  options["message"] is String else {
                completion(false, "Confirm options must contain a string message.")
                return
            }
            let windows = UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .filter { $0.activationState == .foregroundActive }
                .flatMap { $0.windows }
            guard let root = (windows.first { $0.isKeyWindow } ?? windows.first { !$0.isHidden })?.rootViewController else {
                completion(false, nil)
                return
            }
            let presenter = topController(root)
            guard presenter.viewIfLoaded?.window != nil,
                  !presenter.isBeingDismissed, !presenter.isBeingPresented else {
                completion(false, nil)
                return
            }
            let controller = try ConfirmViewController(options: options, completion: completion)
            presenter.present(controller, animated: true)
        } catch {
            completion(false, "Unable to show native confirm: invalid JSON or color.")
        }
    }

    /**
     * 跟随已显示模态、导航或 tab 控制器，避免从不可见的根页面弹出。
     */
    private static func topController(_ controller: UIViewController) -> UIViewController {
        if let presented = controller.presentedViewController {
            return topController(presented)
        }
        
        if let navigation = controller as? UINavigationController, let visible = navigation.visibleViewController {
            return topController(visible)
        }

        if let tabs = controller as? UITabBarController, let selected = tabs.selectedViewController {
            return topController(selected)
        }

        return controller
    }
}

/**
 * 公开 UIKit 组件构造的圆角卡片，正文可滚动，按钮保持可见。
 */
private final class ConfirmViewController: UIViewController {
    private let options: [String: Any]
    private let okColor: UIColor
    private let cancelColor: UIColor
    private let okTextColor: UIColor
    private let cancelTextColor: UIColor
    private var completion: ((Bool, String?) -> Void)?
    private var finished = false
    private var backgroundObserver: NSObjectProtocol?

    init(options: [String: Any], completion: @escaping (Bool, String?) -> Void) throws {
        self.options = options
        self.completion = completion
        okColor = try Self.color(options["okColor"] as? String ?? "#FF71A3DF")
        cancelColor = try Self.color(options["cancelColor"] as? String ?? "#FFE2E2E2")
        okTextColor = try Self.color(options["okTextColor"] as? String ?? "#FFFFFFFF")
        cancelTextColor = try Self.color(options["cancelTextColor"] as? String ?? "#FF333333")
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
    }

    required init?(coder: NSCoder) {
        fatalError("ConfirmViewController requires options.")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.35)
        view.accessibilityViewIsModal = true
        let backdrop = UIButton(type: .custom)
        backdrop.translatesAutoresizingMaskIntoConstraints = false
        backdrop.accessibilityIdentifier = "ajaxjs-confirm-backdrop"
        backdrop.isAccessibilityElement = false
        backdrop.addTarget(self, action: #selector(maskTapped), for: .touchUpInside)
        view.addSubview(backdrop)
        NSLayoutConstraint.activate([
            backdrop.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            backdrop.topAnchor.constraint(equalTo: view.topAnchor),
            backdrop.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let card = UIView()
        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = .white
        card.layer.cornerRadius = 16
        card.accessibilityIdentifier = "ajaxjs-confirm-card"
        view.addSubview(card)
        let preferredWidth = card.widthAnchor.constraint(equalTo: view.safeAreaLayoutGuide.widthAnchor, multiplier: 0.8)
        preferredWidth.priority = .defaultHigh
        NSLayoutConstraint.activate([
            preferredWidth,
            card.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
            card.centerXAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
            card.topAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            card.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12)
        ])

        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -32),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 32),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -32)
        ])

        let title = UILabel()
        title.text = options["title"] as? String ?? "提示"
        title.font = .systemFont(ofSize: 17)
        title.textColor = UIColor(white: 0.2, alpha: 1)
        title.textAlignment = .center
        title.numberOfLines = 0
        title.accessibilityTraits = .header
        title.setContentCompressionResistancePriority(.required, for: .vertical)
        stack.addArrangedSubview(title)

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(scroll)
        let message = UILabel()
        message.translatesAutoresizingMaskIntoConstraints = false
        message.text = options["message"] as? String
        message.textColor = UIColor(white: 0.4, alpha: 1)
        message.font = .systemFont(ofSize: 15)
        message.numberOfLines = 0
        message.setContentCompressionResistancePriority(.required, for: .vertical)
        let position = options["position"] as? String ?? "CENTER"
        message.textAlignment = position == "LEFT" ? .left : position == "RIGHT" ? .right : .center
        scroll.addSubview(message)
        let contentHeight = scroll.heightAnchor.constraint(equalTo: message.heightAnchor)
        contentHeight.priority = .defaultHigh
        NSLayoutConstraint.activate([
            message.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            message.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            message.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            message.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            message.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
            scroll.heightAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.heightAnchor, multiplier: 0.45),
            contentHeight
        ])
        stack.setCustomSpacing(32, after: scroll)

        let buttons = UIStackView()
        buttons.axis = .horizontal
        buttons.distribution = .fillEqually
        buttons.spacing = 16
        let cancel = makeButton(text: options["cancelText"] as? String ?? "取消", color: cancelColor, textColor: cancelTextColor)
        cancel.accessibilityIdentifier = "ajaxjs-confirm-cancel"
        cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        let ok = makeButton(text: options["okText"] as? String ?? "确认", color: okColor, textColor: okTextColor)
        ok.accessibilityIdentifier = "ajaxjs-confirm-ok"
        ok.addTarget(self, action: #selector(okTapped), for: .touchUpInside)
        buttons.addArrangedSubview(cancel)
        buttons.addArrangedSubview(ok)
        buttons.heightAnchor.constraint(equalToConstant: 44).isActive = true
        stack.addArrangedSubview(buttons)

        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification,
            object: nil, queue: .main) { [weak self] _ in self?.finish(false) }
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)

        if !finished {
            finished = true
            deliver(false)
        }
    }

    deinit {
        if let observer = backgroundObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    /**
     * 等待关闭动画结束再返回结果，允许 TS 队列安全地显示下一个弹窗。
     */
    private func finish(_ confirmed: Bool) {
        if finished {
            return
        }
        finished = true
        dismiss(animated: true) { self.deliver(confirmed) }
    }

    private func deliver(_ confirmed: Bool) {
        let callback = completion
        completion = nil

        if let observer = backgroundObserver {
            NotificationCenter.default.removeObserver(observer)
            backgroundObserver = nil
        }

        callback?(confirmed, nil)
    }

    @objc private func okTapped() {
        finish(true)
    }

    @objc private func cancelTapped() {
        finish(false)
    }

    @objc private func maskTapped() {
        if options["maskClosable"] as? Bool == true {
            finish(false)
        }
    }

    private func makeButton(text: String, color: UIColor, textColor: UIColor) -> UIButton {
        let button = UIButton(type: .custom)
        button.setTitle(text, for: .normal)
        button.setTitleColor(textColor, for: .normal)
        button.backgroundColor = color
        button.layer.cornerRadius = 22
        button.titleLabel?.font = .systemFont(ofSize: 15)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.6
        return button
    }

    /**
     * TS 已把支持的颜色格式统一转换为 #AARRGGBB；直接原生调用也须使用此格式。
     */
    private static func color(_ value: String) throws -> UIColor {
        guard value.count == 9, value.first == "#", let bits = UInt32(value.dropFirst(), radix: 16) else {
            throw NSError(domain: "com.ajaxjs.nativescript.ios.ConfirmDialog", code: 1)
        }

        return UIColor(red: CGFloat((bits >> 16) & 255) / 255,
            green: CGFloat((bits >> 8) & 255) / 255, blue: CGFloat(bits & 255) / 255,
            alpha: CGFloat((bits >> 24) & 255) / 255)
    }
}
