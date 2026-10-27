/// <reference types="@nativescript/types" />

/**
 * Resolve platform types outside com.ajaxjs.nativescript.android to avoid name shadowing.
 */
type AjaxjsAndroidContext = android.content.Context;
type AjaxjsAndroidActivity = android.app.Activity;

/**
 * 原生确认框桥接；JSON 的颜色字段为 #AARRGGBB，优先使用统一 confirm(options)。
 */
declare namespace com.ajaxjs.nativescript.android.utils {
    class ConfirmDialog extends java.lang.Object {
        /**
         * 主线程显示；确认 true，其余正常关闭 false。显示或参数错误触发 onError。
         * 无 Activity 返回 false，回调最多一次；调用方须避免同时显示多个原生弹窗。
         */
        static show(activity: AjaxjsAndroidActivity | null, optionsJson: string, callback: ConfirmDialog.Callback): void;
    }
    namespace ConfirmDialog {
        /**
         * Java 回调接口代理，onResult 与 onError 只会调用其中一个一次。
         */
        class Callback extends java.lang.Object {
            constructor(implementation: { onResult(confirmed: boolean): void; onError(message: string): void });
            onResult(confirmed: boolean): void;
            onError(message: string): void;
        }
    }
}

/**
 * iOS 确认框；completion 主线程单次调用，无活动窗口 false，错误返回非空 error。
 */
declare class AjaxJSConfirmDialog extends NSObject {
    static showCompletion(optionsJson: string, completion: (confirmed: boolean, error: string | null) => void): void;
}

/**
 * Android-only APIs; the aj-nativescript JAR must be installed in the host app.
 */
