import { isAndroid, isIOS, Utils } from '@nativescript/core';

/**
 * 两端一致的固定安全存储键；退出登录时可用 removeSecureItem 显式删除。
 */
export const MQTT_USERNAME_KEY = 'mqtt_username';

export const MQTT_PASSWORD_KEY = 'mqtt_password';

/**
 * 客户端认证 Token 的固定存储键，独立于用户 Token 与 MQTT 凭据。
 */
export const CLIENT_CREDENTIAL_KEY = 'client_credential';

/**
 * AES 密钥字符串的固定安全存储键，不是密码学 Keystore 的密钥别名。
 */
export const AES_KEY_KEY = 'AES_KEY';

/**
 * 同步保存或覆盖 MQTT 账号密码，分别存入两个固定安全项，不请求网络或 Base64 解码。
 * 
 * @param username 原始字符串，可为空，保留空格、Unicode 和下划线，最多 65536 UTF-8 字节。
 * @param password 要求同 username；TS 在写入前校验两个入参。
 * @returns 无返回值，正常返回表示两项写入均已完成。
 * @throws 参数、平台、桥接、Context 或存储错误同步抛出；第二项失败可能留下已更新的第一项。
 * 当前线程执行，不进入异步队列。失败应停止连接，重新获取并保存两项，不能继续使用部分旧值。
 */
export function setMqttCredential(username: string, password: string): void {
    validate(username);
    validate(password);

    if (isAndroid) {
        const [native, context] = androidStorage('setMqttCredential');
        native.setMqttCredential(context, username, password);
    } else if (isIOS) {
        iosStorage('setMqttCredentialPassword');
        iosValue(AjaxJSGetCredential.setMqttCredentialPassword(username, password));
    } else
        throw new Error('Credential storage requires Android or iOS.');
}

/**
 * 同步读取 mqtt_username 原值，不存在返回 null，空字符串仍为 ''，存储失败抛异常。
 * 不请求后端、不校验有效期、不等待未完成的异步写入，可能阻塞当前线程。
 */
export function getMqttUsername(): string | null {
    return read('getMqttUsername');
}

/**
 * 同步读取 mqtt_password，返回值与异常规则同 getMqttUsername。
 * 两个 getter 不是原子快照，不保证与并发写入属于同一批次。
 */
export function getMqttPassword(): string | null {
    return read('getMqttPassword');
}

/**
 * 同步幂等删除 MQTT 用户名与密码，不影响用户 Token 或客户端 Token。
 * 两项删除不是事务；失败同步抛异常，应重试，不能忽略部分删除。
 */
export function removeMqttCredential(): void {
    invokeSync('removeMqttCredential');
}

/**
 * 同步保存/覆盖客户端认证 Token，最多 65536 UTF-8 字节，可为空，原样保留。
 * 不请求后端，不自动附加 Bearer 前缀；参数、桥接或存储失败同步抛异常。
 */
export function saveClientCredential(token: string): void {
    validate(token);

    if (isAndroid) {
        const [native, context] = androidStorage('saveClientCredential');
        native.saveClientCredential(context, token);
    } else if (isIOS) {
        iosStorage('saveClientCredential');
        iosValue(AjaxJSGetCredential.saveClientCredential(token));
    } else
        throw new Error('Credential storage requires Android or iOS.');
}

/**
 * 同步读取 client_credential 原值，缺失 null，空字符串保留；失败同步抛异常。
 */
export function getClientCredential(): string | null {
    return read('getClientCredential');
}

/**
 * 同步幂等删除客户端 Token，不影响用户 Token/MQTT 凭据；失败同步抛异常。
 */
export function removeClientCredential(): void {
    invokeSync('removeClientCredential');
}

/**
 * 同步保存/覆盖 AES_KEY 字符串，最多 65536 UTF-8 字节，允许空字符串，原样保留。
 * 通常保存 Base64 文本，但不校验 Base64/AES 长度，不执行 HKDF，不导入密码学密钥。
 * @throws 参数、平台、桥接、Context 或安全存储错误同步抛出。
 */
export function saveAesKey(key: string): void {
    validate(key);
    if (isAndroid) {
        const [native, context] = androidStorage('saveAesKey');
        native.saveAesKey(context, key);
    } else if (isIOS) {
        iosStorage('saveAesKey');
        iosValue(AjaxJSGetCredential.saveAesKey(key));
    } else
        throw new Error('Credential storage requires Android or iOS.');
}

/**
 * 同步读取 AES_KEY 原值，缺失 null，空字符串保留，失败同步抛异常。
 * 返回值是秘密字符串，不记录日志；当前线程可能因存储读取而阻塞。
 */
export function getAesKey(): string | null {
    return read('getAesKey');
}

/**
 * 同步幂等删除 AES_KEY 字符串，失败抛异常；不删除 importAesKey 导入的别名密钥。
 */
export function removeAesKey(): void {
    invokeSync('removeAesKey');
}

function invokeSync(method: 'getMqttUsername' | 'getMqttPassword' | 'getClientCredential' | 'removeMqttCredential' | 'removeClientCredential' | 'getAesKey' | 'removeAesKey'): unknown {
    if (isAndroid) {
        const [native, context] = androidStorage(method);
        return native[method](context);
    }
    if (isIOS) {
        iosStorage(method);
        return iosValue(AjaxJSGetCredential[method]());
    }
    throw new Error('Credential storage requires Android or iOS.');
}

function read(method: 'getMqttUsername' | 'getMqttPassword' | 'getClientCredential' | 'getAesKey'): string | null {
    const value = invokeSync(method);
    if (value === null || value === undefined)
        return null;
    if (typeof value !== 'string')
        throw new Error('Credential storage returned an invalid value.');
    return value;
}

function androidStorage(method: 'saveAesKey' | 'setMqttCredential' | 'getMqttUsername' | 'getMqttPassword' | 'removeMqttCredential' | 'saveClientCredential' | 'getClientCredential' | 'removeClientCredential' | 'getAesKey' | 'removeAesKey') {
    const native = typeof com === 'undefined' ? undefined : com.ajaxjs?.nativescript?.android?.storage?.GetCredential;
    
    if (!native || typeof native[method] !== 'function')
        throw new Error('Rebuild the common Android JAR and metadata with GetCredential support.');
    
    const context = Utils.android.getApplicationContext();
    
    if (!context)
        throw new Error('Android application context is not available.');
    
    return [native, context] as const;
}

function iosStorage(method: 'saveAesKey' | 'setMqttCredentialPassword' | 'getMqttUsername' | 'getMqttPassword' | 'removeMqttCredential' | 'saveClientCredential' | 'getClientCredential' | 'removeClientCredential' | 'getAesKey' | 'removeAesKey'): void {
    if (typeof AjaxJSGetCredential === 'undefined' || typeof AjaxJSGetCredential[method] !== 'function')
        throw new Error('Rebuild AjaxJSCommon XCFramework with GetCredential support.');
}

function iosValue(result: AjaxJSCryptoResult): unknown {
    if (!result)
        throw new Error('Credential storage returned no native result.');
    
    if (result.error)
        throw new Error(result.error);
    
    return result.value;
}

function validate(value: string): void {
    if (typeof value !== 'string')
        throw new TypeError('Credentials must be strings.');
    let bytes = 0;

    for (const character of value) {
        const point = character.codePointAt(0)!;

        if (point >= 0xd800 && point <= 0xdfff)
            throw new TypeError('Credentials must contain valid Unicode.');

        bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
        
        if (bytes > 65536)
            throw new RangeError('Each credential must be at most 65536 UTF-8 bytes.');
    }
}
