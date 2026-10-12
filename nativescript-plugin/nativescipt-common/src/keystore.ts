import { Http, isAndroid, isIOS } from '@nativescript/core';

/**
 * AES-GCM 消息体，不包含密钥、密钥别名或 keyId。
 */
export interface EncryptedBody {
    /**
     * 标准 Base64 编码的 12 字节 GCM nonce，需与密文一同保存和传输。
     */
    nonce: string;
    /**
     * 标准 Base64 编码的密文，末尾含 16 字节 GCM 认证标签。
     */
    data: string;
}

/**
 * HTTPS 密钥请求配置，JWT 由调用方提供。
 */
export interface ProvisionKeyOptions {
    /**
     * 完整 HTTPS 密钥接口地址，不允许内嵌用户名、密码或 URL 片段。
     */
    endpoint: string;
    /**
     * JWT 原文，不含 Bearer 前缀；不能为空或包含换行符。
     */
    jwt: string;
    /**
     * 请求超时毫秒数，必须为有限正数；默认 15000。
     */
    timeout?: number;
}

/**
 * 导入成功后的密钥元数据，不包含原始密钥。
 */
export interface ProvisionKeyResult {
    /**
     * 服务器提供的密钥版本标识，用于生成 Keystore 别名。
     */
    keyId: string;
    /**
     * 已导入的 Keystore 别名，格式为 ajaxjs.aes.${keyId}。
     */
    alias: string;
}

function nativeCrypto() {
    if (isAndroid)
        return com.ajaxjs.nativescript.android.crypto;

    if (isIOS) {
        if (typeof AjaxJSAes === 'undefined')
            throw new Error('AjaxJSCommon XCFramework is not installed.');
        return {
            AesKeyStore: {
                importKey: (alias: string, key: string) => iosValue(AjaxJSAes.importKeyKeyBase64(alias, key)),
                hasKey: (alias: string) => Boolean(iosValue(AjaxJSAes.hasKey(alias))),
                deleteKey: (alias: string) => iosValue(AjaxJSAes.deleteKey(alias))
            },
            JsonBodyCipher: {
                encrypt: (alias: string, text: string) => {
                    const value = iosValue(AjaxJSAes.encryptPlaintext(alias, text)) as NSDictionary<string, string>;
                    
                    return { getNonce: () => value.objectForKey('nonce'), getData: () => value.objectForKey('data') };
                },
                encryptWithAssociatedData: (alias: string, text: string, aad: string) => {
                    const value = iosValue(AjaxJSAes.encryptWithAssociatedDataPlaintextAssociatedData(alias, text, aad)) as NSDictionary<string, string>;

                    return { getNonce: () => value.objectForKey('nonce'), getData: () => value.objectForKey('data') };
                },
                decryptWithAssociatedData: (alias: string, nonce: string, data: string, aad: string) =>
                    iosValue(AjaxJSAes.decryptWithAssociatedDataNonceBase64DataBase64AssociatedData(alias, nonce, data, aad)) as string,
                decrypt: (alias: string, nonce: string, data: string) =>
                    iosValue(AjaxJSAes.decryptNonceBase64DataBase64(alias, nonce, data)) as string
            }
        };
    }

    throw new Error('AES key storage requires Android or iOS.');
}

function iosValue(result: AjaxJSCryptoResult): any {
    if (result.error)
        throw new Error(result.error);

    return result.value;
}

/**
 * 将标准 Base64 AES 密钥导入 Android Keystore 或 iOS Keychain；已有别名拒绝覆盖，轮换时使用新别名。原始密钥暂时经过内存，请勿记录日志或持久化。
 * 支持 Android 8.0+ 和 iOS 15+；其他平台调用会抛出异常。
 *
 * @param alias 非空白密钥别名，最多 128 个字符。
 * @param keyBase64 标准 Base64 编码的密钥，解码后必须为 16、24 或 32 字节。
 * @returns 无返回值，正常返回表示导入成功。
 * @throws 参数无效、别名已存在或 Keystore 操作失败时抛出异常。
 */
export function importAesKey(alias: string, keyBase64: string): void {
    nativeCrypto().AesKeyStore.importKey(alias, keyBase64);
}