declare namespace com.ajaxjs.nativescript.android {
    namespace crypto {
        /**
         * Android 8.0 及以上的 Keystore AES 密钥管理，不提供密钥导出接口。
         */
        class AesKeyStore extends java.lang.Object {
            static class: java.lang.Class<AesKeyStore>;
            private constructor();
            /**
             * 将标准 Base64 AES 密钥导入 Android Keystore；已有别名拒绝覆盖，轮换时使用新别名。原始密钥暂时经过内存，请勿记录日志或持久化。
             *
             * @param alias 非空白密钥别名，最多 128 个字符。
             * @param keyBase64 标准 Base64 编码的密钥，解码后必须为 16、24 或 32 字节。
             * @returns 无返回值，正常返回表示导入成功。
             * @throws 参数无效、别名已存在或 Keystore 操作失败时抛出异常。
             */
            static importKey(alias: string, keyBase64: string): void;
            /**
             * 检查指定别名是否存在；存在不保证后续加解密成功。
             *
             * @param alias 非空白密钥别名，最多 128 个字符。
             * @returns 存在为 true，否则为 false。
             * @throws 别名无效或 Keystore 查询失败时抛出异常。
             */
            static hasKey(alias: string): boolean;
            /**
             * 删除密钥；不存在时不执行操作。删除后旧密文需重新导入相同密钥才能解密。
             *
             * @param alias 非空白密钥别名，最多 128 个字符。
             * @returns 无返回值。
             * @throws 别名无效或 Keystore 删除失败时抛出异常。
             */
            static deleteKey(alias: string): void;
        }
        /**
         * 不可变的 AES-GCM 加密结果，由 JsonBodyCipher.encrypt 返回。
         */
        class EncryptedBody extends java.lang.Object {
            static class: java.lang.Class<EncryptedBody>;
            private constructor();
            /**
             * 获取加密消息 nonce，必须与密文一起保存和传输。
             *
             * @returns 标准 Base64 编码的 12 字节 nonce。
             */
            getNonce(): string;
            /**
             * 获取密文及 GCM 认证标签。
             *
             * @returns 标准 Base64 编码的密文，末尾包含 16 字节认证标签。
             */
            getData(): string;
        }
        /**
         * 基于 Keystore 的 UTF-8 文本加解密；JSON 序列化由调用方负责。
         */
        class JsonBodyCipher extends java.lang.Object {
            static class: java.lang.Class<JsonBodyCipher>;
            private constructor();
            /**
             * 使用 Keystore AES 密钥加密 UTF-8 文本；AES/GCM/NoPadding，每次生成新的 12 字节 nonce。不验证文本是否为 JSON。
             *
             * @param alias 已导入的 AES 密钥别名，非空白且最多 128 个字符。
             * @param plaintext 待加密文本，不能为 null；允许空字符串。
             * @returns 包含 Base64 nonce 和密文及 16 字节认证标签的消息体。
             * @throws 参数无效、密钥不存在或加密失败时抛出异常。
             */
            static encrypt(alias: string, plaintext: string): EncryptedBody;
            /**
             * UTF-8 AAD 参与认证，不加密、不包含在消息体中；空字符串兼容无 AAD。
             *
             * @param alias 已导入的密钥别名，非空白且最多 128 个字符。
             * @param plaintext UTF-8 正文，允许空字符串。
             * @param associatedData 附加认证字符串，不能为 null；解密时 UTF-8 字节必须与加密时完全一致。
             * @returns Base64 nonce 和密文及 16 字节认证标签。
             * @throws 参数无效、密钥不存在或加密失败时抛出异常。
             */
            static encryptWithAssociatedData(alias: string, plaintext: string, associatedData: string): EncryptedBody;
            /**
             * 验证 GCM 认证标签并解密 UTF-8 文本；认证失败不返回明文。
             *
             * @param alias 已导入的 AES 密钥别名，非空白且最多 128 个字符。
             * @param nonceBase64 标准 Base64 nonce，解码后必须为 12 字节。
             * @param dataBase64 标准 Base64 密文及认证标签，解码后至少为 16 字节。
             * @returns 解密后的 UTF-8 文本，不进行 JSON 解析。
             * @throws 参数无效、密钥不存在、认证失败或解密失败时抛出异常。
             */
            static decrypt(alias: string, nonceBase64: string, dataBase64: string): string;
            /**
             * UTF-8 AAD 参与认证，不加密、不包含在消息体中；空字符串兼容无 AAD。
             *
             * @param alias 已导入的密钥别名，非空白且最多 128 个字符。
             * @param nonceBase64 标准 Base64 编码的 12 字节 nonce。
             * @param dataBase64 标准 Base64 密文及认证标签，至少 16 字节。
             * @param associatedData 附加认证字符串，不能为 null；解密时 UTF-8 字节必须与加密时完全一致。
             * @returns 认证成功后的 UTF-8 正文。
             * @throws 参数无效、密钥不存在、AAD 不匹配或认证失败时抛出异常。
             */
            static decryptWithAssociatedData(alias: string, nonceBase64: string, dataBase64: string, associatedData: string): string;
        }
    }
    /**
     * Java 组件基本信息。
     */
    class AjNativescript extends java.lang.Object {
        static class: java.lang.Class<AjNativescript>;
        private constructor();
        /**
         * 获取 Java 组件名称。
         *
         * @returns 组件名称字符串。
         */
        static getName(): string;
    }

