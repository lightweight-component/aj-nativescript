<template>
  <TabView :selectedIndex="0" @loaded="initializeTabs" androidTabsPosition="bottom" :class="pageClass" :tabTextColor="isDark ? '#94a3b8' : '#64748b'" selectedTabTextColor="#3b82f6" :tabBackgroundColor="isDark ? '#1e293b' : '#ffffff'">
    <TabViewItem :title="text.home">
      <Frame id="home-frame">
        <Page :class="pageClass" :statusBarStyle="isDark ? 'light' : 'dark'">
          <ActionBar :title="text.home" />
          <StackLayout padding="24" spacing="16">
            <Label :text="text.intro" fontSize="24" fontWeight="bold" textWrap="true" />
            <Label :text="text.homeHint" fontSize="16" class="muted" textWrap="true" />
          </StackLayout>
        </Page>
      </Frame>
    </TabViewItem>
    <TabViewItem :title="text.tests">
      <Frame id="tests-frame">
        <Page :class="pageClass" :statusBarStyle="isDark ? 'light' : 'dark'">
          <ActionBar :title="text.tests" />
          <StackLayout padding="24" spacing="16">
            <Label :text="text.testTitle" fontSize="24" fontWeight="bold" />
            <Label :text="text.testHint" class="muted" textWrap="true" />
            <Button :text="text.aes" @tap="openAes" />
            <Button :text="text.mqtt3" @tap="openMqtt" />
            <Button :text="text.mqtt5" @tap="openMqttV5" />
          </StackLayout>
        </Page>
      </Frame>
    </TabViewItem>
    <TabViewItem :title="text.mine">
      <Frame id="profile-frame">
        <Page :class="pageClass" :statusBarStyle="isDark ? 'light' : 'dark'">
          <ActionBar :title="text.mine" />
          <ScrollView>
            <StackLayout padding="20">
              <GridLayout columns="auto,*,auto" class="login-card" @tap="login">
                <Label text="AJ" class="avatar" verticalAlignment="middle" />
                <StackLayout col="1" marginLeft="18" verticalAlignment="middle">
                  <Label :text="text.login" fontSize="22" fontWeight="bold" />
                  <Label :text="text.loginHint" class="muted" marginTop="6" textWrap="true" />
                </StackLayout>
                <Label col="2" text="›" class="chevron" />
              </GridLayout>
              <StackLayout class="menu-card" marginTop="24">
                <GridLayout columns="*,auto" class="menu-row" @tap="openSettings">
                  <Label :text="text.settings" verticalAlignment="middle" />
                  <Label col="1" text="›" class="chevron" />
                </GridLayout>
                <GridLayout columns="*,auto" class="menu-row menu-divider" @tap="openAbout">
                  <Label :text="text.about" verticalAlignment="middle" />
                  <Label col="1" text="›" class="chevron" />
                </GridLayout>
              </StackLayout>
            </StackLayout>
          </ScrollView>
        </Page>
      </Frame>
    </TabViewItem>
  </TabView>
</template>

<script setup lang="ts">
import { $navigateTo } from 'nativescript-vue';
import { ApplicationSettings, Dialogs, type EventData, TabView } from '@nativescript/core';
import { text, pageClass, isDark, refreshSystemAppearance } from '../common/preferences';
import Settings from './Settings.vue';
import About from './About.vue';
import AesDemo from './AesDemo.vue';
import MqttDemo from './MqttDemo.vue';
import MqttV5Demo from './MqttV5Demo.vue';

let initialized = false;

/**
 * 首次加载完成后显示首页；自动验证时在测试 tab 内打开 AES 页面，保留底部切换。
 */
function initializeTabs(args: EventData) {
  refreshSystemAppearance();
  if (initialized)
    return;
  initialized = true;
  setTimeout(() => {
    const autoCheck = ApplicationSettings.getBoolean('aesAutoCheck', false);
    (args.object as TabView).selectedIndex = autoCheck ? 1 : 0;
    if (autoCheck)
      openAes();
  }, 0);
}

/**
 * 在测试 tab 内打开 AES 演示，保持底部导航可见。
 */
function openAes() {
  $navigateTo(AesDemo, { frame: 'tests-frame' });
}

/**
 * 在测试 tab 内打开 MQTT 演示，保持底部导航可见。
 */
function openMqtt() {
  $navigateTo(MqttDemo, { frame: 'tests-frame' });
}
/**
 * 在测试 tab 内打开 MQTT 5 演示，保持底部导航可见。
 */
function openMqttV5() {
  $navigateTo(MqttV5Demo, { frame: 'tests-frame' });
}
/**
 * 登录区域暂展示入口提示，后续接入业务登录。
 */
function login() {
  Dialogs.alert({ title: text.value.login, message: text.value.loginPending, okButtonText: text.value.ok });
}

/**
 * 在“我的”tab 内打开设置。
 */
function openSettings() {
  $navigateTo(Settings, { frame: 'profile-frame' });
}

/**
 * 在“我的”tab 内打开关于。
 */
function openAbout() {
  $navigateTo(About, { frame: 'profile-frame' });
}
</script>
