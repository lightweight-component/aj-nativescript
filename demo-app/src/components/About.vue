<template>
  <Page :class="pageClass" :statusBarStyle="isDark ? 'light' : 'dark'">
    <ActionBar :title="text.about">
      <NavigationButton :text="text.back" android.systemIcon="ic_menu_back" @tap="back" />
    </ActionBar>
    <StackLayout padding="20">
      <StackLayout class="about-card" padding="28">
        <Label text="AJAXJS" fontSize="30" fontWeight="bold" horizontalAlignment="center" />
        <Label :text="text.about" class="muted" marginTop="12" horizontalAlignment="center" />
      </StackLayout>
      <GridLayout columns="*,auto,auto" height="64" class="menu-card menu-row" marginTop="20" @tap="openWebsite">
        <Label :text="text.website" verticalAlignment="middle" />
        <Label col="1" text="www.ajaxjs.com" class="link" verticalAlignment="middle" />
        <Label col="2" text="›" class="chevron" />
      </GridLayout>
    </StackLayout>
  </Page>
</template>

<script setup lang="ts">
import { $navigateBack, $navigateTo } from 'nativescript-vue';
import { text, pageClass, isDark } from '../common/preferences';
import Website from './Website.vue';

/**
 * 返回“我的”页面。
 */
function back() {
  $navigateBack({ frame: 'profile-frame' });
}

/**
 * 在应用内打开官网 WebView。
 */
function openWebsite() {
  $navigateTo(Website, { frame: 'profile-frame' });
}
</script>
