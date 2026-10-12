<template>
    <Page backgroundColor="#f3f5f8">
      <ActionBar title="AES 测试">
        <NavigationButton text="返回" android.systemIcon="ic_menu_back" @tap="back" />
      </ActionBar>
      <ScrollView>
        <StackLayout padding="20" spacing="12">
          <Label text="AES 密钥管理与 JSON 加解密" fontSize="22" fontWeight="bold" textWrap="true" />
          <Label text="支持 Android 8.0+ 和 iOS 15+。JWT 和密钥仅用于本次操作，不保存到文件。" textWrap="true" />
          <Label :text="status" textWrap="true" color="#245a86" />
          <ActivityIndicator :busy="busy" :visibility="busy ? 'visible' : 'collapsed'" />
          <Button text="运行本地加解密验证（含 AAD）" :isEnabled="!busy" @tap="selfCheck" />
          <Button text="运行 AAD 与旧方式兼容测试" :isEnabled="!busy" @tap="checkAssociatedData" />
          <Label text="自动使用临时测试密钥，结束后删除；下方逐项显示测试结果。" textWrap="true" />
          <Label v-for="result in aadResults" :key="result.name" :text="(result.passed ? '✓ ' : '✗ ') + result.name"
            :color="result.passed ? '#15803d' : '#b42318'" textWrap="true" />

          <Label text="1. 使用已有 JWT 领取密钥" fontWeight="bold" />
          <TextField v-model="endpoint" hint="HTTPS 密钥接口地址" autocorrect="false" autocapitalizationType="none" />
          <TextField v-model="jwt" hint="JWT（不含 Bearer 前缀）" :secure="true" autocorrect="false"
            autocapitalizationType="none" />
          <Button text="请求并导入密钥" :isEnabled="!busy" @tap="requestKey" />
          <Label text="接口：GET，返回 { keyId, key }，key 为标准 Base64。" textWrap="true" />

          <Label text="2. 检查或手动导入测试密钥" fontWeight="bold" />
          <TextField v-model="alias" hint="Keystore 别名" autocorrect="false" autocapitalizationType="none" />
          <TextField v-model="manualKey" hint="测试 AES 密钥（Base64）" :secure="true" autocorrect="false"
            autocapitalizationType="none" />
          <Button text="手动导入" :isEnabled="!busy" @tap="importKey" />
          <Button text="检查密钥是否存在" :isEnabled="!busy" @tap="checkKey" />
          <Button text="删除密钥" :isEnabled="!busy" @tap="removeKey" />
          <Label text="已有别名禁止覆盖；删除后对应消息将无法解密。" textWrap="true" />

          <Label text="3. JSON 消息" fontWeight="bold" />
          <TextView v-model="plaintext" height="120" hint="输入有效 JSON" />
          <Label text="AAD（仅用于下方 AAD 加解密，不自动包含在密文中）" textWrap="true" />
          <TextField v-model="associatedData" hint="加密和解密必须使用完全相同的 AAD" autocorrect="false" autocapitalizationType="none" />
          <Button text="使用 AAD 加密 JSON" :isEnabled="!busy" @tap="encryptWithAad" />
          <Button text="加密 JSON" :isEnabled="!busy" @tap="encrypt" />
          <Label text="加密结果（可以修改，以测试认证失败）" textWrap="true" />
          <TextView v-model="encryptedText" height="160" hint="nonce / data JSON" />
          <Button text="使用 AAD 解密 JSON" :isEnabled="!busy" @tap="decryptWithAad" />
          <Button text="解密 JSON" :isEnabled="!busy" @tap="decrypt" />
          <Label text="解密结果" fontWeight="bold" />
          <Label :text="decryptedText || '尚未解密'" textWrap="true" />
          <Label :text="error" color="#b42318" textWrap="true" />
        </StackLayout>
      </ScrollView>
    </Page>
</template>

<script lang="ts" setup>
import { ref, onMounted, $navigateBack } from 'nativescript-vue';
import { confirm, ApplicationSettings } from '@nativescript/core';
import { provisionAesKey, importAesKey, hasAesKey, deleteAesKey, encryptJson, decryptJson, encryptJsonWithAssociatedData, decryptJsonWithAssociatedData, type EncryptedBody } from '@ajax-js/nativescript-common';

/**
 * 返回测试列表，保留底部 tab 导航。
 */
function back() {
  $navigateBack({ frame: 'tests-frame' });
}

import vectors from '../common/aes-vectors.json';

const endpoint = ref('');
const jwt = ref('');
const alias = ref('ajaxjs.aes.demo-v1');
const manualKey = ref('');
const plaintext = ref(JSON.stringify({ message: '你好，Keystore', v: 1 }, null, 2));
const encryptedText = ref('');
const decryptedText = ref('');
const status = ref('尚未检查密钥');
const error = ref('');
const busy = ref(false);
const associatedData = ref('device-demo/消息/v1 🔐');
const aadResults = ref<Array<{ name: string; passed: boolean }>>([]);

