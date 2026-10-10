<template>
  <Page :class="pageClass" :statusBarStyle="isDark ? 'light' : 'dark'" @navigatingFrom="stopLoading">
    <ActionBar title="www.ajaxjs.com">
      <NavigationButton :text="text.back" android.systemIcon="ic_menu_back" @tap="back" />
      <ActionItem :text="text.retry" @tap="reload" />
    </ActionBar>
    <GridLayout rows="auto,*">
      <StackLayout v-if="loading || failed" row="0" padding="12">
        <ActivityIndicator :busy="loading" v-if="loading" />
        <Label :text="failed ? text.loadFailed : text.loading" class="muted" textWrap="true" horizontalAlignment="center" />
      </StackLayout>
      <WebView row="1" src="https://www.ajaxjs.com" @loaded="loaded" @loadStarted="startLoading" @loadFinished="finished" />
    </GridLayout>
  </Page>
</template>

<script setup lang="ts">
import { ref, $navigateBack, onUnmounted } from 'nativescript-vue';
import { type EventData, type LoadEventData, WebView } from '@nativescript/core';
import { text, pageClass, isDark } from '../common/preferences';

const loading = ref(true);
const failed = ref(false);
let webView: WebView | undefined;

/**
 * 记录 WebView 实例，供重试和停止加载使用。
 * @param args WebView 加载事件。
 */
function loaded(args: EventData) {
  webView = args.object as WebView;
  if (webView.android) {
    const settings = webView.android.getSettings();
    settings.setBuiltInZoomControls(false);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);
  }
}

/**
 * 网页开始加载时更新提示。
 */
function startLoading() {
  loading.value = true;
  failed.value = false;
}

/**
 * 显示网页加载结果，不忽略 HTTPS 证书错误。
 * @param args 网页完成事件及可能的错误信息。
 */
function finished(args: LoadEventData) {
  loading.value = false;
  failed.value = !!args.error;
}

/**
 * 重新加载官网。
 */
function reload() {
  webView?.reload();
}

/**
 * 离开页面时停止网络加载。
 */
function stopLoading() {
  webView?.stopLoading();
}

/**
 * 返回关于页面。
 */
function back() {
  stopLoading();
  $navigateBack({ frame: 'profile-frame' });
}

onUnmounted(stopLoading);
</script>
