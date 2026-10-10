package com.ajaxjs.nativescript.android.crypto;

/**
 * Base64 编码的 GCM nonce 和密文（末尾含 16 字节认证标签）。
 */
public final class EncryptedBody {
    private final String nonce;
    private final String data;

    EncryptedBody(String nonce, String data) {
        this.nonce = nonce;
        this.data = data;
    }

    /**
     * 获取加密消息 nonce，必须与密文一起保存和传输。
     *
     * @return 标准 Base64 编码的 12 字节 nonce。
     */
    public String getNonce() {
        return nonce;
    }

    /**
     * 获取密文及 GCM 认证标签。
     *
     * @return 标准 Base64 编码的密文，末尾包含 16 字节认证标签。
     */
    public String getData() {
        return data;
    }
}
