<template>
  <div class="rc-conversation-detail-bar" :class="{ 'is-h5': isH5 }">
    <!-- H5 模式下的返回按钮 -->
    <div v-if="isH5 && showBack" class="back-button" @click="handleBack">
      <span class="back-icon">&lt;</span>
    </div>
    <!-- 群成员数量 -->
    <div class="info">
      <img @click="handleConversationNaviClick" class="icon" :src="conversation.portraitUri" alt="Conversation Icon">
      <div class="info-main">
        <div class="info-title-group">
          <span class="name">{{ conversation.name }}</span>
          <rc-icon-notification v-if="conversation.notificationLevel === 5"></rc-icon-notification>
          <template v-if="isGroup">
            <img class="member-icon" :src="GROUP_MEMBERS_ICON" alt="Group Members Icon">
            <span class="member-count">{{ conversation.memberCount }}</span>
          </template>
        </div>
      </div>
      <span class="typing-content" v-if="showTypingStatus && !isGroup">{{ typingContent }}</span>
    </div>
    <!-- 动态功能区，允许业务层拓展 -->
    <div class="extension">
      <img class="extension-icon" v-for="item in list" :src="item.icon" :key="item.id" alt="Extension Icon" @click="handleExtension(item)">
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  PropType, computed, onMounted, onUnmounted, ref,
} from 'vue';
import {
  ConversationType, addEventListener, removeEventListener, Events, ITypingStatusEvent, MessageType,
} from '@rongcloud/imlib-next';
import {
  ConversationSelectedEvent, RCKitEvents, RecvNewMessagesEvent, InnerEvent,
} from '@lib/core/EventDefined';
import { StatisticKey } from '@lib/modules/Statistic';
import { IRCKitCachedConversation } from '../../modules/conversation/IRCKitCachedConversation';
import { GROUP_MEMBERS_ICON } from '../../assets';
import { ctx, openedConversation, textarea } from './context';
import { IRCKitConversationExtension } from '../../modules/RCKitStore';
import { RCKitEvent } from '../../core/RCKitEvent';
import { isSameConversation, isMobileDevice } from '../../helper';
import { $t } from '../i18n-vue';
import { IRCKitCachedMessage } from '../../modules/MessageDataModule';

const props = defineProps({
  conversation: {
    type: Object as PropType<IRCKitCachedConversation>,
    required: true,
  },
  showBack: {
    type: Boolean,
    default: true,
  },
});
const isGroup = computed(() => props.conversation.conversationType === ConversationType.GROUP);

const isH5 = ref(false);

const checkDevice = () => {
  isH5.value = isMobileDevice();
};

const handleBack = () => {
  const context = ctx();
  // 保存草稿
  if (openedConversation.value) {
    context.conversation.handleConversationDraft(openedConversation.value, textarea.value?.value);
  }
  // 关闭当前会话
  context.conversation.setOpenedConversation(null, false);
};

const context = ctx();
const extension = context.store.getConversationExtension();
const list = computed(() => extension.filter((item) => !item.filter || item.filter(props.conversation)));

const handleExtension = (item: IRCKitConversationExtension) => {
  context.emit(new RCKitEvent(RCKitEvents.CONVERSATION_EXTENSION_CLICK, {
    id: item.id, conversation: props.conversation,
  }));
};

const handleConversationNaviClick = () => {
  context.statistic(StatisticKey.CONVERSATION_NAVI_CLICK);
  context.emit(new RCKitEvent(RCKitEvents.CONVERSATION_NAVI_CLICK, { ...props.conversation }), 2);
};

let typingTimer: any = null;
const showTypingStatus = ref<boolean>(false);
const isTextTyping = ref<boolean>(false);
const typingContent = ref<string>($t('conversation.detail.bar.typing').value);
/**
 * 对方正在输入中
 * @param evt
 */
const _onTypingStatus = (evt: ITypingStatusEvent) => {
  const hasCurrentConversation = evt.status.findIndex(
    (item) => (openedConversation.value && isSameConversation(item, openedConversation.value)),
  );
  if (hasCurrentConversation === -1) {
    return;
  }

  const { list } = evt.status[hasCurrentConversation];
  if (list.length === 0) {
    return;
  }

  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
    showTypingStatus.value = false;
    typingContent.value = '';
  }

  isTextTyping.value = list.some((item) => item.messageType === MessageType.TEXT);
  typingContent.value = isTextTyping.value ? $t('conversation.detail.bar.typing').value : $t('conversation.detail.bar.typing.audio').value;
  showTypingStatus.value = true;
  typingTimer = setTimeout(() => {
    showTypingStatus.value = false;
    typingContent.value = '';
  }, 5000);
};

const _onConversationSelected = (env: ConversationSelectedEvent) => {
  showTypingStatus.value = false;
};

/**
 * 处理收到新消息，如果消息来自正在输入的用户，立即清除正在输入状态
 * @param evt
 */
const _onRecvNewMessages = (evt: RecvNewMessagesEvent) => {
  if (!openedConversation.value || isGroup.value) {
    return;
  }

  const messages: IRCKitCachedMessage[] = evt.data;
  const currentUserId = context.userId;

  // 检查是否有来自对方的消息（非自己发送的消息）
  const hasMessageFromOther = messages.some((msg) => isSameConversation(msg, openedConversation.value!)
           && msg.senderUserId !== currentUserId);

  if (hasMessageFromOther) {
    // 立即清除正在输入状态
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    showTypingStatus.value = false;
    typingContent.value = '';
  }
};

onMounted(() => {
  checkDevice();
  window.addEventListener('resize', checkDevice);
  addEventListener(Events.TYPING_STATUS, _onTypingStatus);
  context.addEventListener(RCKitEvents.CONVERSATION_SELECTED, _onConversationSelected);
  context.addEventListener(InnerEvent.RECV_NEW_MESSAGES, _onRecvNewMessages);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice);
  removeEventListener(Events.TYPING_STATUS, _onTypingStatus);
  context.removeEventListener(RCKitEvents.CONVERSATION_SELECTED, _onConversationSelected);
  context.removeEventListener(InnerEvent.RECV_NEW_MESSAGES, _onRecvNewMessages);
});

</script>

<style>
.rc-conversation-detail-bar {
  width: 100%;
  height: 70px;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-bottom: 1px dashed #E4E7ED;
  position: relative;
  z-index: 2;
  background-color: #fff;
}
.info {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}
.info-main {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.info-title-group {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}
.icon {
  width: 32px;
  height: 32px;
  margin: 0 10px 0 20px;
  flex-shrink: 0;
}
.name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  color: #020814;
  font-weight: 500;
}
.member-icon {
  margin: 0 4px 0 20px;
  width: 12px; height: 12px;
  flex-shrink: 0;
}
.member-count {
  font-size: 12px;
  color: #bcbcbc;
  flex-shrink: 0;
}
.extension {
  margin: 0 28px 0 10px;
  flex-shrink: 0;
}
.extension-icon {
  width: 26px;
  height: 26px;
  margin-right: 10px;
  cursor: pointer;
}
.typing-content {
  margin-left: 5px;
  font-size: 12px;
  color: #7C838E;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.back-button {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-left: 5px;
  font-weight: 500;
  color: #000;
  flex-shrink: 0;
}

.is-h5 .icon {
  margin-left: 10px;
}

.is-h5 .extension {
  margin-right: 12px;
}

.is-h5 .typing-content {
  display: none;
}
</style>
