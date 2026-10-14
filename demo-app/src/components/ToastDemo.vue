<template>
  <Page :class="pageClass">
    <ActionBar title="Toast 执行连续性测试" />
    <ScrollView>
      <StackLayout padding="20" spacing="12">
        <Label text="检查 Toast 调用是否返回，以及调用后的同步代码、微任务和定时回调是否继续执行。" textWrap="true" />
        <Button text="运行 Toast 连续性测试" :isEnabled="!running" @tap="run" />
        <Label :text="status" textWrap="true" fontWeight="bold" />
        <Label :text="lines.join('\n')" textWrap="true" fontSize="13" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Application, ApplicationSettings, isAndroid } from '@nativescript/core';
import { toast } from '@ajax-js/nativescript-common';
import { toast as commonHelperToast } from '../../../nativescript-plugin/nativescipt-common/src/common-helper';
import { pageClass } from '../common/preferences';

const running = ref(false);
const status = ref('等待测试');
const lines = ref<string[]>([]);
let runNumber = 0;

/**
 * 同时写入页面和控制台，记录本次测试与执行阶段。
 */
function record(message: string) {
  const line = `TOAST_FLOW:${runNumber}:${message}`;
  lines.value = [...lines.value, message];
  console.log(line);
}

/**
 * 真实调用两种 TS 封装，验证返回后同步执行、微任务和前后安排的计时器。
 * 3 秒回调也用于观察提示消失后事件循环是否继续执行。
 */
async function probe(name: string, show: (message: string) => void) {
  let afterCall = false;
  let beforeTimerSawReturn = false;
  const beforeTimer = new Promise<void>(resolve => {
    setTimeout(() => {
      beforeTimerSawReturn = afterCall;
      record(`${name}:TIMER_SCHEDULED_BEFORE_CALL afterCall=${afterCall}`);
      resolve();
    }, 0);
  });
  record(`${name}:BEFORE_CALL`);
  const start = Date.now();
  const result = show(`Toast 连续性测试 ${name} 🔔`);
  afterCall = true;
  record(`${name}:AFTER_CALL elapsed=${Date.now() - start}ms return=${String(result)}`);
  let counter = 0;
  counter += 1;
  if (counter !== 1 || result !== undefined)
    throw new Error(`${name}: 返回值或后续同步语句异常`);
  record(`${name}:SYNC_COUNTER=1`);
  const microtask = Promise.resolve().then(() => record(`${name}:MICROTASK_AFTER_CALL`));
  const immediate = new Promise<void>(resolve => setTimeout(() => {
    record(`${name}:TIMER_AFTER_CALL`);
    resolve();
  }, 0));
  const delayed = new Promise<void>(resolve => setTimeout(() => {
    record(`${name}:DELAYED_3000MS`);
    resolve();
  }, 3000));
  await Promise.all([beforeTimer, microtask, immediate, delayed]);
  if (!beforeTimerSawReturn)
    throw new Error(`${name}: 预先安排的计时器未观察到调用返回`);
}

/**
 * 比较包入口和用户现有 common-helper 封装，不修改 Toast 实现。
 */
async function run() {
  if (running.value)
    return;
  running.value = true;
  runNumber += 1;
  lines.value = [];
  status.value = '测试中，约需 6 秒';
  try {
    await probe('PACKAGE_EXPORT', toast);
    await probe('COMMON_HELPER', commonHelperToast);
    status.value = '通过：两种 Toast 封装之后的同步代码、微任务和定时回调均执行';
    record('PASS');
    console.log('TOAST_FLOW_CHECK:PASS');
  } catch (error) {
    status.value = `失败：${String(error)}`;
    console.error(`TOAST_FLOW_CHECK:FAIL:${error instanceof Error ? error.stack : String(error)}`);
  } finally {
    running.value = false;
  }
}

onMounted(() => {
  if (ApplicationSettings.getBoolean('toastFlowAutoCheck', false)
    || (isAndroid && Application.android.startActivity?.getIntent()?.getBooleanExtra('toastFlowAutoCheck', false)))
    setTimeout(run, 500);
});
</script>
