import { isAndroid, isIOS, Utils } from '@nativescript/core';

/**
 * 进程内按提交顺序执行；Promise 不代表原生 I/O 在后台线程执行，仅用于小型凭据。
 */
let operations: Promise<void> = Promise.resolve();

/**
 * 写入或覆盖 token 或 JSON.stringify 后的 MQTT 凭据，空字符串有效。
 * @param key 非空白且最多 128 UTF-16 单元，不 trim 或规范化。
 * @param value 合法 Unicode 字符串，最多 65536 UTF-8 字节，不自动序列化。
 * @returns 原生写入完成后 resolve；同名项被替换。
 * @throws 参数、平台、桥接、Keychain/Keystore 或磁盘错误通过 Promise reject。
 * Android 本机独立 AES-256-GCM 密钥不可导出，密文在不备份的私有目录；
 * iOS 使用独立 Keychain service，WhenUnlockedThisDeviceOnly 且不同步。
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
    validateKey(key);
    if (typeof value !== 'string' || !validUnicode(value))
        throw new TypeError('Secure storage value must be a valid Unicode string.');
    let bytes = 0;
    for (const character of value) {
        const point = character.codePointAt(0)!;
        bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
        if (bytes > 65536)
            throw new RangeError('Secure storage value must be at most 65536 UTF-8 bytes.');
    }
    return enqueue(() => { bridge('set', key, value); });
}

/**
 * 读取原始字符串，仅不存在返回 null，已保存空字符串返回 ''；不进行 JSON.parse。
 * @param key 与写入时完全相同的逻辑键名。
 * @returns 原始字符串或 null，不打印凭据。
 * @throws 参数、平台、桥接、Keychain 锁定、密钥失效、密文损坏、认证或磁盘失败时 reject。
 * 不将存储故障伪装成未找到，调用方应显式处理异常。
 */
export async function getSecureItem(key: string): Promise<string | null> {
    validateKey(key);
    return enqueue(() => {
        const value = bridge('get', key);
        if (value === null || value === undefined)
            return null;
        if (typeof value !== 'string')
            throw new Error('Secure storage returned an invalid value.');
        return value;
    });
}

/**
 * 幂等删除指定项；不删除其他项或机器人 AES 密钥，不保证闪存物理擦除。
 * @param key 与写入时完全相同的逻辑键名。
 * @returns 原生删除完成后 resolve，不存在也成功。
 * @throws 参数、平台、桥接或原生删除错误通过 Promise reject。
 * 退出登录时调用，不能依赖卸载清理 iOS Keychain。
 */
export async function removeSecureItem(key: string): Promise<void> {
    validateKey(key);
    return enqueue(() => { bridge('remove', key); });
}

function enqueue<T>(action: () => T): Promise<T> {
    const operation = operations.then(action);
    operations = operation.then(() => undefined, () => undefined);
    return operation;
}

function validateKey(key: string): void {
    if (typeof key !== 'string' || !key.trim() || key.length > 128 || !validUnicode(key))
        throw new TypeError('Secure storage key must be nonblank, valid Unicode and at most 128 UTF-16 units.');
}

function validUnicode(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const unit = value.charCodeAt(index);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff))
                return false;
        } else if (unit >= 0xdc00 && unit <= 0xdfff)
            return false;
    }
    return true;
}

function bridge(operation: 'set' | 'get' | 'remove', key: string, value?: string): unknown {
    if (isAndroid) {
        const storage = typeof com === 'undefined' ? undefined : com.ajaxjs?.nativescript?.android?.storage?.SecureStorage;
        const method = operation === 'set' ? 'setItem' : operation === 'get' ? 'getItem' : 'removeItem';
        if (!storage || typeof storage[method] !== 'function')
            throw new Error('Rebuild the common Android JAR and metadata with SecureStorage support; include com.ajaxjs.nativescript.android*:* in native-api-usage.json.');
        const context = Utils.android.getApplicationContext();
        if (!context)
            throw new Error('Android application context is not available.');
        if (operation === 'set')
            return storage.setItem(context, key, value!);
        if (operation === 'get')
            return storage.getItem(context, key);
        return storage.removeItem(context, key);
    }
    if (isIOS) {
        const method = operation === 'set' ? 'setItemValue' : operation === 'get' ? 'getItem' : 'removeItem';
        if (typeof AjaxJSSecureStorage === 'undefined' || typeof AjaxJSSecureStorage[method] !== 'function')
            throw new Error('Rebuild AjaxJSCommon XCFramework with SecureStorage support.');
        const result = operation === 'set' ? AjaxJSSecureStorage.setItemValue(key, value!)
            : operation === 'get' ? AjaxJSSecureStorage.getItem(key) : AjaxJSSecureStorage.removeItem(key);
        if (!result)
            throw new Error('Secure storage returned no native result.');
        if (result.error)
            throw new Error(result.error);
        return result.value;
    }
    throw new Error('Secure storage requires Android or iOS.');
}
