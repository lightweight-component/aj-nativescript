<template>
  <Page :class="pageClass">
    <ActionBar title="剪贴板测试" />
    <ScrollView>
      <StackLayout padding="20" spacing="12">
        <Label text="复制和读取使用 Android / iOS 统一接口，保留原始空格与换行。" textWrap="true" />
        <TextView v-model="input" height="120" hint="输入要复制的文本" />
        <Button text="复制到剪贴板" @tap="copy" />
        <Button text="读取剪贴板" @tap="paste" />
        <Button text="运行剪贴板自检" @tap="selfCheck" />
        <Label :text="status" textWrap="true" />
        <Label :text="JSON.stringify(output)" textWrap="true" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Application, isAndroid, ApplicationSettings } from '@nativescript/core';
import { copyToClipboard, getFromClipboard } from '@ajax-js/nativescript-common';
import { pageClass } from '../common/preferences';

const input = ref('  NativeScript 剪贴板 🔐\n第二行  ');
const output = ref('');
const status = ref('等待测试');

/**
 * 复制输入原文，不自动 trim。
 */
function copy() {
  try {
    copyToClipboard(input.value);
    status.value = '复制完成';
  } catch (error) {
    status.value = String(error);
  }
}

/**
 * 同步读取并展示 JSON 字符串，便于确认空白字符。
 */
function paste() {
  try {
    output.value = getFromClipboard();
    status.value = '读取完成';
  } catch (error) {
    output.value = '';
    status.value = String(error);
  }
}

/**
 * 验证 Unicode、换行、空格、空字符串和连续覆盖；完成后恢复此前可读文本。
 */
function selfCheck() {
  let original: string | undefined;
  try {
    original = getFromClipboard();
    const values = ['  中文 🔐\n第二行  ', ' \n ', '', '覆盖后的文本'];
    for (const value of values) {
      copyToClipboard(value);
      if (getFromClipboard() !== value)
        throw new Error(`剪贴板往返不一致：${JSON.stringify(value)}`);
    }
    output.value = values[0];
    status.value = '剪贴板自检通过：Unicode、换行、空格、空字符串、覆盖';
    console.log('CLIPBOARD_SELF_CHECK:PASS');
  } catch (error) {
    status.value = `剪贴板自检失败：${String(error)}`;
    console.error(`CLIPBOARD_SELF_CHECK:FAIL:${String(error)}`);
  } finally {
    if (original !== undefined)
      copyToClipboard(original);
  }
}

onMounted(() => {
  if (ApplicationSettings.getBoolean('clipboardAutoCheck', false)
    || (isAndroid && Application.android.startActivity?.getIntent()?.getBooleanExtra('clipboardAutoCheck', false)))
    setTimeout(selfCheck, 500);
});
</script>
