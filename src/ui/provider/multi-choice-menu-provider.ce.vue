<template>
  <rc-multi-choice-menu :count="messages.length" :is-h5="isH5"
    @forward="handleForward(RCKitModalForwardingType.SINGLE)"
    @merge-forward="handleForward(RCKitModalForwardingType.MERGE)"
    @cancel="hide"
    @delete="handleDelete"></rc-multi-choice-menu>
</template>
<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { RCKitModalForwardingType } from '@lib/core/EventDefined';
import type { IRCKitCachedMessage } from '@lib/modules/MessageDataModule';
import { MessageType, SentStatus } from '@rongcloud/imlib-next';
import {
  forwarding, handleDeleteMessage, ctx,
} from './context';

const props = defineProps<{ messages: IRCKitCachedMessage[]; isH5?: boolean }>();
const emit = defineEmits<{(e: 'cancel'): void }>();
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});

const hide = () => {
  // 旧工具栏的异步操作结束后，不影响新会话或新一轮多选。
  if (!disposed) emit('cancel');
};

const handleForward = async (type: RCKitModalForwardingType) => {
  if (props.messages.length <= 0) return;
  if (props.messages.length > 100) {
    ctx().alert('alert.forward.over.length');
    return;
  }
  const unaccepted: number[] = [];
  const types: string[] = [
    MessageType.TEXT, MessageType.IMAGE, MessageType.FILE,
    MessageType.RICH_CONTENT, MessageType.HQ_VOICE, MessageType.VOICE,
    MessageType.COMBINE, MessageType.COMBINE_V2, MessageType.GIF,
    MessageType.SIGHT, MessageType.FILE, MessageType.REFERENCE,
  ];
  if (type === RCKitModalForwardingType.MERGE) {
    const length = types.length - 1;
    types.splice(length, 1);
  }

  // 对选中的消息列表按升序排列
  const messages = props.messages.slice().sort((a, b) => a.sentTime - b.sentTime);

  messages.forEach((item, index) => {
    if (!(types.includes(item.messageType) && item.sentStatus !== SentStatus.SENDING && item.sentStatus !== SentStatus.FAILED)) {
      unaccepted.push(index + 1);
    }
  });

  if (unaccepted.length > 0) {
    ctx().alert('alert.forward.not.supported', `${unaccepted.join(',')}`);
    return;
  }

  const bool = await forwarding(type, messages);
  if (!bool) {
    return;
  }
  hide();
};

const handleDelete = async () => {
  if (props.messages.length > 100) {
    ctx().alert('alert.delete.over.length');
    return;
  }
  if (await handleDeleteMessage(props.messages.slice())) {
    hide();
  }
};
</script>