    namespace utils {
        /**
         * Android 剪贴板、提示、网络、语言及应用信息工具。
         */
        class Helper extends java.lang.Object {
            static class: java.lang.Class<Helper>;
            static readonly TAG: string;
            constructor();
            /**
             * 复制文本到系统剪贴板。
             *
             * @param context 非空的应用或页面上下文。
             * @param text 待复制文本。
             * @returns 无返回值。
             */
            static copyToClipboard(context: AjaxjsAndroidContext, text: string): void;
            /**
             * 同步读取首个剪贴项目，尝试转换为文本；不可读时返回空字符串，不 trim。
             * 应在前台响应用户操作调用；系统访问异常向调用方传播。
             */
            static getFromClipboard(context: AjaxjsAndroidContext): string;
            /**
             * 显示短时 Toast；允许后台线程调用，内部切换到主线程显示。
             *
             * @param context 应用或页面上下文；null 时不显示。
             * @param message 提示文字。
             * @returns 无返回值，不等待提示显示完毕。
             */
            static toast(context: AjaxjsAndroidContext | null, message: string): void;
            /**
             * 同步解析 www.baidu.com 的 DNS，必须在后台线程调用；宿主需声明 INTERNET 权限。解析成功不保证业务服务器可达，DNS 缓存可能影响结果。
             *
             * @returns 解析成功为 true；UnknownHostException 时记录日志并返回 false。
             * @throws 主线程网络限制等其他异常可能向调用方传播。
             */
            static isNetworkAvailable(): boolean;
            /**
             * 查询默认网络是否具有互联网能力且通过系统验证，可在主线程调用。宿主需声明 ACCESS_NETWORK_STATE 权限；不保证业务服务器可达。
             *
             * @param context 应用或页面上下文，可为 null。
             * @returns 已验证网络为 true；上下文或服务为空、无验证网络或缺少权限时为 false。
             */
            static isInternetAvailable(context: AjaxjsAndroidContext | null): boolean;
            /**
             * 读取 Context 资源配置的首选语言，可能受应用独立语言设置影响。
             *
             * @param context 应用或页面上下文，null 时返回 null。
             * @returns zh、en 等语言代码，不含地区或文字体系；无首选语言时为 null。
             */
            static getSystemLanguageByCxt(context: AjaxjsAndroidContext | null): string | null;
            /**
             * 读取系统资源配置的首选语言，不使用应用 Context 的语言配置。
             *
             * @returns zh、en 等语言代码，不含地区或文字体系；列表为空时为 null。
             */
            static getSystemLanguage(): string | null;
            /**
             * 判断 Context 资源配置是否启用夜间模式。
             *
             * @param context 应用或页面上下文，可为 null。
             * @returns 夜间模式为 true，其他模式或上下文为空时为 false。
             */
            static isDarkMode(context: AjaxjsAndroidContext | null): boolean;
            /**
             * 获取当前应用版本名称。
             *
             * @param context 非空的当前应用上下文。
             * @returns versionName；未找到包信息时记录日志并返回 null。
             */
            static getVersionName(context: AjaxjsAndroidContext): string | null;
            /**
             * 获取当前应用版本代码；Android 9 及以上使用 longVersionCode。Java long 映射为 JS number，超过 Number.MAX_SAFE_INTEGER 时可能丢失精度。
             *
             * @param context 非空的当前应用上下文。
             * @returns 版本代码；未找到包信息时记录日志并返回 -1。
             */
            static getVersionCode(context: AjaxjsAndroidContext): number;
        }

        /**
         * 时间、安全随机字符串和 Base64 文本编码工具。
         */
        class Utils extends java.lang.Object {
            static class: java.lang.Class<Utils>;
            constructor();
            /**
             * 将 UTF-8 文本编码为标准 Base64，不换行并保留所需填充；不提供加密保护。
             *
             * @param text 原始文本，不得为 null；允许空字符串。
             * @returns Base64 字符串；空输入返回空字符串。
             * @throws 输入为 null 时抛出 IllegalArgumentException。
             */
            static encodeBase64(text: string): string;
            /**
             * 将标准 Base64 解码为 UTF-8 文本，不去除空白，不接受 URL-safe 字符表。
             * 允许省略末尾填充；二进制密钥不应通过此文本接口解码。
             *
             * @param encoded Base64 字符串，不得为 null；允许空字符串。
             * @returns 解码后的文本；空输入返回空字符串。
             * @throws 输入为 null、Base64 无效或不是有效 UTF-8 时抛出 IllegalArgumentException。
             */
            static decodeBase64(encoded: string): string;
            /**
             * 获取设备当前时区的本地时间。
             *
             * @returns yyyy-MM-dd HH:mm:ss 格式的时间文本，不包含时区信息。
             */
            static now(): string;
            /**
             * 使用 SecureRandom 生成大小写英文字母和数字组成的随机字符串。
             *
             * @param length 非负整数长度，按 Java int 传递；0 返回空字符串。
             * @returns 指定长度的随机字符串。
             * @throws 长度为负数时抛出异常。
             */
            static generateRandomString(length: number): string;
        }

