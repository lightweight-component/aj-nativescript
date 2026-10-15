<template>
  <Page :class="pageClass">
    <ActionBar title="安全存储测试" />
    <ScrollView>
      <StackLayout padding="20">
        <Label text="仅使用公开的虚拟凭据，不显示或记录实际 Token、密码。重启验证需先写入，再关闭并重新启动 App。" textWrap="true" marginBottom="12" />
        <Button text="运行安全存储自检" :isEnabled="!busy" @tap="selfCheck" />
        <Button text="写入重启测试数据" :isEnabled="!busy" @tap="persistence('write')" />
        <Button text="验证重启后数据并清理" :isEnabled="!busy" @tap="persistence('verify')" />
        <Label :text="status" fontSize="12" fontWeight="bold" textWrap="true" marginTop="16" />
        <Label :text="lines.join('\n')" textWrap="true" fontSize="12" marginTop="12" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ApplicationSettings } from '@nativescript/core';
import { setSecureItem, getSecureItem, removeSecureItem, importAesKey, hasAesKey, deleteAesKey } from '@ajax-js/nativescript-common';
import { pageClass } from '../common/preferences';

const busy = ref(false);
const status = ref('等待测试');
const lines = ref<string[]>([]);
const prefix = 'demo.secure-self-check.';
const restartKey = prefix + 'restart';
const fixture = 'PUBLIC-DEMO-ONLY-中文 🤖  ';

/**
 * 只记录测试名称，不输出存储项值或异常中可能携带的业务数据。
 */
function record(name: string): void {
  lines.value = [...lines.value, name].slice(-15);
  console.log(`SECURE_STORAGE_CHECK:${name}`);
}

/**
 * 仅保留固定错误分类或系统错误码，禁止把原始异常及其潜在业务内容显示到页面。
 */
function diagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const status = message.match(/OSStatus -?\d+/)?.[0];
  if (status)
    return status;
  if (message.includes('Rebuild AjaxJSCommon'))
    return 'iOS 原生桥接缺失';
  if (message.includes('no native result'))
    return '原生返回值缺失';
  if (message.includes('invalid value'))
    return '原生返回值类型错误';
  return '原生存储、桥接或断言失败';
}

function expect(condition: boolean): void {
  if (!condition)
    throw new Error('Secure storage assertion failed.');
}

/**
 * 验证真实原生存储、参数边界、旧设置迁移和既有 AES 密钥隔离；finally 清理虚拟凭据。
 */
async function selfCheck(): Promise<void> {
  busy.value = true;
  lines.value = [];
  status.value = '测试进行中';
  const token = prefix + 'token';
  const mqtt = prefix + 'mqtt';
  const legacy = prefix + 'legacy';
  const aes = prefix + Date.now();
  let imported = false;
  let passed = false;
  try {
    await removeSecureItem(token);
    expect(await getSecureItem(token) === null);
    record('PASS:不存在返回 null');
    await setSecureItem(token, '  中文 🤖\n第二行\u0000  ');
    expect(await getSecureItem(token) === '  中文 🤖\n第二行\u0000  ');
    record('PASS:Unicode 与空格原样保留');
    await setSecureItem(token, '');
    expect(await getSecureItem(token) === '');
    await setSecureItem(token, fixture);
    const credentials = JSON.stringify({ username: 'public-demo', password: fixture, expiresAt: 2000000000000 });
    await setSecureItem(mqtt, credentials);
    expect(await getSecureItem(token) === fixture && await getSecureItem(mqtt) === credentials);
    record('PASS:空字符串、覆盖与多项隔离');
    const values = await Promise.all([setSecureItem(token, 'first'), getSecureItem(token), setSecureItem(token, 'second'), getSecureItem(token)]);
    expect(values[1] === 'first' && values[3] === 'second');
    record('PASS:并发调用顺序');
    await setSecureItem(token, '🤖'.repeat(16384));
    expect(await getSecureItem(token) === '🤖'.repeat(16384));
    let rejected = 0;
    for (const operation of [() => setSecureItem('', 'x'), () => getSecureItem('  '), () => removeSecureItem('x'.repeat(129)),
      () => setSecureItem(token, '\ud800'), () => setSecureItem(token, '🤖'.repeat(16385))]) {
      try {
        await operation();
      } catch {
        rejected++;
      }
    }
    expect(rejected === 5);
    expect(await getSecureItem(token) === '🤖'.repeat(16384));
    record('PASS:参数及 64 KiB UTF-8 边界');
    ApplicationSettings.setString(legacy, fixture);
    await setSecureItem(token, ApplicationSettings.getString(legacy));
    expect(await getSecureItem(token) === fixture);
    ApplicationSettings.remove(legacy);
    expect(!ApplicationSettings.hasKey(legacy));
    record('PASS:旧 ApplicationSettings 迁移');
    importAesKey(aes, 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');
    imported = true;
    await removeSecureItem(token);
    await removeSecureItem(token);
    expect(await getSecureItem(token) === null && await getSecureItem(mqtt) === credentials && hasAesKey(aes));
    record('PASS:幂等删除与 AES 密钥隔离');
    passed = true;
  } catch (error) {
    record(`FAIL:${diagnostic(error)}`);
  } finally {
    try {
      await removeSecureItem(token);
      await removeSecureItem(mqtt);
      ApplicationSettings.remove(legacy);
      if (imported)
        deleteAesKey(aes);
      expect(await getSecureItem(token) === null && await getSecureItem(mqtt) === null && !hasAesKey(aes));
      record('PASS:临时数据清理');
    } catch (error) {
      passed = false;
      record(`FAIL:临时数据清理:${diagnostic(error)}`);
    }
    status.value = passed ? 'SECURE_STORAGE_SELF_CHECK:PASS' : 'SECURE_STORAGE_SELF_CHECK:FAIL';
    console.log(status.value);
    busy.value = false;
  }
}

/**
 * 固定公开样本仅供跨进程重启检查，验证成功或失败后都删除该样本。
 */
async function persistence(action: 'write' | 'verify'): Promise<void> {
  busy.value = true;
  try {
    if (action === 'write') {
      await setSecureItem(restartKey, fixture);
      expect(await getSecureItem(restartKey) === fixture);
      status.value = 'SECURE_STORAGE_RESTART:READY';
    } else {
      let value: string | null = null;
      try {
        value = await getSecureItem(restartKey);
      } finally {
        await removeSecureItem(restartKey);
      }
      expect(value === fixture && await getSecureItem(restartKey) === null);
      status.value = 'SECURE_STORAGE_RESTART:PASS:CLEANED';
    }
  } catch {
    status.value = 'SECURE_STORAGE_RESTART:FAIL';
  } finally {
    console.log(status.value);
    busy.value = false;
  }
}
</script>
