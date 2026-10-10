import { gcm } from "@noble/ciphers/aes.js";
import { TextEncoder, TextDecoder } from "@nativescript/core/text";
import { atob, btoa } from "@nativescript/core/wgc";
import { Crypto } from "@nativescript/core/wgc/crypto";

export type AesGcmEncrypted = {
    /**
     * 12-byte AES-GCM nonce encoded as Base64.
     */
    nonce: string;

    /**
     * AES-GCM ciphertext + authentication tag encoded as Base64.
     */
    data: string;
};

export class AesGcm {
    private static readonly NONCE_LENGTH = 12;

    /**
     * AES-GCM 加密 UTF-8 文本。
     *
     * nonce: Base64 编码的 12-byte nonce。
     * data: Base64([ciphertext][16-byte GCM tag])。
     */
    static encrypt(plaintext: string, keyBase64: string): AesGcmEncrypted {
        const key: Uint8Array<ArrayBufferLike> = this.base64ToBytes(keyBase64);
        this.validateKey(key);

        const nonce: Uint8Array<ArrayBufferLike> = this.randomBytes(this.NONCE_LENGTH);
        const plaintextBytes = new TextEncoder().encode(plaintext);
        const ciphertext = gcm(key, nonce).encrypt(plaintextBytes);

        return {
            nonce: this.bytesToBase64(nonce),
            data: this.bytesToBase64(ciphertext)
        };
    }

    /**
    * AES-GCM decrypt.
    *
    * Ciphertext and nonce are supplied as separate Base64 strings.
    * Ciphertext includes the trailing 16-byte authentication tag.
    */
    static decrypt(encryptedBase64: string, keyBase64: string, nonceBase64: string): string {
        const key: Uint8Array<ArrayBufferLike> = this.base64ToBytes(keyBase64);
        this.validateKey(key);

        const nonce: Uint8Array<ArrayBufferLike> = this.base64ToBytes(nonceBase64);

        if (nonce.length !== this.NONCE_LENGTH)
            throw new Error("AES-GCM nonce must be 12 bytes.");

        const ciphertext: Uint8Array<ArrayBufferLike> = this.base64ToBytes(encryptedBase64);

        // 至少包含 16-byte authentication tag
        if (ciphertext.length < 16)
            throw new Error("AES-GCM ciphertext is too short.");

        const plaintext: Uint8Array<ArrayBufferLike> = gcm(key, nonce).decrypt(ciphertext);

        return new TextDecoder().decode(plaintext);
    }

    /**
     * Generates cryptographically secure random bytes.
     */
    private static randomBytes(length: number): Uint8Array {
        const bytes = new Uint8Array(length);
        new Crypto().getRandomValues(bytes);

        return bytes;
    }

    /**
     * Base64 AES key -> Uint8Array
     */
    static keyFromBase64(base64Key: string): Uint8Array {
        const key = this.base64ToBytes(base64Key);
        this.validateKey(key);

        return key;
    }

    /**
     * Encodes a UTF-8 string as Base64.
     *
     * @param value the string to encode
     * @return the Base64-encoded string
     */
    static base64Encode(value: string): string {
        const bytes = new TextEncoder().encode(value);
        let binary = "";

        for (let i = 0; i < bytes.length; i++)
            binary += String.fromCharCode(bytes[i]);

        return btoa(binary);
    }

    private static validateKey(keyBytes: Uint8Array): void {
        if (!keyBytes)
            throw new Error("AES key is required.");

        if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32)
            throw new Error("AES key must be 16, 24, or 32 bytes.");
    }

    private static bytesToBase64(bytes: Uint8Array): string {
        let binary = "";

        for (let i = 0; i < bytes.length; i++)
            binary += String.fromCharCode(bytes[i]);

        return btoa(binary);
    }

    private static base64ToBytes(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++)
            bytes[i] = binary.charCodeAt(i);

        return bytes;
    }
}

/**
 * JSON 消息体类型定义
 */
type JsonMsgBody = {
    /**
     * 版本号，第一版为 1
     */
    ver: number;

    /**
     * 时间戳，单位毫秒，例如 1789626000123
     * Unix epoch milliseconds/UTC-based/JSON number
     * ts/js: `Date.now();`
     * Java: `long timestamp = System.currentTimeMillis();`
     */
    timestamp: number;

    /**
     * AES-GCM nonce。
     *
     * 每次加密必须重新随机生成，同一 AES Key 下不得重复。
     *
     * 原始长度：12 bytes（96 bits）
     * JSON 表示：Base64
     * Base64 编码后长度：16 characters
     */
    nonce: string;

   /**
     * AES-GCM 加密结果。
     *
     * 二进制格式：
     * [ciphertext][128-bit authentication tag]
     *
     * JSON 表示：Base64。
     */
    data: string;
};
