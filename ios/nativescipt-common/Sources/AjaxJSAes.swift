import Foundation
import Security
import CryptoKit

/**
 * Objective-C bridge result. Errors contain no key or plaintext; value is
 * NSNumber for key operations, NSDictionary for encryption, NSString for decryption.
 */
@objc(AjaxJSCryptoResult)
public final class CryptoResult: NSObject {
    @objc public let value: Any?
    @objc public let error: String?
    init(value: Any? = nil, error: String? = nil) {
        self.value = value
        self.error = error
    }
}

/**
 * iOS 15+ Keychain AES-GCM bridge. Keys are device-only, available while unlocked,
 * never synchronized or exported. All operations return CryptoResult; errors must
 * be checked before reading value. Alias length is measured in UTF-16 like Java.
 */
@objc(AjaxJSAes)
public final class AjaxJSAes: NSObject {
    private static let service = "com.ajaxjs.nativescript.common.aes"
    private static let lock = NSLock()

    private static func perform(_ action: () throws -> Any) -> CryptoResult {
        lock.lock()
        defer { lock.unlock() }
        do {
            return CryptoResult(value: try action())
        } catch {
            return CryptoResult(error: (error as NSError).localizedDescription)
        }
    }

    private static func fail(_ message: String) -> NSError {
        NSError(domain: "AjaxJSCommon", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func query(_ alias: String) throws -> [String: Any] {
        if alias.utf16.allSatisfy({ $0 <= 32 }) || alias.utf16.count > 128 {
            throw fail("Key alias must contain 1 to 128 characters.")
        }
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service, kSecAttrAccount as String: alias,
                kSecAttrSynchronizable as String: false]
    }

    private static func check(_ status: OSStatus) throws {
        if status != errSecSuccess {
            throw fail("Keychain operation failed (OSStatus \(status)).")
        }
    }

    private static func decode(_ text: String) throws -> Data {
        if text.range(of: "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$", options: .regularExpression) == nil {
            throw fail("Invalid standard Base64.")
        }
        guard let data = Data(base64Encoded: text) else {
            throw fail("Invalid standard Base64.")
        }
        return data
    }

    private static func load(_ alias: String) throws -> SymmetricKey {
        var request = try query(alias)
        request[kSecReturnData as String] = true
        var item: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &item)
        if status == errSecItemNotFound {
            throw fail("AES key was not found in Keychain.")
        }
        try check(status)
        guard let bytes = item as? Data else {
            throw fail("Invalid Keychain AES key.")
        }
        return SymmetricKey(data: bytes)
    }

    /**
     * alias: nonblank, <=128 UTF-16 units; keyBase64: 16/24/32 decoded bytes.
     * Returns true on success; duplicate aliases and invalid keys return an error.
     */
    @objc(importKey:keyBase64:)
    public static func importKey(_ alias: String, keyBase64: String) -> CryptoResult {
        perform {
            var request = try query(alias)
            var bytes = try decode(keyBase64)
            defer { bytes.resetBytes(in: 0..<bytes.count) }
            if ![16, 24, 32].contains(bytes.count) {
                throw fail("AES key must be 16, 24, or 32 bytes.")
            }
            request[kSecValueData as String] = bytes
            request[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            let status = SecItemAdd(request as CFDictionary, nil)
            if status == errSecDuplicateItem {
                throw fail("Key alias already exists; use a new versioned alias.")
            }
            try check(status)
            return true
        }
    }

    /**
     * Returns whether alias exists; invalid aliases or Keychain failures return an error.
     */
    @objc(hasKey:)
    public static func hasKey(_ alias: String) -> CryptoResult {
        perform {
            let status = SecItemCopyMatching(try query(alias) as CFDictionary, nil)
            if status == errSecItemNotFound {
                return false
            }
            try check(status)
            return true
        }
    }

    /**
     * Deletes alias, succeeds if absent. Invalid alias or Keychain failure returns an error.
     */
    @objc(deleteKey:)
    public static func deleteKey(_ alias: String) -> CryptoResult {
        perform {
            let status = SecItemDelete(try query(alias) as CFDictionary)
            if status != errSecItemNotFound {
                try check(status)
            }
            return true
        }
    }

    /**
     * Encrypts UTF-8 plaintext (including empty text); returns Base64 nonce/data dictionary.
     * Uses a random 12-byte nonce and appends the 16-byte tag; no AAD. Missing key returns error.
     */
    @objc(encrypt:plaintext:)
    public static func encrypt(_ alias: String, plaintext: String) -> CryptoResult {
        perform {
            let box = try AES.GCM.seal(Data(plaintext.utf8), using: load(alias))
            return ["nonce": Data(box.nonce).base64EncodedString(),
                    "data": (box.ciphertext + box.tag).base64EncodedString()]
        }
    }

    /**
     * nonceBase64 must decode to 12 bytes; dataBase64 to >=16 bytes (ciphertext + tag).
     * Returns authenticated UTF-8 plaintext; malformed input, missing key, invalid UTF-8,
     * and authentication failures return an error and never return plaintext.
     */
    @objc(decrypt:nonceBase64:dataBase64:)
    public static func decrypt(_ alias: String, nonceBase64: String, dataBase64: String) -> CryptoResult {
        perform {
            let nonce = try decode(nonceBase64)
            let data = try decode(dataBase64)
            if nonce.count != 12 || data.count < 16 {
                throw fail("Invalid GCM nonce or ciphertext length.")
            }
            let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce),
                ciphertext: data.dropLast(16), tag: data.suffix(16))
            let bytes = try AES.GCM.open(box, using: load(alias))
            guard let text = String(data: bytes, encoding: .utf8) else {
                throw fail("Plaintext is not valid UTF-8.")
            }
            return text
        }
    }
}
