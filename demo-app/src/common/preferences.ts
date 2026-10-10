import { computed, reactive } from 'nativescript-vue';
import { Application, ApplicationSettings, Device, knownFolders } from '@nativescript/core';

export type Language = 'zh-CN' | 'zh-TW' | 'en';
export type Appearance = 'light' | 'dark' | 'system';

const messages = {
    'zh-CN': {
        home: '首页', tests: '测试', mine: '我的', login: '点击登录', loginHint: '登录后体验更多功能',
        settings: '设置', about: '关于', language: '语言', appearance: '外观', clearCache: '清除缓存',
        light: '亮色', dark: '暗黑', system: '跟随系统', cancel: '取消', ok: '确定', back: '返回',
        cleared: '缓存已清除', clearFailed: '部分缓存暂时无法清除，请稍后重试', clearing: '正在清除…',
        loginPending: '登录功能将在后续接入。', website: '官方网站', loading: '正在加载…',
        loadFailed: '网页加载失败，请检查网络后重试', retry: '重新加载',
        intro: 'NativeScript 组件演示', homeHint: '在“测试”中验证 AES 加解密和 MQTT 通讯。',
        testTitle: '组件测试', testHint: '选择一个测试，进入对应演示页面。',
        aes: 'AES 加解密测试', mqtt3: 'MQTT v3 通讯测试', mqtt5: 'MQTT v5 通讯测试'
    },
    'zh-TW': {
        home: '首頁', tests: '測試', mine: '我的', login: '點擊登入', loginHint: '登入後體驗更多功能',
        settings: '設定', about: '關於', language: '語言', appearance: '外觀', clearCache: '清除快取',
        light: '亮色', dark: '暗黑', system: '跟隨系統', cancel: '取消', ok: '確定', back: '返回',
        cleared: '快取已清除', clearFailed: '部分快取暫時無法清除，請稍後重試', clearing: '正在清除…',
        loginPending: '登入功能將在後續接入。', website: '官方網站', loading: '正在載入…',
        loadFailed: '網頁載入失敗，請檢查網路後重試', retry: '重新載入',
        intro: 'NativeScript 元件展示', homeHint: '在「測試」中驗證 AES 加解密和 MQTT 通訊。',
        testTitle: '元件測試', testHint: '選擇一個測試，進入對應展示頁面。',
        aes: 'AES 加解密測試', mqtt3: 'MQTT v3 通訊測試', mqtt5: 'MQTT v5 通訊測試'
    },
    en: {
        home: 'Home', tests: 'Tests', mine: 'Me', login: 'Tap to sign in', loginHint: 'Sign in to explore more',
        settings: 'Settings', about: 'About', language: 'Language', appearance: 'Appearance', clearCache: 'Clear cache',
        light: 'Light', dark: 'Dark', system: 'System', cancel: 'Cancel', ok: 'OK', back: 'Back',
        cleared: 'Cache cleared', clearFailed: 'Some cache files could not be cleared. Please try again later.', clearing: 'Clearing…',
        loginPending: 'Sign-in will be added later.', website: 'Official website', loading: 'Loading…',
        loadFailed: 'Unable to load the website. Check your connection and try again.', retry: 'Reload',
        intro: 'NativeScript demo', homeHint: 'Open Tests to explore AES encryption and MQTT messaging.',
        testTitle: 'Component tests', testHint: 'Choose a test to open its demo.',
        aes: 'AES encryption test', mqtt3: 'MQTT v3 test', mqtt5: 'MQTT v5 test'
    }
};

const deviceLanguage = Device.language || 'zh-CN';
const defaultLanguage: Language = /^zh/i.test(deviceLanguage)
    ? /TW|HK|MO|Hant/i.test(deviceLanguage) ? 'zh-TW' : 'zh-CN'
    : 'en';
const savedLanguage = ApplicationSettings.getString('prototype.language', defaultLanguage);
const savedAppearance = ApplicationSettings.getString('prototype.appearance', 'system');

export const preferences = reactive({
    language: (['zh-CN', 'zh-TW', 'en'].includes(savedLanguage) ? savedLanguage : defaultLanguage) as Language,
    appearance: (['light', 'dark', 'system'].includes(savedAppearance) ? savedAppearance : 'system') as Appearance,
    systemAppearance: 'light' as 'light' | 'dark'
});

Application.on(Application.systemAppearanceChangedEvent, args => {
    preferences.systemAppearance = args.newValue;
});

/**
 * 界面加载后读取系统外观，避免在原生 Application 初始化前访问资源。
 * @returns 无返回值。
 */
export function refreshSystemAppearance(): void {
    preferences.systemAppearance = Application.primaryWindow?.systemAppearance() || 'light';
}

Application.on(Application.resumeEvent, refreshSystemAppearance);

export const text = computed(() => messages[preferences.language]);
export const isDark = computed(() => preferences.appearance === 'system'
    ? preferences.systemAppearance === 'dark' : preferences.appearance === 'dark');
export const pageClass = computed(() => isDark.value ? 'prototype-page theme-dark' : 'prototype-page theme-light');
export const languageNames: Record<Language, string> = { 'zh-CN': '简体中文', 'zh-TW': '正体中文', en: '英文' };

/**
 * 保存原型界面语言并立即更新文案；独立的 AES、MQTT 测试页面保持原有文案。
 * @param language 所选界面语言。
 * @returns 无返回值。
 */
export function setLanguage(language: Language): void {
    preferences.language = language;
    ApplicationSettings.setString('prototype.language', language);
}

/**
 * 保存界面外观；跟随系统时响应设备外观变化。
 * @param appearance 亮色、暗黑或跟随系统。
 * @returns 无返回值。
 */
export function setAppearance(appearance: Appearance): void {
    preferences.appearance = appearance;
    ApplicationSettings.setString('prototype.appearance', appearance);
}

/**
 * 清除应用临时目录，保留设置、应用数据和 Keystore 密钥。
 * @returns 全部删除成功时完成；部分文件删除失败时抛出异常。
 */
export async function clearCache(): Promise<void> {
    const entries = await knownFolders.temp().getEntities();
    const results = await Promise.allSettled(entries.map(entry => entry.remove()));
    if (results.some(result => result.status === 'rejected'))
        throw new Error('Some cache files could not be removed.');
}
