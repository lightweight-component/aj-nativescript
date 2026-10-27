import { isAndroid, isIOS, Utils } from '@nativescript/core';

/**
 * 与两端 GetCredential 保持一致的固定安全存储键，退出登录可用 removeSecureItem 删除。
 */
export const USER_TOKEN_KEY = 'user_token';
export const USER_REFRESH_TOKEN_KEY = 'user_refresh_token';

let operations: Promise<void> = Promise.resolve();

/**
 * 安全保存或覆盖登录 Token 与 refreshToken；不请求后端，不自动迁移 ApplicationSettings。
 * @param userToken 原始字符串，不附加 Bearer，不 trim，允许空值，最多 65536 UTF-8 字节。
 * @param refreshToken 原始刷新令牌，要求同 userToken；两项均在写入前校验。
 * @returns 两项原生写入完成后 resolve；本模块按提交顺序执行调用。
 * @throws 参数、平台、桥接或安全存储失败时 reject，不记录 Token。
 * 两项写入不是事务，存储失败可能只写入第一项；应显式处理失败并重试。
 * Android 原生存储在后台执行并回到主线程通知；iOS 为同步小型 Keychain I/O，不请求网络。
 */
export async function saveUserToken(userToken: string, refreshToken: string): Promise<void> {
    validateToken(userToken);
    validateToken(refreshToken);

    return enqueue(async () => { await invoke('saveUserToken', userToken, refreshToken); });
}

/**
 * 同步幂等删除 user_token 与 user_refresh_token，不影响 MQTT/客户端凭据。
 * @throws 原生桥接、Context 或存储错误同步抛出；两次删除非事务，失败应重试。
 * 不进入异步队列，不取消未完成的保存或刷新；调用方应先等待在途保存并停止旧刷新写回。
 */
export function removeUserToken(): void {
    readSync('removeUserToken');
}

/**
 * 读取 user_token，缺失返回 null，已保存空字符串返回 ''；存储失败 reject。
 * 不校验有效期、不刷新，也不代表服务端认可该 Token。
 */
export async function getUserToken(): Promise<string | null> {
    return enqueue(async () => tokenValue(await invoke('getUserToken')));
}

/**
 * 读取 user_refresh_token，返回值和异常规则与 getUserToken 相同。
 */
export async function getUserRefreshToken(): Promise<string | null> {
    return enqueue(async () => tokenValue(await invoke('getUserRefreshToken')));
}

/**
 * 同步读取 user_token，直接调用原生安全存储，不进入异步队列。
 * @returns 原始字符串；不存在为 null，已保存空字符串为 ''。
 * @throws 平台不支持、桥接/Context 不可用或安全存储失败时同步抛出异常。
 * 在当前线程执行磁盘/Keychain 读取与解密，可能阻塞界面。
 * 不等待尚未完成的 saveUserToken；保存后读取应先 await 保存完成。
 */
export function getUserTokenSync(): string | null {
    return tokenValue(readSync('getUserToken'));
}

/**
 * 同步读取 user_refresh_token；返回值、异常及阻塞行为同 getUserTokenSync。
 * 两次同步读取不是一个原子快照，不校验有效期或自动刷新 Token。
 */
export function getUserRefreshTokenSync(): string | null {
    return tokenValue(readSync('getUserRefreshToken'));
}

function readSync(method: 'getUserToken' | 'getUserRefreshToken' | 'removeUserToken'): unknown {
    if (isAndroid) {
        const native = typeof com === 'undefined' ? undefined : com.ajaxjs?.nativescript?.android?.storage?.GetCredential;

        if (!native || typeof native[method] !== 'function')
            throw new Error('Rebuild the common Android JAR and metadata with GetCredential token support.');

        const context = Utils.android.getApplicationContext();

        if (!context)
            throw new Error('Android application context is not available.');

        return native[method](context);
    }

    if (isIOS) {
        if (typeof AjaxJSGetCredential === 'undefined' || typeof AjaxJSGetCredential[method] !== 'function')
            throw new Error('Rebuild AjaxJSCommon XCFramework with GetCredential token support.');
        return iosValue(AjaxJSGetCredential[method]());
    }

    throw new Error('User token storage requires Android or iOS.');
}

function iosValue(result: AjaxJSCryptoResult): unknown {
    if (!result)
        throw new Error('User token storage returned no native result.');

    if (result.error)
        throw new Error(result.error);

    return result.value;
}

function enqueue<T>(action: () => T | Promise<T>): Promise<T> {
    const operation = operations.then(action);
    operations = operation.then(() => undefined, () => undefined);

    return operation;
}

function tokenValue(value: unknown): string | null {
    if (value === null || value === undefined)
        return null;
    if (typeof value !== 'string')
        throw new Error('User token storage returned an invalid value.');
    return value;
}

function validateToken(value: string): void {
    if (typeof value !== 'string')
        throw new TypeError('User token and refresh token must be strings.');

    let bytes = 0;

    for (let index = 0; index < value.length; index++) {
        const unit = value.charCodeAt(index);

        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(++index);
            if (!(next >= 0xdc00 && next <= 0xdfff))
                throw new TypeError('Tokens must contain valid Unicode.');
            bytes += 4;
        } else {
            if (unit >= 0xdc00 && unit <= 0xdfff)
                throw new TypeError('Tokens must contain valid Unicode.');
            bytes += unit <= 0x7f ? 1 : unit <= 0x7ff ? 2 : 3;
        }

        if (bytes > 65536)
            throw new RangeError('Each token must be at most 65536 UTF-8 bytes.');
    }
}

async function invoke(method: 'saveUserToken' | 'getUserToken' | 'getUserRefreshToken', token?: string, refresh?: string): Promise<unknown> {
    if (isAndroid) {
        const native = typeof com === 'undefined' ? undefined : com.ajaxjs?.nativescript?.android?.storage?.GetCredential;
        const asyncMethod = `${method}Async` as 'saveUserTokenAsync' | 'getUserTokenAsync' | 'getUserRefreshTokenAsync';

        if (!native || !native.TokenCallback || typeof native[asyncMethod] !== 'function')
            throw new Error('Rebuild the common Android JAR and metadata with GetCredential token support.');

        const context = Utils.android.getApplicationContext();

        if (!context)
            throw new Error('Android application context is not available.');

        return new Promise((resolve, reject) => {
            const callback = new native.TokenCallback({
                onResult: value => resolve(value),
                onError: message => reject(new Error(message))
            });

            if (method === 'saveUserToken')
                native.saveUserTokenAsync(context, token!, refresh!, callback);
            else if (method === 'getUserToken')
                native.getUserTokenAsync(context, callback);
            else
                native.getUserRefreshTokenAsync(context, callback);
        });
    }

    if (isIOS) {
        const selector = method === 'saveUserToken' ? 'saveUserTokenRefreshToken' : method;
        if (typeof AjaxJSGetCredential === 'undefined' || typeof AjaxJSGetCredential[selector] !== 'function')
            throw new Error('Rebuild AjaxJSCommon XCFramework with GetCredential token support.');
        const result = method === 'saveUserToken' ? AjaxJSGetCredential.saveUserTokenRefreshToken(token!, refresh!)
            : method === 'getUserToken' ? AjaxJSGetCredential.getUserToken() : AjaxJSGetCredential.getUserRefreshToken();
        return iosValue(result);
    }

    throw new Error('User token storage requires Android or iOS.');
}