        /**
         * Android 应用市场查询与跳转工具。
         */
        class MarketRedirect extends java.lang.Object {
            static class: java.lang.Class<MarketRedirect>;
            constructor();
            /**
             * 获取设备品牌。
             *
             * @returns 使用 Locale.ROOT 转为小写的品牌；系统未提供时为空字符串。
             */
            static getPhoneBrand(): string;
            /**
             * 获取设备制造商。
             *
             * @returns 使用 Locale.ROOT 转为小写的制造商；系统未提供时为空字符串。
             */
            static getManufacturer(): string;
            /**
             * 根据品牌和制造商选择推荐市场，不检查市场是否安装。
             *
             * @returns 推荐市场包名；未匹配厂商时返回 com.android.vending。
             */
            static getMarketPackageName(): string;
            /**
             * 打开应用市场详情页；无法打开或权限被拒绝时仅记录日志，无自动回退。
             *
             * @param context 非空的应用或页面上下文，使用 NEW_TASK 启动页面。
             * 目标应用包名取自 context；市场按设备品牌和制造商推荐。
             * @returns 无返回值，无法通过返回值判断跳转是否成功。
             */
            static redirect(context: AjaxjsAndroidContext): void;
            /**
             * 打开应用市场详情页；无法打开或权限被拒绝时仅记录日志，无自动回退。
             *
             * @param context 非空的应用或页面上下文，使用 NEW_TASK 启动页面。
             * @param appPackage 目标应用包名。
             * @returns 无返回值，无法通过返回值判断跳转是否成功。
             */
            static redirect(context: AjaxjsAndroidContext, appPackage: string): void;
            /**
             * 打开应用市场详情页；无法打开或权限被拒绝时仅记录日志，无自动回退。
             *
             * @param context 非空的应用或页面上下文，使用 NEW_TASK 启动页面。
             * @param appMarketPackage 指定的 Android 应用市场包名。
             * @param appPackage 目标应用包名。
             * @returns 无返回值，无法通过返回值判断跳转是否成功。
             */
            static redirect(context: AjaxjsAndroidContext, appMarketPackage: string, appPackage: string): void;
            /**
             * 检查包是否已安装且对宿主可见；安装不保证能成功跳转。Android 11 及以上受包可见性限制，宿主可能需声明 queries。
             *
             * @param context 非空的应用或页面上下文。
             * @param packageName 要查询的 Android 包名。
             * @returns 包信息可查询为 true；未安装或不可见时为 false。
             */
            static isPackageInstalled(context: AjaxjsAndroidContext, packageName: string): boolean;
        }

    }
}

/**
 * iOS bridge result. error is null on success; value is boolean, dictionary or text.
 * Native methods return errors rather than throwing across the Objective-C boundary.
 */
declare class AjaxJSCryptoResult extends NSObject {
    readonly value: any;
    readonly error: string | null;
}

/**
 * iOS 15+ Keychain/CryptoKit bridge, supplied by AjaxJSCommon.xcframework.
 */
declare class AjaxJSAes extends NSObject {
    /**
     * Imports a 16/24/32-byte standard Base64 key under a nonblank <=128-unit alias.
     * Returns true or an error for invalid input, duplicate alias or Keychain failure.
     */
    static importKeyKeyBase64(alias: string, keyBase64: string): AjaxJSCryptoResult;
    
    /**
     * Returns a boolean; invalid alias or Keychain query failure returns error.
     */
    static hasKey(alias: string): AjaxJSCryptoResult;

    /**
     * Returns true even if absent; invalid alias or Keychain deletion failure returns error.
     */
    static deleteKey(alias: string): AjaxJSCryptoResult;

    /**
     * Encrypts UTF-8 text; returns NSDictionary nonce/data in standard Base64.
     * Random nonce is 12 bytes; data is ciphertext plus 16-byte tag, no AAD.
     * Invalid alias, missing key or encryption failure returns error.
     */
    static encryptPlaintext(alias: string, plaintext: string): AjaxJSCryptoResult;
    /**
     * UTF-8 AAD 参与认证，不加密、不包含在消息体中；空字符串兼容无 AAD。
     *
     * @param alias 已导入的密钥别名，非空白且最多 128 个字符。
     * @param plaintext UTF-8 正文，允许空字符串。
     * @param associatedData 附加认证字符串，不能为 null；解密时 UTF-8 字节必须与加密时完全一致。
     * @returns 结果对象，value 为 Base64 nonce/data NSDictionary，error 非空表示失败。
     * 异常通过结果的 error 字段返回，不返回密文。
     */
    static encryptWithAssociatedDataPlaintextAssociatedData(alias: string, plaintext: string, associatedData: string): AjaxJSCryptoResult;