/**
 * 使用临时密钥验证 AAD 和旧 API 的兼容性，逐项显示结果。
 *
 * @param testAlias 已导入的临时 AES 密钥别名。
 * @returns 全部成功时正常返回。
 * @throws 加解密异常、错误 AAD 未被拒绝或兼容性验证失败。
 */
function verifyAssociatedData(testAlias: string): void {
  aadResults.value = [];
  const value = { message: '中文 🔐', count: 1 };
  const aad = 'device-demo/消息/v1 🔐';
  const body = encryptJsonWithAssociatedData(testAlias, value, aad);
  const oldBody = encryptJson(testAlias, value);
  const emptyAadBody = encryptJsonWithAssociatedData(testAlias, value, '');
  const same = (decoded: unknown) => {
    if (JSON.stringify(decoded) !== JSON.stringify(value))
      throw new Error('解密内容与原始 JSON 不一致');
  };
  const rejected = (action: () => unknown) => {
    let failed = false;
    try {
      action();
    } catch {
      failed = true;
    }
    if (!failed)
      throw new Error('应当认证失败，却返回了解密结果');
  };
  const checks: Array<[string, () => void]> = [
    ['正确的 Unicode AAD 解密成功', () => same(decryptJsonWithAssociatedData(testAlias, body, aad))],
    ['AAD 不一致时解密失败', () => rejected(() => decryptJsonWithAssociatedData(testAlias, body, aad + '-changed'))],
    ['非空 AAD 密文使用旧方法解密失败', () => rejected(() => decryptJson(testAlias, body))],
    ['旧方法加密 → 旧方法解密成功', () => same(decryptJson(testAlias, oldBody))],
    ['旧方法加密 → 空 AAD 新方法解密成功', () => same(decryptJsonWithAssociatedData(testAlias, oldBody, ''))],
    ['空 AAD 新方法加密 → 旧方法解密成功', () => same(decryptJson(testAlias, emptyAadBody))]
  ];
  for (const [name, check] of checks) {
    try {
      check();
      aadResults.value.push({ name, passed: true });
    } catch (cause) {
      aadResults.value.push({ name, passed: false });
      throw cause;
    }
  }
}

/**
 * 使用公开的临时测试密钥运行 AAD 验证，结束后删除密钥。
 */
