<template>
  <Page @navigatingFrom="leave">
    <ActionBar title="MQTT 测试">
      <NavigationButton text="返回" android.systemIcon="ic_menu_back" @tap="back" />
    </ActionBar>
    <ScrollView>
      <StackLayout padding="20" spacing="12">
        <Label text="MQTT 3.1.1 文本通讯" fontSize="22" />
        <Label text="填写测试 Broker 地址。请使用独立测试主题。" textWrap="true" />
        <TextField v-model="serverUri" hint="tcp://host:1883 或 ssl://host:8883" autocorrect="false" autocapitalizationType="none" />
        <TextField v-model="username" hint="用户名（可选）" />
        <TextField v-model="password" hint="密码（可选）" :secure="true" />
        <TextField v-model="topic" hint="测试主题" />
        <Button text="连接并验证消息往返" :isEnabled="!busy" @tap="check" />
        <Button text="停止连接" @tap="stop" />
        <Label :text="status" textWrap="true" />
      </StackLayout>
    </ScrollView>
  </Page>
</template>

<script setup lang="ts">
import { ref, onUnmounted, $navigateBack } from 'nativescript-vue';
import { mqtt } from '@ajax-js/nativescript-mqtt-v3';

/**
 * 返回测试列表；离开页面时停止 MQTT 连接。
 */
function back() {
    $navigateBack({ frame: 'tests-frame' });
}

const serverUri = ref('tcp://159.75.215.222:1883');
const username = ref('');
const password = ref('');
const topic = ref('ajaxjs/demo/' + Date.now());
const status = ref('尚未连接');
const busy = ref(false);
let cancel: (() => void) | undefined;

/**
 * 连接、订阅并发布中文消息，验证一次性接收；停止后再建立新连接。
 */
async function check() {
    busy.value = true;
    try {
        mqtt.stop();
        const options = {
            serverUri: serverUri.value, clientId: 'ajaxjs-demo-' + Date.now(),
            username: username.value || undefined, password: password.value || undefined,
            watchDog: true, keepAliveSeconds: 10
        };
        let subscribed: (() => void) | undefined;
        await mqtt.start(options, {
            onSubscribed: (_topic, error) => {
                if (!error)
                    subscribed?.();
            },
            onConnectionLost: () => { status.value = '连接失去，等待恢复'; }
        });
        status.value = '连接成功，正在验证';
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('等待中文消息超时')), 8000);
            cancel = () => { clearTimeout(timer); reject(new Error('验证已取消')); };
            subscribed = () => mqtt.publish(topic.value, '你好，MQTT v3');
            mqtt.subscribeOnce(topic.value, message => {
                clearTimeout(timer);
                cancel = undefined;
                if (message.payload !== '你好，MQTT v3')
                    reject(new Error('消息正文不匹配'));
                else
                    resolve();
            });
        });
        mqtt.stop();
        await new Promise(resolve => setTimeout(resolve, 500));
        await mqtt.start({ ...options, clientId: options.clientId, watchDog: false });
        mqtt.stop();
        status.value = '验证通过：连接、订阅、中文消息往返、一次性回调、停止和重新启动';
    } catch (error) {
        mqtt.stop();
        status.value = error instanceof Error ? error.message : '操作失败';
    } finally {
        password.value = '';
        busy.value = false;
        cancel = undefined;
    }
}

/**
 * 取消当前测试并停止连接。
 */
function stop() { cancel?.(); mqtt.stop(); status.value = '连接已停止'; }
function leave() { stop(); }
onUnmounted(stop);
</script>