    /**
     * Returns authenticated UTF-8 text; nonce must be 12 bytes, data >=16 bytes.
     * Invalid Base64, alias, length, missing key, invalid UTF-8 or tag returns error.
     */
    static decryptNonceBase64DataBase64(alias: string, nonceBase64: string, dataBase64: string): AjaxJSCryptoResult;
    /**
     * UTF-8 AAD 参与认证，不加密、不包含在消息体中；空字符串兼容无 AAD。
     *
     * @param alias 已导入的密钥别名，非空白且最多 128 个字符。
     * @param nonceBase64 标准 Base64 编码的 12 字节 nonce。
     * @param dataBase64 标准 Base64 密文及认证标签，至少 16 字节。
     * @param associatedData 附加认证字符串，不能为 null；解密时 UTF-8 字节必须与加密时完全一致。
     * @returns 结果对象，value 为 UTF-8 正文，error 非空表示失败。
     * 异常通过结果的 error 字段返回；失败不返回明文。
     */
    static decryptWithAssociatedDataNonceBase64DataBase64AssociatedData(alias: string, nonceBase64: string, dataBase64: string, associatedData: string): AjaxJSCryptoResult;
}

/**
 * iOS 15+ 原生 Helper，Objective-C 名称避免与宿主 Helper 冲突。
 * UI 方法通常异步切换到主线程；剪贴板接口同步执行，具体返回值见各方法。
 */
declare class AjaxJSIOSHelper extends NSObject {
    /**
     * 将文本原样写入通用剪贴板，允许空字符串；同步主线程执行。
     */
    static copyToClipboard(text: string): void;
    /**
     * 同步读取首个字符串，不 trim；不可读时为空字符串，系统可能要求粘贴授权。
     */
    static getFromClipboard(): string;
    /**
     * message 为提示文本；空白忽略，在活动窗口显示两秒，不阻挡触摸。
     */
    static showToast(message: string): void;
    /**
     * 返回宿主应用版本字符串，缺失返回 Unknown 并记录日志。
     */
    static getAppVersionName(): string;
    /**
     * 返回宿主构建版本字符串，缺失返回 Unknown 并记录日志。
     */
    static getAppBuildNumber(): string;
    /**
     * appleID 为 ASCII 数字，无 id 前缀；默认中国区，打开失败尝试 HTTPS。
     */
    static openAppInAppStore(appleID: string): void;
    /**
     * isInternational=true 不限定地区；无效 ID 或最终打开失败记录日志。
     */
    static openAppInAppStoreIsInternational(appleID: string, isInternational: boolean): void;
    /**
     * 设置设备横屏向左，受系统和宿主方向配置限制。
     */
    static setLandscapeOrientation(): void;
    /**
     * 设置设备竖屏，受系统和宿主方向配置限制。
     */
    static setPortraitOrientation(): void;
    /**
     * 仅 iOS 16+，请求场景横屏向右；失败记录日志，无场景不执行。
     */
    static requestOrientationChange(): void;
    /**
     * 仅 iOS 16+，请求场景竖屏；失败记录日志，无场景不执行。
     */
    static forcePortrait(): void;
}

/**
 * Android robot key v1 HKDF-SHA256; master key is canonical Base64 of 16/24/32 bytes.
 */
declare namespace com.ajaxjs.nativescript.android.crypto {
    class RobotKeyDerivation extends java.lang.Object {
        /**
         * Returns lowercase separator-free 12-digit MAC. Invalid input throws.
         */
        static normalizeMac(robotMac: string): string;
        /**
         * Returns secret Base64 of a 32-byte key. Invalid input or HMAC failure throws.
         * salt=UTF8(ajaxjs/robot/key-derivation/v2); info=UTF8(normalized MAC).
         */
        static deriveKey(masterKeyBase64: string, robotMac: string): string;
        /**
         * Imports derived key under nonblank <=128-unit alias; no return value.
         * Invalid input, duplicate alias, derivation or Keystore failure throws.
         */
        static deriveAndImportKey(alias: string, masterKeyBase64: string, robotMac: string): void;
    }
}
/**
 * iOS robot key v1 HKDF-SHA256. Errors are returned in CryptoResult.error.
 */
