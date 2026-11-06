<template>
  <div class="rc-conversation-list-item"
    :class="{
      'active-top': props.conversation.isTop,
      'active-selected': props.selected && !props.rightClicked,
      'active-right-clicked': props.rightClicked,
    }"
    :style="itemStyle">
    <div class="rc-conversation-list-item-avatar">
      <rc-icon
        class="rc-icon"
        :width="avatarSize"
        :height="avatarSize"
        :radius="50"
        :url="props.conversation.portraitUri"
        :online="props.conversation.online">
      </rc-icon>
    </div>

    <div class="conversation-info">
      <div class="info-block" style="align-items: center;">
        <div style="max-width: 50%;">
          <rc-conversation-label :name="props.conversation.name"></rc-conversation-label>
        </div>
        <rc-icon-top v-if="props.conversation.isTop"></rc-icon-top>
        <rc-icon-notification v-if="props.conversation.notificationLevel === 5"></rc-icon-notification>
        <div class="rc-time-icon-container">
          <rc-conversation-time class="rc-conversation-time" :time="props.time"></rc-conversation-time>
          <div class="hover-menu-icon" @click.stop="handleMenuClick">
            <img :width="16" :height="16" :src="hoverMenuActive ? HOVER_MENU_ACTIVE_ICON : HOVER_MENU_ICON" alt="HOVER_MENU_ICON" />
          </div>
        </div>
      </div>
      <div class="info-block">
        <div class="rc-kit-conversation-draft" v-if="props.draft">
          <span class="draft">{{ draftMsg }}</span>
        </div>
        <div class="rc-kit-conversation-group" v-if="props.conversation.conversationType === ConversationType.GROUP && !props.draft">
          <span v-if="props.conversation.mentionedType" class="mentioned">{{ msg }}</span>
          <span v-if="props.name">{{ props.name }}: </span>
        </div>
        <rc-message-sent-status
          class="rc-message-sent-status"
          v-if="isShowSentStatusIcon"
          :type="1"
          :message="props.conversation.latestMessage"></rc-message-sent-status>
        <rc-conversation-latest-message
          v-if="props.message || conversation.draft"
          class="rc-conversation-latest-message"
          :message="props.draft ? conversation.draft : props.message"
          :mentioned="props.conversation.mentionedType"></rc-conversation-latest-message>
        <rc-conversation-unread v-if="!isShowSentStatusIcon"
          :markunread="props.conversation.markUnread"
          :count="props.conversation.unreadCount"
          :notification="props.conversation.notificationLevel"></rc-conversation-unread>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ConversationType, GroupReadReceiptVersion, SentStatus } from '@rongcloud/engine';
import { RCKitCommand } from '@lib/enums/RCKitCommand';
import { computed, ref, watch } from 'vue';
import { IRCKitCachedConversation } from '../../modules/conversation/IRCKitCachedConversation';
import { ctx } from '../provider/context';
import { $t } from '../i18n-vue';
import { HOVER_MENU_ICON, HOVER_MENU_ACTIVE_ICON } from '../../assets';
import { normalizeColor } from '../../helper';

const props = defineProps<{
  message: string,
  time: string,
  conversation: IRCKitCachedConversation,
  statusEnable: boolean | null,
  name: string,
  draft: boolean | null;
  selected: boolean | null;
  rightClicked: boolean | null;
}>();

const emit = defineEmits<{(e: 'menu-click', event: MouseEvent): void
}>();

const handleMenuClick = (e: MouseEvent) => {
  emit('menu-click', e);
  clickHoverMenu.value = true;
};
let clickHoverMenu = ref(false);
const hoverMenuActive = computed(() => props.rightClicked && clickHoverMenu.value);

// watch(() => props.rightClicked, (val) => {
//   if (!val) {
//     // clickHoverMenu.value = false;
//   }
// });

const context = ctx();
const { conversationItemCfg } = context.conversationItem;