/**
 * 检查指定别名是否存在；存在不保证后续加解密成功。
 * 支持 Android 8.0+ 和 iOS 15+；其他平台调用会抛出异常。
 *
 * @param alias 非空白密钥别名，最多 128 个字符。
 * @returns 存在为 true，否则为 false。
 * @throws 别名无效或 Keystore 查询失败时抛出异常。
 */
export function hasAesKey(alias: string): boolean {
    return nativeCrypto().AesKeyStore.hasKey(alias);
}

/**
 * 删除密钥；不存在时不执行操作。删除后旧密文需重新导入相同密钥才能解密。
 * 支持 Android 8.0+ 和 iOS 15+；其他平台调用会抛出异常。
 *
 * @param alias 非空白密钥别名，最多 128 个字符。
 * @returns 无返回值。
 * @throws 别名无效或 Keystore 删除失败时抛出异常。
 */
export function deleteAesKey(alias: string): void {
    nativeCrypto().AesKeyStore.deleteKey(alias);
}

/**
 * 序列化 JSON 值并使用原生安全存储中的 AES-GCM 密钥加密，每次生成新 nonce。遵循 JSON.stringify 的转换规则，包括省略对象中的 undefined 属性。
 *
 * @param alias 已导入的 AES 密钥别名，非空白且最多 128 个字符。
 * @param value 可 JSON 序列化的值；循环引用、BigInt 或顶层 undefined 等会失败。
 * @returns Base64 nonce 与密文，密文末尾含 16 字节认证标签。
 * @throws 不支持的平台、序列化失败、密钥不存在或加密失败时抛出异常。
 */
export function encryptJson(alias: string, value: unknown): EncryptedBody {
    const plaintext = JSON.stringify(value);

    if (plaintext === undefined)
        throw new Error('Value must be JSON serializable.');
    
    const result = nativeCrypto().JsonBodyCipher.encrypt(alias, plaintext);
    
    return { nonce: result.getNonce(), data: result.getData() };
}

/**
 * 验证认证标签、解密并解析 JSON；泛型 T 仅为类型声明，不进行运行时结构验证。
 *
 * @typeParam T 调用方预期的数据类型，默认 unknown。
 * @param alias 已导入的 AES 密钥别名，非空白且最多 128 个字符。
 * @param body 包含标准 Base64 nonce 和密文及认证标签的消息体。
 * @returns JSON 解析结果，以 T 类型返回。
 * @throws 不支持的平台、消息体无效、密钥不存在、认证失败或 JSON 解析失败时抛出异常。
 */
export function decryptJson<T = unknown>(alias: string, body: EncryptedBody): T {
    if (!body || typeof body.nonce !== 'string' || typeof body.data !== 'string')
        throw new Error('Encrypted body must contain nonce and data strings.');
    
    return JSON.parse(nativeCrypto().JsonBodyCipher.decrypt(alias, body.nonce, body.data)) as T;
}

/**
 * UTF-8 AAD 参与认证，不加密、不包含在消息体中；空字符串兼容无 AAD。
 *
 * @param alias 已导入的密钥别名，非空白且最多 128 个字符。
 * @param value 可 JSON 序列化的值，遵循 JSON.stringify 规则。
 * @param associatedData 附加认证字符串，不能为 null；解密时 UTF-8 字节必须与加密时完全一致。
 * @returns Base64 nonce 和密文及 16 字节认证标签。
 * @throws 参数无效、序列化失败、不支持的平台、密钥不存在或加密失败时抛出异常。
 */
export function encryptJsonWithAssociatedData(alias: string, value: unknown, associatedData: string): EncryptedBody {
    if (typeof associatedData !== 'string')
        throw new Error('Associated data must be a string.');

    const plaintext = JSON.stringify(value);

    if (plaintext === undefined)
        throw new Error('Value must be JSON serializable.');

    const result = nativeCrypto().JsonBodyCipher.encryptWithAssociatedData(alias, plaintext, associatedData);

    return { nonce: result.getNonce(), data: result.getData() };
}

