import Foundation

/**
 * 简单的异步 HTTP 文本请求，仅提供 GET 和 POST，使用系统 URLSession 与默认 TLS 校验。
 * 请求自动启动，返回的 task 可用于取消；所有结果回调均异步进入主线程，最多一次。
 * 不自动解析 JSON，不记录地址、请求头或正文；HTTP 明文访问遵循宿主 ATS 配置。
 */
@objc(AjaxJSHttpRequest)
public final class HttpRequest: NSObject {
    /**
     * 发送 GET 请求，查询参数由调用方通过 URLComponents 编码到 URL 中。
     * - Parameters:
     *   - url: 带主机的完整 HTTP/HTTPS 地址。
     *   - headers: 请求头，默认空字典，例如 Authorization。
     *   - timeout: 请求超时秒数，默认 15，必须为有限正数。
     *   - completion: HTTP 状态码、UTF-8 正文、错误；2xx 成功时 error 为 nil。
     * - Returns: 已启动的任务；参数错误时返回 nil，并异步回调错误。
     */
    @objc(get:headers:timeout:completion:)
    @discardableResult
    public static func get(_ url: String, headers: [String: String] = [:], timeout: TimeInterval = 15,
                           completion: @escaping (Int, String?, NSError?) -> Void) -> URLSessionDataTask? {
        send("GET", url: url, body: nil, headers: headers, timeout: timeout, completion: completion)
    }

    /**
     * 发送 POST 请求，body 原样编码为 UTF-8，不自动序列化或表单编码。
     * - Parameters:
     *   - url: 带主机的完整 HTTP/HTTPS 地址。
     *   - body: 请求正文，允许空字符串；JSON 由调用方提前序列化。
     *   - headers: 请求头，未指定 Content-Type 时默认 application/json; charset=utf-8。
     *   - timeout: 请求超时秒数，默认 15，必须为有限正数。
     *   - completion: HTTP 状态码、UTF-8 正文、错误；2xx 成功时 error 为 nil。
     * - Returns: 已启动的任务；参数错误时返回 nil，并异步回调错误。
     */
    @objc(post:body:headers:timeout:completion:)
    @discardableResult
    public static func post(_ url: String, body: String, headers: [String: String] = [:], timeout: TimeInterval = 15,
                            completion: @escaping (Int, String?, NSError?) -> Void) -> URLSessionDataTask? {
        send("POST", url: url, body: body, headers: headers, timeout: timeout, completion: completion)
    }

    /**
     * 参数和网络错误状态码为 0；收到 HTTP 响应则保留实际状态码。
     * 非 2xx 返回 HTTP 错误及可解码的响应正文；非 UTF-8 正文返回解码错误，不返回乱码。
     * 取消和传输错误保留 URLSession 的 NSError，调用方通过 error 区分失败与空正文。
     */
    private static func send(_ method: String, url: String, body: String?, headers: [String: String],
                             timeout: TimeInterval, completion: @escaping (Int, String?, NSError?) -> Void) -> URLSessionDataTask? {
        guard let address = URL(string: url), let scheme = address.scheme?.lowercased(),
              ["https", "http"].contains(scheme), let host = address.host, !host.isEmpty else {
            deliver(0, nil, failure(NSURLErrorBadURL, "A valid HTTP or HTTPS URL is required."), completion)
            return nil
        }
        guard timeout.isFinite, timeout > 0 else {
            deliver(0, nil, failure(NSURLErrorBadURL, "Request timeout must be a finite positive number."), completion)
            return nil
        }
        var request = URLRequest(url: address, timeoutInterval: timeout)
        request.httpMethod = method
        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }
        if let body = body {
            request.httpBody = Data(body.utf8)
            if request.value(forHTTPHeaderField: "Content-Type") == nil {
                request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
            }
        }
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if let error = error {
                deliver(status, nil, error as NSError, completion)
                return
            }
            guard status != 0 else {
                deliver(0, nil, failure(NSURLErrorBadServerResponse, "An HTTP response is required."), completion)
                return
            }
            guard let text = String(data: data ?? Data(), encoding: .utf8) else {
                deliver(status, nil, failure(NSURLErrorCannotDecodeContentData, "Response body is not valid UTF-8."), completion)
                return
            }
            let error = (200..<300).contains(status) ? nil : failure(status, "HTTP request failed with status \(status).")
            deliver(status, text, error, completion)
        }
        task.resume()
        return task
    }

    private static func failure(_ code: Int, _ message: String) -> NSError {
        NSError(domain: "AjaxJSHttpRequest", code: code, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func deliver(_ status: Int, _ body: String?, _ error: NSError?,
                                _ completion: @escaping (Int, String?, NSError?) -> Void) {
        DispatchQueue.main.async { completion(status, body, error) }
    }
}
