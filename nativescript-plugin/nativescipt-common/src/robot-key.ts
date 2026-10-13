import { isAndroid, isIOS } from '@nativescript/core';

/**
 * 机器人密钥派生协议 v2 的固定参数；UTF-8 编码，不含 NUL 结尾。
 */
export const ROBOT_KEY_DERIVATION_V2 = Object.freeze({
    algorithm: 'HKDF-SHA256',
    salt: 'ajaxjs/robot/key-derivation/v2',
    infoEncoding: 'normalized-mac-utf8',
    outputByteCount: 32
} as const);

/**
 * 规范化机器人 MAC；不读取手机 MAC，不自动 trim。
 * @param robotMac 12 位十六进制，或使用一致冒号/连字符分隔的六个字节。
 * @returns 小写、无分隔符的 12 位 ASCII 字符，保留前导零。
 * @throws 非字符串、空白、混用分隔符、长度或十六进制字符无效时抛出异常。
 */
export function normalizeRobotMac(robotMac: string): string {
    if (typeof robotMac !== 'string' || !/^(?:[0-9a-f]{12}|[0-9a-f]{2}(?::[0-9a-f]{2}){5}|[0-9a-f]{2}(?:-[0-9a-f]{2}){5})$/i.test(robotMac)
        || /\s/.test(robotMac))
        throw new Error('Robot MAC must contain exactly six hexadecimal bytes.');
    return robotMac.replace(/[:-]/g, '').toLowerCase();
}

function validateMaster(masterKeyBase64: string): void {
    if (typeof masterKeyBase64 !== 'string'
        || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(masterKeyBase64)
        || /\s/.test(masterKeyBase64) || ![24, 32, 44].includes(masterKeyBase64.length))
        throw new Error('Master key must be 16, 24, or 32 bytes in canonical standard Base64.');
}

function iosNative(): typeof AjaxJSRobotKey {
    if (typeof AjaxJSRobotKey === 'undefined')
        throw new Error('Rebuild AjaxJSCommon XCFramework with robot key derivation support.');
    return AjaxJSRobotKey;
}

function value(result: AjaxJSCryptoResult): any {
    if (result.error)
        throw new Error(result.error);
    return result.value;
}

/**
 * 固定秘密主密钥 + 机器人 MAC，按 v2 HKDF-SHA256 派生 AES-256 密钥。
 * @param masterKeyBase64 安全随机 16/24/32 字节主密钥的规范标准 Base64，非密码。
 * @param robotMac 机器人稳定 MAC，格式见 normalizeRobotMac；双方须约定同一接口。
 * @returns 32 字节设备密钥的标准 Base64（44 字符，含填充），属于秘密材料。
 * @throws 参数无效、不支持的平台、旧原生组件或原生派生失败时抛出异常。
 * 不保存主密钥或派生密钥；不能记录返回值。优先使用直接导入接口以减少 JS 暴露。
 */
export function deriveRobotAesKey(masterKeyBase64: string, robotMac: string): string {
    validateMaster(masterKeyBase64);
    const mac = normalizeRobotMac(robotMac);
    if (isAndroid)
        return com.ajaxjs.nativescript.android.crypto.RobotKeyDerivation.deriveKey(masterKeyBase64, mac);
    if (isIOS)
        return value(iosNative().deriveKeyRobotMac(masterKeyBase64, mac)) as string;
    throw new Error('Robot key derivation requires Android or iOS.');
}

/**
 * 在原生侧派生设备密钥并导入 Android Keystore / iOS Keychain，不向 JS 返回设备密钥。
 * @param alias 非空白别名，最多 128 个 UTF-16 单元；已有别名拒绝覆盖。
 * @param masterKeyBase64 安全随机 16/24/32 字节主密钥的规范标准 Base64。
 * @param robotMac 机器人稳定 MAC，格式见 normalizeRobotMac。
 * @returns 无返回值，正常返回表示成功；主密钥不持久化。
 * @throws 参数无效、重复别名、不支持的平台、旧原生组件、派生或安全存储失败时抛出异常。
 * 主密钥仍经过 JS/原生内存；清理临时数据不能保证全部副本立即擦除。
 */
export function deriveAndImportRobotAesKey(alias: string, masterKeyBase64: string, robotMac: string): void {
    if (typeof alias !== 'string' || alias.length > 128 || !alias.replace(/[\u0000-\u0020]/g, ''))
        throw new Error('Key alias must contain 1 to 128 characters.');
    validateMaster(masterKeyBase64);
    const mac = normalizeRobotMac(robotMac);
    if (isAndroid) {
        com.ajaxjs.nativescript.android.crypto.RobotKeyDerivation.deriveAndImportKey(alias, masterKeyBase64, mac);
    } else if (isIOS) {
        value(iosNative().deriveAndImportKeyMasterKeyBase64RobotMac(alias, masterKeyBase64, mac));
    } else {
        throw new Error('Robot key derivation requires Android or iOS.');
    }
}
