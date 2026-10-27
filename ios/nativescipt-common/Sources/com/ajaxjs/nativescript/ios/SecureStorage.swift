import Foundation
import Security

/**
 * 字符串安全存储，独立 service 隔离机器人 AES 密钥；不启用 iCloud 同步。
 * Keychain 项仅在本机解锁时可访问，不随备份迁移到其他设备。
 * 原生方法返回 CryptoResult，错误不含凭据；读取不存在时 value/error 都为空。
 */
@objc(AjaxJSSecureStorage)
public final class SecureStorage: NSObject {
    private static let service = "com.ajaxjs.nativescript.common.secure-storage.v1"
    private static let lock = NSLock()

    private static func perform(_ action: () throws -> Any?) -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }

        do {
            return CryptoResult(value: try action())
        } catch {
            return CryptoResult(error: (error as NSError).localizedDescription)
        }
    }

    private static func fail(_ message: String) -> NSError {
        NSError(domain: "AjaxJSSecureStorage", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func query(_ key: String) throws -> [String: Any] {
        if key.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || key.utf16.count > 128 {
            throw fail("Secure storage key must be nonblank and at most 128 UTF-16 units.")
        }

        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service, kSecAttrAccount as String: key,
                kSecAttrSynchronizable as String: false]
    }

    private static func check(_ status: OSStatus) throws {
        if status != errSecSuccess {
            throw fail("Secure storage Keychain operation failed (OSStatus \(status)).")
        }
    }

    /**
     * 写入或覆盖字符串，允许空值，最多 65536 UTF-8 字节；成功 value 为 true。
     * key 为非空白、最多 128 UTF-16 单元，大小写和空格原样保留。
     */
    @objc(setItem:value:)
    public static func setItem(_ key: String, value: String) -> CryptoResult {
        perform {
            let request = try query(key)
            var data = Data(value.utf8)
            defer { data.resetBytes(in: 0..<data.count) }

            if data.count > 65536 {
                throw fail("Secure storage value must be at most 65536 UTF-8 bytes.")
            }

            let attributes: [String: Any] = [kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
            let status = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)

            if status == errSecItemNotFound {
                var insertion = request
                attributes.forEach { insertion[$0.key] = $0.value }
                try check(SecItemAdd(insertion as CFDictionary, nil))
            } else {
                try check(status)
            }

            return true
        }
    }

    /**
     * 返回原始字符串，空字符串有别于不存在；未找到时 value/error 都为空。
     * 锁屏、权限、系统或编码错误返回 error，不伪装为不存在。
     */
    @objc(getItem:)
    public static func getItem(_ key: String) -> CryptoResult {
        perform {
            var request = try query(key)
            request[kSecReturnData as String] = true
            request[kSecMatchLimit as String] = kSecMatchLimitOne
            var item: CFTypeRef?
            let status = SecItemCopyMatching(request as CFDictionary, &item)
            
            if status == errSecItemNotFound {
                return nil
            }

            try check(status)

            guard var data = item as? Data else {
                throw fail("Secure storage contains invalid data.")
            }

            defer { data.resetBytes(in: 0..<data.count) }
            guard data.count <= 65536, let value = String(data: data, encoding: .utf8) else {
                throw fail("Secure storage contains invalid UTF-8 data.")
            }

            return value
        }
    }

    /**
     * 幂等删除指定项；不存在也成功，value 为 true；不会删除 AES 密钥或其他项。
     * 不承诺物理安全擦除，失败通过 error 返回。
     */
    @objc(removeItem:)
    public static func removeItem(_ key: String) -> CryptoResult {
        perform {
            let status = SecItemDelete(try query(key) as CFDictionary)
            if status != errSecItemNotFound {
                try check(status)
            }
            return true
        }
    }
}
