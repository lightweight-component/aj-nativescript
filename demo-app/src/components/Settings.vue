<template>
  <Page :class="pageClass" :statusBarStyle="isDark ? 'light' : 'dark'">
    <ActionBar :title="text.settings">
      <NavigationButton :text="text.back" android.systemIcon="ic_menu_back" @tap="back" />
    </ActionBar>
    <ScrollView>
      <StackLayout padding="20">
        <StackLayout class="menu-card">
          <GridLayout columns="*,auto,auto" class="menu-row" @tap="chooseLanguage">
            <Label :text="text.language" verticalAlignment="middle" />
            <Label col="1" :text="languageNames[preferences.language]" class="muted" verticalAlignment="middle" />
            <Label col="2" text="›" class="chevron" />
          </GridLayout>
          <GridLayout columns="*,auto,auto" class="menu-row menu-divider" @tap="chooseAppearance">
            <Label :text="text.appearance" verticalAlignment="middle" />
            <Label col="1" :text="appearanceLabel" class="muted" verticalAlignment="middle" />
            <Label col="2" text="›" class="chevron" />
          </GridLayout>
          <GridLayout columns="*,auto" class="menu-row menu-divider">
            <Label :text="text.clearCache" verticalAlignment="middle" />
            <Button col="1" :text="clearing ? text.clearing : text.clearCache" :isEnabled="!clearing" class="cache-button" @tap="removeCache" />
          </GridLayout>
        </StackLayout>
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
import { computed, ref, $navigateBack } from 'nativescript-vue';
import { Dialogs } from '@nativescript/core';
import { preferences, text, pageClass, isDark, languageNames, setLanguage, setAppearance, clearCache, type Language, type Appearance } from '../common/preferences';

const clearing = ref(false);
const appearanceLabel = computed(() => text.value[preferences.appearance]);

/**
 * 返回“我的”页面。
 */
function back() {
  $navigateBack({ frame: 'profile-frame' });
}

/**
 * 选择并保存界面语言；取消时不修改设置。
 */
async function chooseLanguage() {
  const choices: Language[] = ['zh-CN', 'zh-TW', 'en'];
  const result = await Dialogs.action({ title: text.value.language, cancelButtonText: text.value.cancel, actions: choices.map(value => languageNames[value]) });
  const language = choices.find(value => languageNames[value] === result);
  if (language)
    setLanguage(language);
}

/**
 * 选择并保存外观；跟随系统时自动响应系统外观变化。
 */
async function chooseAppearance() {
  const choices: Appearance[] = ['light', 'dark', 'system'];
  const labels = choices.map(value => text.value[value]);
  const result = await Dialogs.action({ title: text.value.appearance, cancelButtonText: text.value.cancel, actions: labels });
  const index = labels.indexOf(result);
  if (index >= 0)
    setAppearance(choices[index]);
}

/**
 * 清除临时缓存，并显示操作结果。
 */
async function removeCache() {
  if (clearing.value)
    return;
  clearing.value = true;
  let message = text.value.cleared;
  try {
    await clearCache();
  } catch {
    message = text.value.clearFailed;
  } finally {
    clearing.value = false;
  }
  await Dialogs.alert({ title: text.value.clearCache, message, okButtonText: text.value.ok });
}
</script>
