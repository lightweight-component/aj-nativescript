<template>
  <Page :class="pageClass">
    <ActionBar title="列表与按钮事件测试" />
    <GridLayout rows="auto,auto,auto,auto,*,auto,*" padding="16">
      <Label text="点击行正文，再点击行内按钮，对比事件顺序和计数。" textWrap="true" />
      <GridLayout row="1" columns="*,*" rows="auto,auto" marginTop="8">
        <Button text="原生 itemTap" :class="mode === 'native' ? 'active' : ''" @tap="selectMode('native')" />
        <Button col="1" text="itemTap 焦点修正" :class="mode === 'native-fixed' ? 'active' : ''" @tap="selectMode('native-fixed')" />
        <Button row="1" text="父层 tap" :class="mode === 'parent' ? 'active' : ''" @tap="selectMode('parent')" />
        <Button row="1" col="1" text="分区 tap" :class="mode === 'split' ? 'active' : ''" @tap="selectMode('split')" />
      </GridLayout>
      <Label row="2" :text="description" textWrap="true" fontSize="12" marginTop="8" />
      <Label row="3" :text="`行事件 ${itemCount} | 按钮事件 ${buttonCount} | 原生 itemTap ${nativeCount}`" fontWeight="bold" fontSize="13" marginTop="10" marginBottom="8" textWrap="true" />
      <ListView row="4" :key="mode" :items="items" rowHeight="76" @itemTap="onNativeItemTap">
        <template #default="{ item }">
          <GridLayout v-if="mode === 'parent'" columns="*,110" height="76" @tap="onItemTap(item, $event, 'parent.tap')">
            <StackLayout padding="12" verticalAlignment="middle">
              <Label :text="item.title" fontWeight="bold" />
              <Label text="父容器监听整行 tap" fontSize="11" />
            </StackLayout>
            <Button col="1" :text="`按钮 ${item.id}`" margin="6" @tap="onButtonTap(item, $event)" />
          </GridLayout>
          <GridLayout v-else-if="mode === 'native' || mode === 'native-fixed'" columns="*,110" height="76">
            <StackLayout padding="12" verticalAlignment="middle">
              <Label :text="item.title" fontWeight="bold" />
              <Label :text="mode === 'native-fixed' ? '原生 itemTap；Android 按钮不取焦点' : 'ListView 监听原生 itemTap'" fontSize="11" />
            </StackLayout>
            <Button col="1" :text="`按钮 ${item.id}`" margin="6" @loaded="onListButtonLoaded($event)" @tap="onButtonTap(item, $event)" />
          </GridLayout>
          <GridLayout v-else columns="*,110" height="76">
            <GridLayout padding="12" rows="auto,auto" @tap="onItemTap(item, $event, 'content.tap')">
              <Label :text="item.title" fontWeight="bold" />
              <Label row="1" text="正文与按钮分别处理点击" fontSize="11" />
            </GridLayout>
            <Button col="1" :text="`按钮 ${item.id}`" margin="6" @tap="onButtonTap(item, $event)" />
          </GridLayout>
        </template>
      </ListView>
      <GridLayout row="5" columns="*,auto" marginTop="8" marginBottom="8">
        <Label text="事件日志（最近 30 条）" verticalAlignment="middle" />
        <Button col="1" text="清空" @tap="reset" />
      </GridLayout>
      <ScrollView row="6">
        <Label :text="lines.join('\n') || '等待点击'" textWrap="true" fontSize="11" />
      </ScrollView>
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { isAndroid } from '@nativescript/core';
import type { Button, EventData, ItemEventData } from '@nativescript/core';
import { pageClass } from '../common/preferences';

type Mode = 'native' | 'native-fixed' | 'parent' | 'split';
type Item = { id: number; title: string };
const items: Item[] = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, title: `测试项目 ${index + 1}` }));
const mode = ref<Mode>('native-fixed');
const itemCount = ref(0);
const buttonCount = ref(0);
const nativeCount = ref(0);
const lines = ref<string[]>([]);
let sequence = 0;
const description = computed(() => ({
  native: '行事件来自 ListView.itemTap；按钮有独立 tap。观察按钮是否同时触发原生 itemTap。',
  'native-fixed': '整行由 ListView.itemTap 处理，内部按钮单独 tap；Android 关闭按钮焦点，保持按钮可点击。正文不绑定 tap。',
  parent: '整行容器监听 tap，内部按钮也监听 tap。观察原生手势是否重复识别，不能假定是 DOM 冒泡。',
  split: '推荐对照：行正文和按钮是两个点击区域，外层不处理业务 tap；原生 itemTap 仅记录，不触发行操作。'
})[mode.value]);

/**
 * Android ListView 会跳过包含可获取焦点子控件的行点击。
 * 关闭行内按钮的键盘焦点，不关闭点击、触摸或无障碍能力。
 * loaded 在创建及重新挂载视图时执行，适用于虚拟列表复用。
 */
function onListButtonLoaded(event: EventData) {
  if (!isAndroid)
    return;
  const button = event.object as Button;
  const native = button.android as android.widget.Button;
  const before = native.isFocusable();
  if (mode.value === 'native-fixed') {
    native.setFocusableInTouchMode(false);
    native.setFocusable(false);
  }
  console.log(`LIST_TAP_FOCUS:${mode.value}:before=${before}:after=${native.isFocusable()}:clickable=${native.isClickable()}`);
}

/**
 * 记录事件接收者及是否提供 DOM 风格的停止方法，不修改原生事件。
 */
function record(kind: string, item: Item, event: EventData) {
  sequence += 1;
  const receiver = event.object?.constructor?.name ?? 'unknown';
  const hasStop = typeof (event as EventData & { stopPropagation?: unknown }).stopPropagation === 'function';
  const line = `${sequence}. ${kind} #${item.id} receiver=${receiver} stopPropagation=${hasStop}`;
  lines.value = [...lines.value, line].slice(-30);
  console.log(`LIST_TAP_CHECK:${mode.value}:${line}`);
}

/**
 * 行正文或父层手势触发的业务事件，计数与按钮操作相互独立。
 */
function onItemTap(item: Item, event: EventData, origin: string) {
  itemCount.value += 1;
  record(`ITEM(${origin})`, item, event);
}

/**
 * 按钮只执行业务按钮操作，不手工转发给行，也不调用不存在的 stopPropagation。
 */
function onButtonTap(item: Item, event: EventData) {
  buttonCount.value += 1;
  record('BUTTON', item, event);
}

/**
 * 原生列表事件单独记录；两个 itemTap 模式把它作为业务行事件。
 */
function onNativeItemTap(event: ItemEventData) {
  const item = items[event.index];
  if (!item)
    return;
  nativeCount.value += 1;
  record('NATIVE_ITEM_TAP', item, event);
  if (mode.value === 'native' || mode.value === 'native-fixed')
    onItemTap(item, event, 'ListView.itemTap');
}

/**
 * 清空计数和日志，便于单次点击对照，不会产生模拟手势。
 */
function reset() {
  itemCount.value = 0;
  buttonCount.value = 0;
  nativeCount.value = 0;
  sequence = 0;
  lines.value = [];
}

/**
 * 切换时重建列表，避免复用旧模式的手势监听器；同时重置观察结果。
 */
function selectMode(next: Mode) {
  mode.value = next;
  reset();
}
</script>

<style scoped>
.active {
  color: #2563eb;
  font-weight: bold;
}
</style>