declare class AjaxJSRobotKey extends NSObject {
    /**
     * Parameters: canonical Base64 random 16/24/32-byte master, 12-digit or separated MAC.
     * Success value is secret Base64 of a 32-byte key; invalid input returns error.
     */
    static deriveKeyRobotMac(masterKeyBase64: string, robotMac: string): AjaxJSCryptoResult;
    /**
     * Derives and imports under nonblank <=128-unit alias; success value true.
     * Invalid input, duplicate alias, derivation or Keychain failure returns error.
     */
    static deriveAndImportKeyMasterKeyBase64RobotMac(alias: string, masterKeyBase64: string, robotMac: string): AjaxJSCryptoResult;
}

/**
 * Android 小型凭据存储，独立 Keystore 密钥及 noBackupFilesDir，进程内串行。
 * key 非空白且最多 128 UTF-16 单元，value 最多 65536 UTF-8 字节，均为合法 Unicode。
 * 参数或存储/认证失败抛出异常；异常不包含凭据。
 */
declare namespace com.ajaxjs.nativescript.android.storage {
    class SecureStorage extends java.lang.Object {
        /**
         * 写入或覆盖，空字符串有效；正常返回表示已提交。
         */
        static setItem(context: AjaxjsAndroidContext, key: string, value: string): void;
        /**
         * 返回原始字符串，不存在为 null；密钥失效或损坏抛出异常。
         */
        static getItem(context: AjaxjsAndroidContext, key: string): string | null;
        /**
         * 幂等删除单项；不删除共享存储密钥或其他数据。
         */
        static removeItem(context: AjaxjsAndroidContext, key: string): void;
    }
}

/**
 * iOS 独立 Keychain service；解锁可读，仅限本机，不同步。
 * 必须先检查 error；写入/删除成功 value=true，读取不存在 value=null。
 */
declare class AjaxJSSecureStorage extends NSObject {
    /**
     * key 非空白且最多 128 UTF-16 单元；value 最多 65536 UTF-8 字节，可覆盖为空字符串。
     */
    static setItemValue(key: string, value: string): AjaxJSCryptoResult;
    /**
     * 不存在返回 value=null；锁定、系统或编码错误设置 error。
     */
    static getItem(key: string): AjaxJSCryptoResult;
    /**
     * 幂等删除，错误设置 error。
     */
    static removeItem(key: string): AjaxJSCryptoResult;
}

/**
 * Android 已有的固定键用户 Token 方法；仅本机存储，不涉及网络请求。
 */
declare namespace com.ajaxjs.nativescript.android.storage {
    class GetCredential extends java.lang.Object {
        static readonly AES_KEY_KEY: string;
        /**
         * 同步保存密钥字符串，不校验 AES/Base64 或导入别名；最多 65536 UTF-8 字节。
         */
        static saveAesKey(context: AjaxjsAndroidContext, token: string): void;
        /**
         * 同步读取原始字符串，缺失 null，存储失败抛异常。
         */
        static getAesKey(context: AjaxjsAndroidContext): string | null;
        /**
         * 幂等删除 AES_KEY 字符串，不删除密码学密钥别名，失败抛异常。
         */
        static removeAesKey(context: AjaxjsAndroidContext): void;
        static readonly CLIENT_CREDENTIAL_KEY: string;
        /**
         * 同步幂等删除对应类别；双项删除非事务，失败抛出异常。
         */
        static removeUserToken(context: AjaxjsAndroidContext): void;
        static removeMqttCredential(context: AjaxjsAndroidContext): void;
        static removeClientCredential(context: AjaxjsAndroidContext): void;
        /**
         * 客户端 Token 同步保存/覆盖及读取；最多 65536 UTF-8 字节，缺失 null。
         */
        static saveClientCredential(context: AjaxjsAndroidContext, token: string): void;
        static getClientCredential(context: AjaxjsAndroidContext): string | null;
        static readonly MQTT_USERNAME_KEY: string;
        static readonly MQTT_PASSWORD_KEY: string;
        /**
         * 同步分别读取固定安全项，缺失 null，空字符串保留，存储失败抛异常。
         */
        static getMqttUsername(context: AjaxjsAndroidContext): string | null;
        static getMqttPassword(context: AjaxjsAndroidContext): string | null;
        /**
         * 依次写入两项，不触网或解码；允许下划线，每项最多 65536 UTF-8 字节。
         * 正常返回表示完成；失败可能只写入第一项，抛出异常。
         */
        static setMqttCredential(context: AjaxjsAndroidContext, username: string, password: string): void;
        /**
         * 后台执行对应同步操作，结果主线程回调，不记录凭据。
         */
        static saveUserTokenAsync(context: AjaxjsAndroidContext, userToken: string, refreshToken: string, callback: GetCredential.TokenCallback): void;
        static getUserTokenAsync(context: AjaxjsAndroidContext, callback: GetCredential.TokenCallback): void;
        static getUserRefreshTokenAsync(context: AjaxjsAndroidContext, callback: GetCredential.TokenCallback): void;
        static readonly USER_TOKEN_KEY: string;
        static readonly USER_REFRESH_TOKEN_KEY: string;
        /**
         * 依次写入两项，非事务；每项最多 65536 UTF-8 字节，失败抛出异常。
         */
        static saveUserToken(context: AjaxjsAndroidContext, userToken: string, refreshToken: string): void;
        /**
         * 读取 user_token，缺失 null；存储失败抛出异常。
         */
        static getUserToken(context: AjaxjsAndroidContext): string | null;
        /**
         * 读取 user_refresh_token，缺失 null；存储失败抛出异常。
         */
        static getUserRefreshToken(context: AjaxjsAndroidContext): string | null;
    }
}