function checkAssociatedData(): void {
  void run(() => {
    aadResults.value = [];
    status.value = '正在验证 AAD 与旧方式兼容性';
    const testAlias = `ajaxjs.aes.aad-check-${Date.now()}`;
    try {
      importAesKey(testAlias, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
      verifyAssociatedData(testAlias);
      status.value = 'AAD 与旧方式兼容测试全部通过';
    } finally {
      deleteAesKey(testAlias);
    }
  });
}

function selfCheck() {
  void run(() => {
    aadResults.value = [];
    status.value = '正在运行本地加解密验证';
    const testAlias = `ajaxjs.aes.check-${Date.now()}`;
    try {
      /*
       * Public test key only; never use this fixed key for application data.
       */
      const testKey = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
      importAesKey(testAlias, testKey);

      if (!hasAesKey(testAlias))
        throw new Error('导入验证失败');

      for (const invalidKey of ['!', 'AA==', '']) {
        let invalidRejected = false;
        try {
          importAesKey(`${testAlias}-invalid`, invalidKey);
        } catch {
          invalidRejected = true;
        }
        if (!invalidRejected)
          throw new Error('无效密钥未被拒绝');
      }

      let rejected = false;

      try {
        importAesKey(testAlias, testKey);
      } catch { rejected = true; }

      if (!rejected)
        throw new Error('重复别名未被拒绝');

      for (const vector of vectors) {
        const vectorAlias = `${testAlias}-${vector.size}`;
        try {
          importAesKey(vectorAlias, vector.key);
          const decoded = decryptJson(vectorAlias, vector);
          if (JSON.stringify(decoded) !== JSON.stringify({ message: '中文 🔐', count: 1 }))
            throw new Error('Android → iOS 互通失败');
          const result = encryptJson(vectorAlias, decoded);
          /*
           * Only public zero-key test vectors are emitted for JVM verification.
           */
          console.log(`AES_INTEROP:${JSON.stringify({ size: vector.size, ...result })}`);
        } finally {
          deleteAesKey(vectorAlias);
        }
      }

      verifyAssociatedData(testAlias);

      const value = { message: '中文 🔐', count: 1 };
      const first = encryptJson(testAlias, value);
      const second = encryptJson(testAlias, value);

      if (first.nonce === second.nonce)
        throw new Error('nonce 未更新');

      if (JSON.stringify(decryptJson(testAlias, first)) !== JSON.stringify(value))
        throw new Error('往返验证失败');

      for (const value of [null, [], {}, '中文', 123, true]) {
        const body = encryptJson(testAlias, value);
        if (JSON.stringify(decryptJson(testAlias, body)) !== JSON.stringify(value))
          throw new Error('JSON 类型验证失败');
      }
      for (const body of [{ nonce: 'AA==', data: first.data }, { nonce: first.nonce, data: 'AA==' },
          { nonce: '!', data: first.data }]) {
        let invalidRejected = false;
        try {
          decryptJson(testAlias, body);
        } catch {
          invalidRejected = true;
        }
        if (!invalidRejected)
          throw new Error('无效消息未被拒绝');
      }

      rejected = false;
      const tampered = { ...first, data: (first.data[0] === 'A' ? 'B' : 'A') + first.data.slice(1) };

      try {
        decryptJson(testAlias, tampered);

      } catch { rejected = true; }

      if (!rejected)
        throw new Error('密文篡改未被拒绝');

      deleteAesKey(testAlias);

      if (hasAesKey(testAlias))
        throw new Error('删除验证失败');
      rejected = false;

      try { decryptJson(testAlias, first); } catch { rejected = true; }

      if (!rejected)
        throw new Error('删除后仍可解密');
      console.log('AES_SELF_CHECK:PASS');
      status.value = '本地验证通过：AAD 认证、旧方式兼容、Android 互通、导入、重复拒绝、中文往返、新 nonce、篡改拒绝及删除';
    } finally {
      deleteAesKey(testAlias);
    }
  });
}

/*
 * Opt-in launch verification on the actual AES page for simulator automation.
 */
onMounted(() => {
  if (ApplicationSettings.getBoolean('aesAutoCheck', false))
    selfCheck();
});

async function run(action: () => void | Promise<void>) {
  if (busy.value)
    return;
  busy.value = true;
  error.value = '';

  try {
    await action();
  } catch (cause) {
    console.log('AES_SELF_CHECK:FAIL');
    status.value = '操作失败，请查看错误信息';
    error.value = cause instanceof Error ? cause.message : '操作失败，请检查输入和密钥状态。';
  } finally {
    busy.value = false;
  }
}

function requestKey() {
  void run(async () => {
    try {
      const result = await provisionAesKey({ endpoint: endpoint.value.trim(), jwt: jwt.value });
      alias.value = result.alias;
      status.value = `密钥已导入：${result.keyId}`;
    } finally {
      jwt.value = '';
    }
  });
}

function importKey() {
  void run(() => {
    try {
      importAesKey(alias.value, manualKey.value.trim());
      status.value = '测试密钥已导入';
    } finally {
      manualKey.value = '';
    }
  });
}

function checkKey() {
  void run(() => { status.value = hasAesKey(alias.value) ? '密钥存在' : '密钥不存在'; });
}

function removeKey() {
  void run(async () => {
    if (await confirm({ title: '删除密钥', message: '删除后无法解密对应消息，是否继续？', okButtonText: '删除', cancelButtonText: '取消' })) {
      deleteAesKey(alias.value);
      decryptedText.value = '';
      status.value = '密钥已删除';
    }
  });
}

/**
 * 使用当前 AAD 加密 JSON；AAD 按原样传入，不去除空格或规范化。
 */
function encryptWithAad(): void {
  void run(() => {
    decryptedText.value = '';
    encryptedText.value = '';
    const body = encryptJsonWithAssociatedData(alias.value, JSON.parse(plaintext.value), associatedData.value);
    encryptedText.value = JSON.stringify(body, null, 2);
    status.value = 'JSON 与 AAD 加密成功';
  });
}

/**
 * 使用当前 AAD 验证并解密，失败时清除之前的明文显示。
 */
function decryptWithAad(): void {
  void run(() => {
    decryptedText.value = '';
    const body = JSON.parse(encryptedText.value) as EncryptedBody;
    decryptedText.value = JSON.stringify(decryptJsonWithAssociatedData(alias.value, body, associatedData.value), null, 2);
    status.value = 'JSON 与 AAD 认证及解密成功';
  });
}

function encrypt() {
  void run(() => {
    decryptedText.value = '';
    encryptedText.value = JSON.stringify(encryptJson(alias.value, JSON.parse(plaintext.value)), null, 2);
    status.value = 'JSON 加密成功';
  });
}

function decrypt() {
  void run(() => {
    decryptedText.value = '';
    const body = JSON.parse(encryptedText.value) as EncryptedBody;
    decryptedText.value = JSON.stringify(decryptJson(alias.value, body), null, 2);
    status.value = 'JSON 认证及解密成功';
  });
}
</script>
