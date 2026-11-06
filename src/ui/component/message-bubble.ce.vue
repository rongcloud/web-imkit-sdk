<template>
  <div class="rc-message-bubble-root" :class="{'rc-message-bubble-align-right': props.align}">
    <p class="name" :class="{ align: props.align }">
      <span v-if="props.showname" class="nickname">{{ profile.nickname || profile.name }}</span>
      <span class="time">{{ timeController(message.sentTime) }}</span>
    </p>
    <div class="message-content-wrapper">
      <div class="message-body-wrapper" :style="bubbleColorStyle">
        <div v-if="props.hasQuote" class="message-quote-region">
          <slot name="quote"></slot>
        </div>
        <div
          class="message-content-region"
          :class="{
            'message-content-region-inset': hasContentInset,
            'message-content-region-with-reactions': props.hasReactions,
          }">
          <slot name="content"></slot>
        </div>
        <div v-if="props.hasReactions" class="message-reactions-region">
          <slot name="reactions"></slot>
        </div>
      </div>
      <div class="message-actions-wrapper" :class="{
        'message-actions-wrapper-file': props.isH5 && message.messageType === MessageType.FILE
          && message.messageDirection === MessageDirection.SEND,
      }">
        <div
          v-if="!props.isH5"
          class="hover-menu-icon"
          :class="{ 'hover-menu-icon-active': props.menuActive || props.reactionBoardActive || props.isItemHover }">
          <img
            :width="20"
            :height="20"
            :src="props.menuActive || isHoveringMenus ? HOVER_MENU_ACTIVE_ICON : HOVER_MENU_ICON"
            @mouseenter="isHoveringMenus = true"
            @mouseleave="isHoveringMenus = false"
            @click.stop="handleMenuClick"/>
          <img
            v-if="props.reaction && message.sentStatus === SentStatus.SENT"
            :width="20"
            :height="20"
            :src="props.reactionBoardActive || isHoverReaction ? HOVER_REACTION_ACTIVE_ICON : HOVER_REACTION_ICON"
            @mouseenter="isHoverReaction = true"
            @mouseleave="isHoverReaction = false"
            @click.stop="handleReactionClick"/>
        </div>
        <rc-message-sent-status
          v-if="props.showSentStatus"
          class="rc-kit-msg-sent-status"
          :type="0"
          :message="message"
          @sent-status-click="handleSentStatusClick"
        >
        </rc-message-sent-status>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IAReceivedMessage, MessageDirection, MessageType, SentStatus,
} from '@rongcloud/imlib-next';
import { formatTime } from '../../helper';
import { $tt } from '../i18n-vue';
import {
  HOVER_MENU_ICON, HOVER_MENU_ACTIVE_ICON,
  HOVER_REACTION_ICON, HOVER_REACTION_ACTIVE_ICON,
} from '../../assets';
import {
  MessageBubbleContentLayout,
  shouldInsetMessageBubbleContent,
} from '../message-bubble-layout';

const isHoveringMenus = ref(false);
const isHoverReaction = ref(false);

const props = defineProps<{
  showname: boolean | null;
  reaction?: boolean;
  align: boolean | null;
  message: IAReceivedMessage;
  profile: {
    name: string
    nickname?: string
    userId: string
    portraitUri: string
  }
  bubbleColorStyle: {
    color: string;
    backgroundColor: string;
    borderRadius: string;
  }
  menuActive?: boolean;
  reactionBoardActive?: boolean;
  isH5?: boolean;
  isItemHover?: boolean;
  showSentStatus?: boolean;
  contentLayout?: MessageBubbleContentLayout;
  hasQuote?: boolean;
  hasReactions?: boolean;
}>();

const hasContentInset = computed(() => shouldInsetMessageBubbleContent(
  props.contentLayout,
  !!props.hasQuote,
  !!props.hasReactions,
));

const emit = defineEmits(['menu-click', 'reaction-click', 'sent-status-click']);

const handleSentStatusClick = (_message: IAReceivedMessage, e: MouseEvent) => {
  emit('sent-status-click', e);
};

const handleMenuClick = (e: MouseEvent) => {
  emit('menu-click', e);
};

const handleReactionClick = (e: MouseEvent) => {
  emit('reaction-click', e);
};

const weekDays = [
  'time.format.sunday',
  'time.format.monday',
  'time.format.tueday',
  'time.format.wedday',
  'time.format.thurday',
  'time.format.friday',
  'time.format.satday',
];

const timeController = (time: number) => {
  const {
    year, month, day, hour, minute, weekDay,
  } = formatTime(time)!;
  const now = new Date();
  const msgDate = new Date(time);

  const isToday = now.toDateString() === msgDate.toDateString();

  if (isToday) {
    return `${hour}:${minute}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === msgDate.toDateString();

  if (isYesterday) {
    return `${$tt('time.format.yesterday')} ${hour}:${minute}`;
  }

  const isThisYear = now.getFullYear() === msgDate.getFullYear();

  if (isThisYear) {
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    if (msgDate > oneWeekAgo) {
      // @ts-ignore
      return `${$tt(weekDays[weekDay])} ${hour}:${minute}`;
    }
    return `${month}/${day} ${hour}:${minute}`;
  }

  return `${year}/${month}/${day}`;
};
</script>
<style>
.rc-message-bubble-root {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 100%;
}
.rc-message-bubble-align-right {
  align-items: flex-end;
}
p {
  margin: 0 0 5px 0;
  line-height: 16px;
  padding: 0;
  word-break: break-word;
}
.message-body-wrapper {
  font-size: 14px;
  min-width: 0;
  max-width: 100%;
  flex: 1 1 auto;
}

.message-quote-region {
  position: relative;
  padding: 20px;
}

.message-quote-region::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background-color: #0000001A;
}

.message-content-region-inset {
  padding: 20px;
}

.message-content-region {
  min-width: 0;
  max-width: 100%;
}

.message-content-region-inset.message-content-region-with-reactions {
  padding-bottom: 0;
}

.message-reactions-region {
  margin-top: 12px;
  padding: 0 20px 20px;
}
.name {
  font-size: 12px;
  color: #41464F;
  max-width: 100%;
}

.nickname {
  margin-right: 8px;
}

.align {
  text-align: right;
}

.time {
  display: inline-block;
  font-weight: normal;
  color: #7C838E;
}

.message-content-wrapper {
  display: flex;
  align-items: flex-start;
  max-width: 100%;
}

.rc-message-bubble-align-right .message-content-wrapper {
  flex-direction: row-reverse;
}

.message-actions-wrapper {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  justify-content: flex-start;
  align-items: flex-start;
  flex-shrink: 0;
  margin: 0 4px;
}

.rc-message-bubble-align-right .message-actions-wrapper {
  align-items: flex-end;
}

/* Keep the file body at the same width when sending/failed status icons disappear. */
.message-actions-wrapper-file {
  min-width: 18px;
}

.rc-kit-msg-sent-status {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: auto;
}

.hover-menu-icon {
  visibility: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  flex-shrink: 0;
}

.rc-message-bubble-root:hover .hover-menu-icon,
.hover-menu-icon-active {
  visibility: visible;
}
</style>
