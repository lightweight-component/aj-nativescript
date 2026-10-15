<template>
  <Page :class="pageClass">
    <ActionBar title="原生 Confirm 测试" />
    <ScrollView>
      <StackLayout padding="20">
        <Label text="确认返回 true，其余正常关闭返回 false；观察 await 后代码及单次计数。" textWrap="true" marginBottom="12" />
        <Button text="默认 Confirm" @tap="run('默认', { message: '默认确认：继续操作吗？' })" />
        <Button text="自定义配色与文案" @tap="custom" />
        <Button text="蒙层可关闭" @tap="run('蒙层可关闭', { title: '蒙层可关闭', message: '点击卡片外的蒙层应返回 false。', maskClosable: true })" />
        <Button text="蒙层不可关闭" @tap="run('蒙层不可关闭', { title: '蒙层不可关闭', message: '点击蒙层不会关闭，请使用按钮或 Android 返回键。' })" />
        <Button text="长正文（可滚动）" @tap="longMessage" />
        <Button text="连续两个弹窗" @tap="queue" />
        <Button text="无效配色错误" @tap="run('错误', { message: '无效参数不应显示弹窗。', okColor: 'not-a-color' })" />
        <Label :text="`完成回调 ${completed} | await 后代码 ${afterAwait}`" fontWeight="bold" marginTop="16" textWrap="true" />
        <Label :text="lines.join('\n') || '等待测试'" marginTop="12" textWrap="true" fontSize="12" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { confirm, type ConfirmOptions } from '@ajax-js/nativescript-common';
import { pageClass } from '../common/preferences';

const completed = ref(0);
const afterAwait = ref(0);
const lines = ref<string[]>([]);

/**
 * 实际弹出并等待用户操作，记录回调及其后的代码执行情况。
 */
async function run(name: string, options: ConfirmOptions): Promise<void> {
  try {
    const result = await confirm(options);
    completed.value += 1;
    afterAwait.value += 1;
    record(`${name}:RESULT:${result}:AFTER:${afterAwait.value}`);
  } catch (error) {
    record(`${name}:ERROR:${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 验证颜色名、短十六进制颜色、Unicode、自定义文案及正文左对齐。
 */
function custom(): Promise<void> {
  return run('自定义', {
    title: '自定义 Confirm', message: '左对齐第一行\n第二行 🤖', okText: '继续', cancelText: '返回',
    okColor: '#2A8', cancelColor: '#E2E2E2', okTextColor: '#FFF', cancelTextColor: 'navy', position: 'LEFT'
  });
}

/**
 * 长正文应在卡片内滚动，确认和取消按钮保持可见。
 */
function longMessage(): Promise<void> {
  return run('长正文', {
    title: '长正文测试', message: Array.from({ length: 40 }, (_, i) => `${i + 1}. 中文长内容与 emoji 🤖，按钮应始终可见。`).join('\n')
  });
}

/**
 * 同时提交两个请求，验证按顺序显示，并在两者完成后继续执行代码。
 */
async function queue(): Promise<void> {
  try {
    const results = await Promise.all([
      confirm({ title: '队列 1', message: '关闭后才会显示第二个弹窗。' }),
      confirm({ title: '队列 2', message: '这是第二个弹窗。' })
    ]);
    completed.value += 2;
    afterAwait.value += 1;
    record(`队列:RESULT:${results.join(',')}:AFTER:${afterAwait.value}`);
  } catch (error) {
    record(`队列:ERROR:${String(error)}`);
  }
}

/**
 * 不记录密钥等业务数据，仅保留最近二十条测试状态。
 */
function record(line: string): void {
  lines.value = [...lines.value, line].slice(-20);
  console.log(`CONFIRM_CHECK:${line}`);
}
</script>