/**
 * iOS 固定键 Token 存储；先检查 error，读取缺失时 value=null，写入成功 value=true。
 */
declare class AjaxJSGetCredential extends NSObject {
    static readonly AES_KEY_KEY: string;
    /**
     * AES_KEY 字符串存取；不校验 AES/Base64、不导入别名，须先检查 error。
     * 保存/删除成功 value=true，读取缺失 value=null，允许空字符串。
     */
    static saveAesKey(token: string): AjaxJSCryptoResult;
    static getAesKey(): AjaxJSCryptoResult;
    static removeAesKey(): AjaxJSCryptoResult;
    static readonly CLIENT_CREDENTIAL_KEY: string;
    /**
     * 同步幂等删除对应类别；成功 value=true，失败 error，双项删除非事务。
     */
    static removeUserToken(): AjaxJSCryptoResult;
    static removeMqttCredential(): AjaxJSCryptoResult;
    static removeClientCredential(): AjaxJSCryptoResult;
    /**
     * 客户端 Token 同步保存/读取；最多 65536 UTF-8 字节，读取缺失 value=null。
     */
    static saveClientCredential(token: string): AjaxJSCryptoResult;
    static getClientCredential(): AjaxJSCryptoResult;
    static readonly MQTT_USERNAME_KEY: string;
    static readonly MQTT_PASSWORD_KEY: string;
    /**
     * 同步读取固定安全项，缺失 value=null，错误通过 error 返回。
     */
    static getMqttUsername(): AjaxJSCryptoResult;
    static getMqttPassword(): AjaxJSCryptoResult;
    /**
     * 同步依次写入两个安全项，成功 value=true，失败 error，非事务。
     */
    static setMqttCredentialPassword(username: string, password: string): AjaxJSCryptoResult;
    static readonly USER_TOKEN_KEY: string;
    static readonly USER_REFRESH_TOKEN_KEY: string;
    /**
     * 依次写入两项，非事务；每项最多 65536 UTF-8 字节，允许空字符串。
     */
    static saveUserTokenRefreshToken(userToken: string, refreshToken: string): AjaxJSCryptoResult;
    /**
     * 读取 user_token，Keychain 错误通过 error 返回。
     */
    static getUserToken(): AjaxJSCryptoResult;
    /**
     * 读取 user_refresh_token，Keychain 错误通过 error 返回。
     */
    static getUserRefreshToken(): AjaxJSCryptoResult;
}

/**
 * Android Token 后台任务回调；保存成功/读取不到返回 null，失败返回通用错误。
 */
declare namespace com.ajaxjs.nativescript.android.storage.GetCredential {
    class TokenCallback extends java.lang.Object {
        constructor(implementation: { onResult(value: string | null): void; onError(message: string): void });
        onResult(value: string | null): void;
        onError(message: string): void;
    }
}
