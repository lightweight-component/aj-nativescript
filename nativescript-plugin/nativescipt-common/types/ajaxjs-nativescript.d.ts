/// <reference types="@nativescript/types" />

/**
 * Resolve platform types outside com.ajaxjs.nativescript.android to avoid name shadowing.
 */
type AjaxjsAndroidContext = android.content.Context;

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
             * 验证 GCM 认证标签并解密 UTF-8 文本；认证失败不返回明文。
             *
             * @param alias 已导入的 AES 密钥别名，非空白且最多 128 个字符。
             * @param nonceBase64 标准 Base64 nonce，解码后必须为 12 字节。
             * @param dataBase64 标准 Base64 密文及认证标签，解码后至少为 16 字节。
             * @returns 解密后的 UTF-8 文本，不进行 JSON 解析。
             * @throws 参数无效、密钥不存在、认证失败或解密失败时抛出异常。
             */
            static decrypt(alias: string, nonceBase64: string, dataBase64: string): string;
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
         * 时间和安全随机字符串工具。
         */
        class Utils extends java.lang.Object {
            static class: java.lang.Class<Utils>;
            constructor();
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