/**
 * UTF-8 AAD 参与认证，不加密、不包含在消息体中；空字符串兼容无 AAD。
 *
 * @param alias 已导入的密钥别名，非空白且最多 128 个字符。
 * @param body 包含标准 Base64 nonce 和密文及认证标签的消息体。
 * @param associatedData 附加认证字符串，不能为 null；解密时 UTF-8 字节必须与加密时完全一致。
 * @returns JSON 解析结果；泛型 T 默认 unknown，不进行运行时结构验证。
 * @typeParam T 调用方预期的数据类型。
 * @throws 参数无效、不支持的平台、密钥不存在、认证失败或 JSON 解析失败时抛出异常；认证失败不返回明文。
 */
export function decryptJsonWithAssociatedData<T = unknown>(alias: string, body: EncryptedBody, associatedData: string): T {
    if (typeof associatedData !== 'string')
        throw new Error('Associated data must be a string.');
    if (!body || typeof body.nonce !== 'string' || typeof body.data !== 'string')
        throw new Error('Encrypted body must contain nonce and data strings.');

    return JSON.parse(nativeCrypto().JsonBodyCipher.decryptWithAssociatedData(alias, body.nonce, body.data, associatedData)) as T;
}

/**
 * 携带 Bearer JWT 通过 HTTPS GET 获取 { keyId, key } 并导入 Keystore。keyId 为 1 至 96 个英文字母、数字、点、下划线或连字符；key 为标准 Base64 AES 密钥。
 * 禁止跟随重定向；已有别名拒绝覆盖。不返回原始密钥，原始密钥暂时经过内存。
 *
 * @param options 请求地址、调用方提供的 JWT 及可选超时；组件不负责登录或刷新 JWT。
 * @returns 导入成功后返回 keyId 和 ajaxjs.aes.${keyId} 别名。
 * @throws 不支持的平台、参数无效、网络错误、非 2xx 状态、响应无效或导入失败时 Promise 拒绝。
 */
export async function provisionAesKey(options: ProvisionKeyOptions): Promise<ProvisionKeyResult> {
    nativeCrypto();
    
    if (!/^https:\/\/[^\s/#?@]+(?:[/?][^\s#]*)?$/i.test(options.endpoint))
        throw new Error('A valid HTTPS key endpoint without embedded credentials is required.');
    
    if (!options.jwt.trim() || /[\r\n]/.test(options.jwt))
        throw new Error('A bearer JWT is required.');
    
    if (options.timeout !== undefined && (!Number.isFinite(options.timeout) || options.timeout <= 0))
        throw new Error('Timeout must be a positive number.');
    
    let response;
    
    try {
        response = await Http.request({
            url: options.endpoint,
            method: 'GET',
            headers: { Authorization: `Bearer ${options.jwt.trim()}`, Accept: 'application/json' },
            timeout: options.timeout ?? 15000,
            dontFollowRedirects: true
        });
    } catch {
        throw new Error('Key request failed. Check connectivity and HTTPS configuration.');
    }
    
    if (response.statusCode < 200 || response.statusCode >= 300)
        throw new Error(`Key endpoint returned HTTP ${response.statusCode}.`);
    
    let payload: unknown;
    
    try {
        payload = response.content?.toJSON();
    } catch {
        throw new Error('Key endpoint returned invalid JSON.');
    }

    if (!payload || typeof payload !== 'object')
        throw new Error('Expected a keyId and key response.');
    
    const entry = payload as Record<string, unknown>;
    
    if (typeof entry.keyId !== 'string' || !/^[A-Za-z0-9._-]{1,96}$/.test(entry.keyId))
        throw new Error('keyId must contain 1 to 96 letters, digits, dots, underscores or hyphens.');
    
    if (typeof entry.key !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.key) || !entry.key)
        throw new Error('Key endpoint returned an invalid Base64 key.');
    
    const keyId = entry.keyId;
    const alias = `ajaxjs.aes.${keyId}`;

    try {
        importAesKey(alias, entry.key);
    } finally {
        entry.key = undefined;
        payload = undefined;
        response = undefined;
    }
    
    return { keyId, alias };
}
