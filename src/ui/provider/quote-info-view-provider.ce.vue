<template>
  <div class="view-box" :class="{ unavailable }">
    <div class="view-box-prefix"></div>
    <div class="user-name">{{ userName }}:</div>
    <div class="message-content">
      <!-- 非 LOADED 状态：显示状态文本 -->
      <template v-if="quoteInfo.status !== RCKitQuoteMessageStatus.LOADED">
        {{ messageContent }}
      </template>
      <!-- LOADED 状态：根据 messageType 使用不同的组件或文本 -->
      <template v-else>
        <!-- 如果有对应的消息组件，使用组件渲染 -->
        <component
          v-if="hasMessageComponent"
          :is="messageComponentTag"
          :message="quoteInfo.quoteMessage"
          :position="RCKitMessageComponentRenderPosition.QUOTE_INFO"
        ></component>
        <!-- 如果没有组件，使用 digest 获取文本 -->
        <span v-else>{{ messageDigest }}</span>
      </template>
    </div>
    <span v-if="quoteInfo.status === RCKitQuoteMessageStatus.LOADED && quoteInfo.isEdited" class="edited">({{ $tt('message.edit.edited') }})</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ConversationType } from '@rongcloud/imlib-next';
import { IRCKitQuoteInfo } from '@lib/modules/MessageDataModule';
import { RCKitQuoteMessageStatus } from '@lib/enums/RCKitQuoteMessageStatus';
import { $tt } from '../i18n-vue';
import {
  currentUserProfile, openedConversation, getGroupMemberDisplayName, getMessageComponentTag, getMessageDigest,
} from './context';
import { RCKitMessageComponentRenderPosition } from '../interface';

const props = defineProps<{
  quoteInfo: IRCKitQuoteInfo;
  legacy?: boolean;
}>();

const unavailable = computed(() => props.quoteInfo.status === RCKitQuoteMessageStatus.DELETED
  || props.quoteInfo.status === RCKitQuoteMessageStatus.RECALLED);

/**
 * 获取引用消息的用户名称
 * 直接使用 senderId 获取用户信息，不依赖 quoteMessage（因为 quoteMessage 只在 LOADED 状态才有值）
 */
const userName = computed(() => {
  const { senderId } = props.quoteInfo;

  // 如果是当前用户发送的消息
  if (senderId === currentUserProfile.value?.userId) {
    return currentUserProfile.value?.name || senderId;
  }

  // 如果是群聊，从群成员列表中查找
  if (openedConversation.value?.conversationType === ConversationType.GROUP) {
    return getGroupMemberDisplayName(senderId);
  }

  // 私聊场景，显示会话对方的名称
  return openedConversation.value?.name || senderId;
});

/**
 * 非 LOADED 状态时显示的状态文本
 */
const messageContent = computed(() => {
  const { status } = props.quoteInfo;

  switch (status) {
    case RCKitQuoteMessageStatus.LOADING:
      return $tt('quote.status.loading');

    case RCKitQuoteMessageStatus.DELETED:
      return $tt(props.legacy ? 'quote.status.unavailable' : 'quote.status.deleted');

    case RCKitQuoteMessageStatus.RECALLED:
      return $tt(props.legacy ? 'quote.status.unavailable' : 'quote.status.recalled');

    case RCKitQuoteMessageStatus.LOAD_ERROR:
      return $tt('quote.status.load-error');

    default:
      return '';
  }
});

/**
 * 获取消息组件标签
 */
const messageComponentTag = computed(() => {
  if (!props.quoteInfo.quoteMessage) {
    return '';
  }
  return getMessageComponentTag(props.quoteInfo.quoteMessage.messageType);
});

/**
 * 判断是否有对应的消息组件
 */
const hasMessageComponent = computed(() => {
  if (!props.quoteInfo.quoteMessage) {
    return false;
  }
  const tag = getMessageComponentTag(props.quoteInfo.quoteMessage.messageType);
  // 如果返回的是 "rc-unsupported-message"，说明没有对应的组件
  return tag !== 'rc-unsupported-message';
});

/**
 * 获取消息摘要文本（用于没有组件的情况）
 * 会调用 digest 钩子，如果没有 digest 则返回"不支持的消息类型"
 */
const messageDigest = computed(() => {
  if (!props.quoteInfo.quoteMessage) {
    return '';
  }
  // quoteMessage 是 IAReceivedMessage 类型，但 getMessageDigest 期望 IRCKitCachedMessage
  // 由于 getMessageDigest 只使用基本字段，我们可以安全地进行类型断言
  return getMessageDigest(props.quoteInfo.quoteMessage as any);
});

</script>

<style scoped>
.edited { color: #7C838E; margin-left: 4px; white-space: nowrap; user-select: none; -webkit-user-select: none; }
.view-box.unavailable { color: #7C838E; .view-box-prefix { background-color: #7C838E; } }
.view-box {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #020814;

  .view-box-prefix {
    background-color: #020814;
    width: 1px;
    height: 10px;
    flex-shrink: 0;
  }

  .user-name {
    margin-left: 8px;
    margin-right: 8px;
    flex-shrink: 0;
  }

  .message-content {
    flex: 1;
    overflow: hidden;
    line-height: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .message-content > * {
    max-width: 100%;
    flex-shrink: 1;
  }

  .message-content > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
