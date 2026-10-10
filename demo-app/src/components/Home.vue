<template>
  <TabView :selectedIndex="0" @loaded="initializeTabs" androidTabsPosition="bottom" tabTextColor="#64748b" selectedTabTextColor="#2563eb" tabBackgroundColor="#ffffff">
    <TabViewItem title="首页">
      <Frame id="home-frame">
        <Page backgroundColor="#f3f5f8">
          <ActionBar title="首页" />
          <StackLayout padding="24" spacing="16">
            <Label text="NativeScript 组件演示" fontSize="24" fontWeight="bold" textWrap="true" />
            <Label text="在“测试”中验证 AES 加解密和 MQTT 通讯。" fontSize="16" color="#64748b" textWrap="true" />
          </StackLayout>
        </Page>
      </Frame>
    </TabViewItem>
    <TabViewItem title="测试">
      <Frame id="tests-frame">
        <Page backgroundColor="#f3f5f8">
          <ActionBar title="测试" />
          <StackLayout padding="24" spacing="16">
            <Label text="组件测试" fontSize="24" fontWeight="bold" />
            <Label text="选择一个测试，进入对应演示页面。" color="#64748b" textWrap="true" />
            <Button text="AES 加解密测试" @tap="openAes" />
            <Button text="MQTT v3 通讯测试" @tap="openMqtt" />
            <Button text="MQTT v5 通讯测试" @tap="openMqttV5" />
          </StackLayout>
        </Page>
      </Frame>
    </TabViewItem>
    <TabViewItem title="我的">
      <Frame id="profile-frame">
        <Page backgroundColor="#f3f5f8">
          <ActionBar title="我的" />
          <StackLayout padding="24" spacing="16">
            <Label text="关于演示项目" fontSize="24" fontWeight="bold" />
            <Label text="用于验证 NativeScript 公共组件和 MQTT 组件。" color="#64748b" textWrap="true" />
          </StackLayout>
        </Page>
      </Frame>
    </TabViewItem>
  </TabView>
</template>

<script setup lang="ts">
import { $navigateTo } from 'nativescript-vue';
import { type EventData, TabView } from '@nativescript/core';
import AesDemo from './AesDemo.vue';
import MqttDemo from './MqttDemo.vue';
import MqttV5Demo from './MqttV5Demo.vue';

let initialized = false;

/**
 * 首次加载完成后显示首页，避免子 Frame 的初始导航改变选中项。
 */
function initializeTabs(args: EventData) {
  if (initialized)
    return;
  initialized = true;
  setTimeout(() => {
    (args.object as TabView).selectedIndex = 0;
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
</script>