const itemStyle = computed(() => {
  const cfg = conversationItemCfg;
  const style: Record<string, string> = {};

  if (cfg.radius !== undefined) {
    style.borderRadius = `${cfg.radius}px`;
  }

  style['--rc-item-selected-bg'] = normalizeColor(cfg.activeBackgroundColor);
  style['--rc-item-top-bg'] = normalizeColor(cfg.topBackgroundColor);
  style['--rc-item-hover-bg'] = props.selected
    ? style['--rc-item-selected-bg']
    : normalizeColor(cfg.hoverBackgroundColor);

  return style;
});

const avatarSize = computed(() => (conversationItemCfg.portraitSize === 'small' ? 32 : 40));

const msg = $t('conv.mentioned.me.msg');
const draftMsg = $t('conv.draft.msg');
// 判断是否为发送中或发送失败状态（响应式）
const isSentStatus = computed(() => props.conversation.latestMessage?.sentStatus === SentStatus.FAILED
         || props.conversation.latestMessage?.sentStatus === SentStatus.SENDING);

// 是否不展示 V5 群组已读图标，仅当开启显示消息已读状态且是 V5 群组时才不展示（响应式）
const isNotGroupReadV5 = computed(() => {
  if (
    context.store.getCommandSwitch(RCKitCommand.SHOW_MESSAGE_STATE)
    && context.readReceiptVersion === GroupReadReceiptVersion.V5
    && !isSentStatus.value
  ) {
    return props.conversation.conversationType !== ConversationType.GROUP;
  }
  return true;
});

const isShowSentStatusIcon = computed(() => {
  if (!props.statusEnable || !isNotGroupReadV5.value || !props.conversation.latestMessage) {
    return false;
  }
  // 会话中有草稿时，不展示消息发送状态
  if (props.draft) {
    return false;
  }
  // 发送中或发送失败时，即使有未读消息也应该显示状态图标
  if (isSentStatus.value) {
    return true;
  }
  // 其他情况：只有在没有未读消息时才显示状态图标
  return !props.conversation.unreadCount && !props.conversation.markUnread;
});
</script>
<style>
:host {
  display: block;
}
.rc-message-sent-status {
  margin-right: 5px;
  margin-top: 2px;
}
.rc-conversation-list-item {
  display: flex;
  height: 78px;
  align-items: center;
  padding: 0 14px 0 10px;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 6px;
}
@media (max-width: 768px) {
  .rc-conversation-list-item {
    user-select: none;
    -webkit-user-select: none;
  }
}
.rc-conversation-list-item-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}
.rc-conversation-list-item.active-top {
  background-color: var(--rc-item-top-bg);
}
.rc-conversation-list-item.active-selected {
  background-color: var(--rc-item-selected-bg);
}
.rc-conversation-list-item.active-right-clicked {
  background-color: #F1F1F1 !important;
}
.rc-conversation-list-item:hover {
  background-color: var(--rc-item-hover-bg);
}
.rc-conversation-list-item .conversation-info {
  margin-left: 8px;
  flex: 1 1 auto;
  overflow: hidden;
  height: 44px;
}
.rc-conversation-list-item .conversation-info .info-block {
  font-size: 12px;
  display: flex;
}
.rc-conversation-latest-message {
  flex: 1;
  overflow: hidden;
  min-height: 18px;
  margin: 4px 15px 0 0;
}
.rc-icon {
  position: relative;
  font-size: 0px;
}
.rc-kit-conversation-group {
  color: #7C838E;
  line-height: 18px;
  margin-top: 4px;
}
.mentioned {
  color: #D45F5F;
  margin-right: 5px;
}
.rc-kit-conversation-draft {
  margin-top: 4px;
}
.rc-kit-conversation-draft .draft {
  color: #D45F5F;
  margin-right: 5px;
}

.rc-time-icon-container {
  display: flex;
  justify-content: flex-end;
  min-width: 16px;
  margin-left: auto;
}

.hover-menu-icon {
  display: none;
  cursor: pointer;
  width: 16px;
  height: 16px;
}

@media (min-width: 769px) {
  .rc-conversation-list-item:hover .hover-menu-icon,
  .rc-conversation-list-item.active-right-clicked .hover-menu-icon {
    display: block;
  }

  .rc-conversation-list-item:hover .rc-conversation-time,
  .rc-conversation-list-item.active-right-clicked .rc-conversation-time {
    display: none;
  }
}

</style>
