import Foundation

/**
 * 用户 Token、MQTT 账号密码与客户端认证 Token 的本机安全存取，与 Android 一致。
 * 复用 SecureStorage 的独立 Keychain service；不请求网络，不刷新或校验 Token。
 * 原生方法同步执行，须先检查 CryptoResult.error；错误不包含 Token 内容。
 */
@objc(AjaxJSGetCredential)
public final class GetCredential: NSObject {
    @objc public static let USER_TOKEN_KEY = "user_token"
    
    @objc public static let USER_REFRESH_TOKEN_KEY = "user_refresh_token"

    @objc public static let MQTT_USERNAME_KEY = "mqtt_username"

    @objc public static let MQTT_PASSWORD_KEY = "mqtt_password"

    @objc public static let CLIENT_CREDENTIAL_KEY = "client_credential"

    @objc public static let AES_KEY_KEY = "AES_KEY"

    private static let lock = NSLock()

    /**
     * 依次保存或覆盖用户 Token 与 refreshToken，允许空字符串，保留 Unicode 与空格。
     * 每项最多 65536 UTF-8 字节；成功 value=true，失败返回 error。
     * 两项写入并非事务，第二项失败时第一项可能已更新，调用方应处理失败并重试。
     */
    @objc(saveUserToken:refreshToken:)
    public static func saveUserToken(_ userToken: String, refreshToken: String) -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        let tokenResult = SecureStorage.setItem(USER_TOKEN_KEY, value: userToken)

        if tokenResult.error != nil {
            return tokenResult
        }

        return SecureStorage.setItem(USER_REFRESH_TOKEN_KEY, value: refreshToken)
    }

    /**
     * 读取 user_token；不存在时 value/error 均为空，空字符串仍为有效存储值。
     * 设备锁定或 Keychain 读取失败返回 error，不伪装为未找到。
     */
    @objc(getUserToken)
    public static func getUserToken() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        return SecureStorage.getItem(USER_TOKEN_KEY)
    }

    /**
     * 读取 user_refresh_token，返回值与错误约定同 getUserToken。
     */
    @objc(getUserRefreshToken)
    public static func getUserRefreshToken() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        return SecureStorage.getItem(USER_REFRESH_TOKEN_KEY)
    }

    /**
     * 同步读取 mqtt_username；不存在 value/error 均为空，空字符串保留。
     * Keychain 锁定或存储失败返回 error，不请求网络、不解码或自动刷新。
     */
    @objc(getMqttUsername)
    public static func getMqttUsername() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        return SecureStorage.getItem(MQTT_USERNAME_KEY)
    }

    /**
     * 同步读取 mqtt_password，返回值与异常约定同 getMqttUsername。
     */
    @objc(getMqttPassword)
    public static func getMqttPassword() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        return SecureStorage.getItem(MQTT_PASSWORD_KEY)
    }

    /**
     * 依次写入 mqtt_username 与 mqtt_password，各自最多 65536 UTF-8 字节。
     * 原样保存，允许空值、Unicode、空格与下划线；不请求网络或 Base64 解码。
     * 成功 value=true，失败返回 error；两项不是事务，第二项失败时第一项可能已更新。
     */
    @objc(setMqttCredential:password:)
    public static func setMqttCredential(_ username: String, password: String) -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        let usernameResult = SecureStorage.setItem(MQTT_USERNAME_KEY, value: username)

        if usernameResult.error != nil {
            return usernameResult
        }

        return SecureStorage.setItem(MQTT_PASSWORD_KEY, value: password)
    }

    /**
     * 依次删除用户 Token 与 refreshToken，不存在也成功，不删除 MQTT 或客户端 Token。
     * 非事务，第二项失败时第一项可能已删除；错误通过 CryptoResult.error 返回。
     */
    @objc(removeUserToken)
    public static func removeUserToken() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        let result = SecureStorage.removeItem(USER_TOKEN_KEY)

        if result.error != nil {
            return result
        }

        return SecureStorage.removeItem(USER_REFRESH_TOKEN_KEY)
    }

    /**
     * 依次幂等删除 MQTT 账号与密码，非事务；不影响其他类别的安全项。
     */
    @objc(removeMqttCredential)
    public static func removeMqttCredential() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        let result = SecureStorage.removeItem(MQTT_USERNAME_KEY)

        if result.error != nil {
            return result
        }

        return SecureStorage.removeItem(MQTT_PASSWORD_KEY)
    }

    /**
     * 同步保存或覆盖客户端认证 Token，固定键 client_credential。
     * 合法字符串，每项最多 65536 UTF-8 字节；允许空值并原样保留，不请求网络。
     * 成功 value=true，失败设置 error；独立于用户 Token 和 MQTT 凭据。
     */
    @objc(saveClientCredential:)
    public static func saveClientCredential(_ token: String) -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        return SecureStorage.setItem(CLIENT_CREDENTIAL_KEY, value: token)
    }

    /**
     * 同步读取客户端认证 Token，缺失 value=null，空字符串保留，失败设置 error。
     */
    @objc(getClientCredential)
    public static func getClientCredential() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        return SecureStorage.getItem(CLIENT_CREDENTIAL_KEY)
    }

    /**
     * 同步幂等删除客户端 Token，成功 value=true，失败设置 error。
     */
    @objc(removeClientCredential)
    public static func removeClientCredential() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        return SecureStorage.removeItem(CLIENT_CREDENTIAL_KEY)
    }

    /**
     * 同步保存/覆盖 AES_KEY 对应的字符串，通常为 Base64，但不验证编码或 AES 长度。
     * 最多 65536 UTF-8 字节，允许空值，原样保存；成功 value=true，失败 error。
     * 不导入密码学密钥、不执行 HKDF 或加解密，不请求网络。
     */
    @objc(saveAesKey:)
    public static func saveAesKey(_ token: String) -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        return SecureStorage.setItem(AES_KEY_KEY, value: token)
    }

    /**
     * 同步读取 AES 密钥字符串，缺失 value=null，空字符串保留，失败 error。
     * 不解码、不验证密钥，不记录返回的秘密字符串。
     */
    @objc(getAesKey)
    public static func getAesKey() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        return SecureStorage.getItem(AES_KEY_KEY)
    }

    /**
     * 同步幂等删除 AES_KEY 安全项，成功 value=true，失败 error。
     * 不删除通过 importAesKey 导入的密钥别名或其他凭据。
     */
    @objc(removeAesKey)
    public static func removeAesKey() -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        return SecureStorage.removeItem(AES_KEY_KEY)
    }

}
