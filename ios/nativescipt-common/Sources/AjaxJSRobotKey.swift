import Foundation
import CryptoKit

/**
 * Robot key v1: RFC 5869 HKDF-SHA256, canonical Base64 master key and normalized MAC.
 * Returns CryptoResult; error must be checked before reading value. No master key storage.
 */
@objc(AjaxJSRobotKey)
public final class AjaxJSRobotKey: NSObject {
    private static func fail(_ message: String) -> NSError {
        NSError(domain: "AjaxJSRobotKey", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private static func normalize(_ mac: String) throws -> String {
        let pattern = "\\A(?:[0-9A-Fa-f]{12}|[0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5}|[0-9A-Fa-f]{2}(?:-[0-9A-Fa-f]{2}){5})\\z";
        
        if mac.range(of: pattern, options: .regularExpression) == nil {
            throw fail("Robot MAC must contain exactly six hexadecimal bytes.")
        }

        return mac.replacingOccurrences(of: ":", with: "").replacingOccurrences(of: "-", with: "").lowercased()
    }

    /**
     * masterKeyBase64: canonical standard Base64 of a random 16/24/32-byte master key.
     * robotMac: 12 hex digits or six pairs using consistent ':' or '-' separators; no trim.
     * Success value is canonical Base64 of the 32-byte AES-256 device key; error on invalid input.
     * salt=UTF8("ajaxjs/robot/key-derivation/v2"), info=UTF8(normalized MAC).
     * Returned key is secret. Derivation is deterministic and does not access Keychain.
     */
    @objc(deriveKey:robotMac:)
    public static func deriveKey(_ masterKeyBase64: String, robotMac: String) -> CryptoResult {
        do {
            let mac = try normalize(robotMac)

            guard var master = Data(base64Encoded: masterKeyBase64) else {
                throw fail("Master key must use canonical standard Base64.")
            }

            defer { master.resetBytes(in: 0..<master.count) }

            if ![16, 24, 32].contains(master.count) || master.base64EncodedString() != masterKeyBase64 {
                throw fail("Master key must be 16, 24, or 32 bytes in canonical Base64.")
            }

            let key = HKDF<SHA256>.deriveKey(inputKeyMaterial: SymmetricKey(data: master),
                salt: Data("ajaxjs/robot/key-derivation/v2".utf8),
                info: Data(mac.utf8), outputByteCount: 32)
            var bytes = key.withUnsafeBytes { Data($0) }
            defer { bytes.resetBytes(in: 0..<bytes.count) }

            return CryptoResult(value: bytes.base64EncodedString())
        } catch {
            return CryptoResult(error: (error as NSError).localizedDescription)
        }
    }

    /**
     * Derives v1 key and imports under a nonblank <=128-unit alias without returning it to JS.
     * Duplicate alias, invalid parameters, derivation or Keychain failure returns error.
     * Success value is true; master and robotMac parameters match deriveKey.
     */
    @objc(deriveAndImportKey:masterKeyBase64:robotMac:)
    public static func deriveAndImportKey(_ alias: String, masterKeyBase64: String, robotMac: String) -> CryptoResult {
        let result = deriveKey(masterKeyBase64, robotMac: robotMac)
        
        if result.error != nil {
            return result;
        }

        guard let key = result.value as? String else {
            return CryptoResult(error: "Invalid derived key result.")
        }

        return AjaxJSAes.importKey(alias, keyBase64: key)
    }
}
