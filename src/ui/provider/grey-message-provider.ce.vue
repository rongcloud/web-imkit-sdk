<template>
  <div class="rc-kit-grey-message">
    <div class="grey-message">
      {{ getMessageDigest(props.message) }}
      <span v-if="enableReedit && originalObjectName === MessageType.TEXT && electronExtension.enable()" class="reedit" @click="handleReedit">{{ content }} </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, onBeforeMount } from 'vue';
import {
  getMessage, ErrorCode, MessageType, electronExtension,
} from '@rongcloud/imlib-next';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { InnerEvent } from '@lib/core/EventDefined';
import { $t } from '../i18n-vue';
import { getMessageDigest, textarea, ctx } from './context';
import { IRCKitMessageComponentProps } from '../interface';

const content = $t('message.list.reedit');
const props = defineProps<IRCKitMessageComponentProps>();

const originalObjectName = ref<string>('');
const recallContent = ref<string>('');
const recallTime = ref<number>(0);
let timer: any = null;
const enableReedit = ref<boolean>(true);

const handleReedit = async () => {
  if (!textarea.value) return;
  const content = textarea.value.value.length ? `\n${recallContent.value}` : recallContent.value;
  ctx().dispatch(new RCKitEvent(InnerEvent.SET_TEXTAREA_VALUE_EVENT, content));
};

onBeforeMount(async () => {
  if (electronExtension.enable()) {
    const { code, data } = await getMessage(props.message.messageUId);
    if (code === ErrorCode.SUCCESS && data && data.content?.originalMessageContent) {
      // TODO: 获取历史消息，与直接撤回返回的消息体不一致，需要 lib 确认
      originalObjectName.value = data.content.originalObjectName || data.content.originalMessageContent.originalObjectName || '';
      recallContent.value = data.content.recallContent || data.content.originalMessageContent.recallContent || '';
      recallTime.value = data.content.recallTime || data.content.originalMessageContent.recallTime || '';
    }
  }
  const duration = Date.now() - recallTime.value;
  const { allowedToReEditTime } = ctx();
  if (duration > 1000 * allowedToReEditTime) {
    enableReedit.value = false;
  }
  // 启动定时器删除, 默认
  if (!timer && originalObjectName.value === MessageType.TEXT && enableReedit.value) {
    timer = setTimeout(() => {
      enableReedit.value = false;
      clearTimeout(timer);
      timer = null;
    }, 1000 * allowedToReEditTime - duration);
  }
});
onUnmounted(() => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
});
</script>

<style>
.grey-message {
  display: inline-block;
  color: #41464F;
  margin: 0 auto;
  padding: 8px;
  background-color: #F3F5FA;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  line-height: 20px;
}
.reedit {
  color: #337ecc;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  margin-left: 3px;
}
.reedit:hover {
  color: #0099FF;
}
</style>
