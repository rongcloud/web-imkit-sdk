<template>
  <div v-if="opened" class="rc-kit-msg-list" ref="messageViewportRef">
    <!-- 消息列表 -->
    <div
      class="rc-kit-msg-list-scroll"
      ref="messageListRef"
      @scroll="handleScroll"
      @touchstart.capture.passive="handleScrollTouchStart"
      @touchmove.capture.passive="handleScrollTouchMove"
      @touchend.capture.passive="handleScrollTouchEnd"
      @touchcancel.capture.passive="handleScrollTouchEnd"
      @wheel.passive="handleScrollWheel"
      @keydown="handleScrollKeydown">
      <div ref="messageBoxRef" style="padding: 10px;">
      <div
        v-if="topSpacerHeight"
        class="rc-kit-msg-list-spacer"
        :style="{ height: `${topSpacerHeight}px` }"
      ></div>
      <div
        class="rc-kit-msg-list-box"
        :class="{ 'rc-kit-msg-list-box-edit': typeof item !== 'string' && isVisibleEditor(item) }"
        v-for="{ item, index, key } in virtualRenderList"
        :key="key"
        :data-virtual-index="index"
        :data-virtual-is-last="index === messageRenderList.length - 1 ? 'true' : undefined"
      >
        <!-- 固定预留多选框列，切换模式时保持消息可用宽度不变 -->
        <div class="checkbox"
          v-if="typeof item !== 'string' && !isGreyMessage(item.messageType) && !isVisibleEditor(item)">
          <label v-if="multiChoiceMode && item.sentStatus !== 10" :for="item.messageUId || `${item.transactionId}`">
            <input :id="item.messageUId || `${item.transactionId}`" type="checkbox" v-model="selectedMessageUids" :value="item.messageUId || `${item.transactionId}`">
            <span class="custom">
              <img :src="CHECKED_ICON" alt="CHECKED_ICON">
            </span>
          </label>
        </div>
        <!-- 时间间隔组件 -->
        <rc-message-time class="rc-kit-time-section" v-if="typeof item === 'string'" :time="item"></rc-message-time>
        <template v-else>
          <!-- 灰条消息 -->
          <rc-grey-message-provider v-if="isGreyMessage(item.messageType)"
            class="rc-kit-grey-message"
            @click.capture="stopEventWhenMultiChoiceMode($event)"
            @contextmenu.capture="stopEventWhenMultiChoiceMode($event)"
            @touchstart.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @touchmove.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @touchend.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @touchcancel.capture.passive="stopEventWhenMultiChoiceMode($event)"
            :position="RCKitMessageComponentRenderPosition.MESSAGE_LIST"
            :message="item">
          </rc-grey-message-provider>
          <!-- 气泡消息 -->
          <div v-else class="rc-kit-msg-list-item"
            :data-message-uid="item.messageUId"
            :style="{ 'flex-direction': bubbleDirection(item) }"
            @click.capture="stopEventWhenMultiChoiceMode($event)"
            @contextmenu.capture="stopEventWhenMultiChoiceMode($event)"
            @touchstart.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @touchmove.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @touchend.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @touchcancel.capture.passive="stopEventWhenMultiChoiceMode($event)"
            @mouseenter="hoveredMessageUId = item.messageUId"
            @mouseleave="hoveredMessageUId = ''">
            <rc-icon
              class="rc-kit-msg-avatar"
              :url="handleUserProfiles(item).portraitUri"
              :width="32" :height="32"
              :style="{'opacity': showAvatar(item, messageRenderList[index -1]) ? 1 : 0}"
              :radius="50" @click="handleIconClisk(item)" :online="false" v-if="bubbleShowPortrait(item)"></rc-icon>

            <div class="rc-kit-msg-bubble-wrapper" :class="{
              'rc-kit-msg-bubble-wrapper-right': bubbleStyleAlign(item),
              'rc-kit-msg-bubble-wrapper-edit': isVisibleEditor(item),
              'rc-kit-msg-bubble-wrapper-file': item.messageType === MessageType.FILE,
            }">
              <rc-message-edit-provider v-if="isVisibleEditor(item)" :draft="item.editDraft ?? item.content.content ?? ''"
                :selected-emoji="editorEmoji?.messageUId === item.messageUId ? editorEmoji : undefined"
                @draft="context.message.setEditDraft(item, item.messageUId, $event.detail[0])"
                @cancel="context.message.clearEdit(item, item.messageUId)"
                @confirm="context.message.submitEdit(item, item.messageUId)"
                @emoji-toggle="handleReactionClick(item, $event, 'edit')"
                @before-resize="handleEditBeforeResize" @resize="handleEditResize">
              </rc-message-edit-provider>
              <rc-message-bubble v-else
                class="rc-kit-msg-bubble"
                :showname="bubbleShowName(item)"
                :align="bubbleStyleAlign(item)"
                :message="item"
                :reaction="canShowReactionEntry(item)"
                :message-uid="item.messageUId"
                :profile="handleUserProfiles(item)"
                :is-h5="isH5"
                :class="{
                  'rc-kit-msg-bubble-media': isMediaMessage(item.messageType),
                  'rc-kit-msg-bubble-file': item.messageType === MessageType.FILE,
                }"
                :show-sent-status="handleShowSentStatus(item)"
                :bubble-color-style="bubbleColorStyle(item, showAvatar(item, messageRenderList[index -1]))"
                :content-layout="getMessageBubbleContentLayout(item.messageType)"
                :has-quote="!!item.quoteInfo"
                :has-reactions="isReactionEnabled && item.reactions.length > 0"
                :menu-active="messageMenuStyle.display === 'block' && currentSelectMessage?.messageUId === item.messageUId"
                :reaction-board-active="reactionPanelStyle.display !== 'none' && reactionTargetMessage?.messageUId === item.messageUId"
                :is-item-hover="!multiChoiceMode && hoveredMessageUId === item.messageUId"
                @sent-status-click="handleResendMessage(item, $event)"
                @menu-click="handleMessageRightClick(item, $event)"
                @reaction-click="handleReactionClick(item, $event)"
                @contextmenu.prevent.native="handleMessageRightClick(item, $event)"
                @touchstart.passive="handleMessageTouchStart(item, $event)"
                @touchmove.passive="longPressTouchMove"
                @touchend="longPressTouchEnd"
                @touchcancel.passive="longPressTouchCancel">
                <!-- 消息引用数据视图组件 -->
                <rc-quote-info-view-provider
                  v-if="item.quoteInfo"
                  slot="quote"
                  :quote-info="item.quoteInfo" :legacy="item.messageType === MessageType.REFERENCE">
                </rc-quote-info-view-provider>
                <!-- 消息组件 -->
                <component
                  slot="content"
                  @link="handleLinkClick"
                  @click="handleBubbleClick(item)"
                  :is="getMessageComponentTag(item.messageType)"
                  :message="item"
                  :position="RCKitMessageComponentRenderPosition.MESSAGE_LIST"
                >
                </component>
                <!-- 表情回复组件 -->
                <rc-message-reactions-provider v-if="isReactionEnabled && item.reactions.length"
                  slot="reactions"
                  :reactions="item.reactions"
                  :align="bubbleStyleAlign(item)"
                  :message="item"></rc-message-reactions-provider>
              </rc-message-bubble>

              <div v-if="!isH5 && !isVisibleEditor(item) && (item.editStatus === RCKitMessageEditStatus.UPDATING || item.editStatus === RCKitMessageEditStatus.FAILED)"
                class="rc-kit-edit-status-anchor">
                <div class="rc-kit-edit-feedback">
                  <div v-if="item.editStatus === RCKitMessageEditStatus.UPDATING" class="rc-kit-edit-status" role="status">
                    <img class="edit-spinner" :src="MESSAGE_EDIT_UPDATING_ICON" alt="" aria-hidden="true">
                    <span>{{ $tt('message.edit.updating') }}</span>
                  </div>
                  <button v-else class="rc-kit-edit-status edit-retry" type="button" :disabled="multiChoiceMode"
                    @click.stop="context.message.submitEdit(item, item.messageUId)">
                    <img :src="MESSAGE_EDIT_FAILED_ICON" alt="" aria-hidden="true">
                    <span>{{ $tt('message.edit.retry') }}</span>
                  </button>
                </div>
              </div>
              <!-- 语音转文字状态展示 -->
              <div class="rc-kit-stt-status"
                v-if="item.messageType === MessageType.HQ_VOICE && item.messageUId && shouldShowSTTStatus(item.messageUId)"
                :class="{ 'rc-kit-stt-status-right': bubbleStyleAlign(item) }">
                <div v-if="getSTTStatus(item.messageUId) === 'converting'" class="rc-kit-stt-converting">
                  <div class="rc-kit-stt-loading">
                    <div class="rc-kit-stt-loading-dot"></div>
                    <div class="rc-kit-stt-loading-dot"></div>
                    <div class="rc-kit-stt-loading-dot"></div>
                  </div>
                </div>
                <div v-else-if="getSTTStatus(item.messageUId) === 'error'" class="rc-kit-stt-error">
                  <rc-icon :url="SENT_STATUS_FAILED_ICON" :radius="50" :width="16" :height="16" class="rc-kit-stt-error-icon"></rc-icon>
                  <span class="rc-kit-stt-error-text">{{ sttErrorCodeMap[item.messageUId] === ErrorCode.SPEECH_TO_TEXT_MESSAGE_CONTENT_UNSUPPORTED ? $t('message.speech.to.text.unsupported') : $t('message.speech.to.text.failed') }}</span>
                </div>
                <div v-else-if="getSTTStatus(item.messageUId) === 'success'" class="rc-kit-stt-success">
                  {{ getSTTText(item.messageUId)}}
                </div>
              </div>
            </div>

          </div>
        </template>
      </div>
      <div
        v-if="bottomSpacerHeight"
        class="rc-kit-msg-list-spacer"
        :style="{ height: `${bottomSpacerHeight}px` }"
      ></div>
      </div>
    </div>
    <!-- 消息列表 End -->
    <!-- 滚动条 -->
    <rc-scrollbar-thumb-provider
      @handlemove="handleMove"
      @mouseenter="handleScrollbarEnter"
      @mouseleave="handleScrollbarLeave"
      v-if="sizeHeight"
      :height="sizeHeight"
      :move="moveY"
      :scrollheight="messageListRef?.scrollHeight"
      :ratio="ratioY"
      :style="{
        opacity: showScrollbar ? 1 : 0,
        transition: 'opacity 0.5s',
        pointerEvents: showScrollbar ? 'auto' : 'none'
      }"
    ></rc-scrollbar-thumb-provider>
    <!-- 滚动条 End-->
    <!-- 消息菜单 -->
    <div
      v-if="isH5 && messageMenuStyle.display === 'block'"
      class="rc-message-list-menu-mask"
      @click="hideMsgMenu"
    ></div>
    <div v-if="messageMenuStyle.display === 'block'" class="rc-message-list-menu" ref="messageMenuRef" :style="{
      top: `${messageMenuStyle.top}px`,
      left: `${messageMenuStyle.left}px`,
      display: messageMenuStyle.display,
    }">
      <div v-if="msgMenu.length > 0" style="padding: 5px;">
        <rc-message-list-menu-item v-for="item in msgMenu" :icon="item.icon" :id="item.id" :label="item.label"
        @click="handleMenuItemClick(item.id, item.message, $event)"></rc-message-list-menu-item>
      </div>
    </div>
    <!-- 消息菜单 End -->
    <!-- 表情回复面板 -->
    <div v-if="reactionPanelStyle.display !== 'none'" class="rc-reaction-panel" ref="reactionPanelRef" @mouseleave="hideReactionPanel" :style="{
      top: `${reactionPanelStyle.top}px`,
      left: `${reactionPanelStyle.left}px`,
      display: reactionPanelStyle.display,
    }">
      <rc-character-emoji-panel-provider @select="handleReactionEmojiClick($event.detail[0])"></rc-character-emoji-panel-provider>
    </div>
    <!-- 表情回复面板 End -->
    <!-- 多选线 -->
    <rc-message-select class="rc-kit-select" v-if="multiChoiceMode" :selected="!!selected" @select="handleSelectMessages"
      ref="DOMSelect">
    </rc-message-select>
    <!-- 多选线 End -->
    <rc-message-location v-if="unreadCountBottom > 0 && hasMoreBackward"
      @click.capture="stopEventWhenMultiChoiceMode($event)"
      :count="unreadCountBottom" :direction="1"
      @location="handleLocation2Bottom"></rc-message-location>
    <!-- 消息定位 到未读位置-->
    <rc-message-location @click.capture="stopEventWhenMultiChoiceMode($event)"
      v-if="unreadCountTop > 0 && FOCUS_ON_LATEST_MESSAGE"
      :count="unreadCountTop"
      :direction="0"
      @location="handleLocation2Top"></rc-message-location>

    <!-- 已读未读弹窗 -->
    <rc-read-receipt-modal
      v-if="showReadReceiptModal"
      :message="readReceiptMessage"
      :visible="showReadReceiptModal"
      :read-users="readUsers"
      :unread-count="unreadCount"
      :read-count="readCount"
      :unread-users="unreadUsers"
      :read-loading="readLoading"
      :unread-loading="unreadLoading"
      :position="readReceiptPosition"
      @close="handleCloseReadReceiptModal"
      @read-status-scroll="onReadReceiptScroll"
    ></rc-read-receipt-modal>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted, ref, onBeforeUnmount, onUnmounted, nextTick, reactive, computed, watch,
} from 'vue';
import {
  electronExtension,
  getFirstUnreadMessage,
  ErrorCode,
  ConversationType,
  MessageDirection,
  BaseMessage,
  ITextMessageContent,
  IReferenceMessageContent,
  GroupReadReceiptVersion,
  IConversationIdentifier,
  MessageType,
  SentStatus,
} from '@rongcloud/imlib-next';
import {
  ConversationSelectedEvent, MessagesDeletedEvent, FileUploadProgressEvent, InnerEvent, InsertNewMessagesEvent,
  MessageStateChangeEvent, RCKitEvents, RCKitModalForwardingType, RecvNewMessagesEvent,
} from '@lib/core/EventDefined';
import { StatisticKey } from '@lib/modules/Statistic';
import { IRCKitCachedConversation } from '@lib/modules/conversation/IRCKitCachedConversation';
import {
  ctx, selectReplyMessage,
  openedConversation as opened, getSelectedGroupMember, currentUserProfile,
  getMessageComponentTag, getMessageBubbleContentLayout, isGreyMessage,
  messageList, forwarding, handleDeleteMessage, handleShowSentStatus, unreadCountBottom,
  handleRecallMessage,
  sttStatusMap, sttTextMap, sttHiddenMap, sttErrorCodeMap,
} from './context';
import { $tt, $t } from '../i18n-vue';
import {
  createLongPressSyntheticEvent, longPressTouchCancel, longPressTouchEnd, longPressTouchMove, longPressTouchStart,
} from '../long-press';
import { IRCKitLanguageEntries } from '../../languages';
import { RCKitEvent } from '../../core/RCKitEvent';
import { IRCKitCachedMessage } from '../../modules/MessageDataModule';
import { IRCKitMessageBubbleCfg, RCKitBubbleLayout } from '../../modules/BubbleModule';
import {
  isSameConversation, trans2ConversationKey, formatTime, findLastIndex, createRCKitCacheMessage, createScrollControl, isMobileDevice, normalizeColor,
} from '../../helper';
import { RCKitCommand } from '../../enums/RCKitCommand';
import { RCKitMessageEditStatus } from '../../enums/RCKitMessageEditStatus';
import { canReactToMessage, RCKitMessageMenuID } from '../../modules/MessageMenu';
import {
  CHECKED_ICON, SENT_STATUS_FAILED_ICON, MESSAGE_EDIT_UPDATING_ICON, MESSAGE_EDIT_FAILED_ICON,
} from '../../assets';
import { RCKitMessageComponentRenderPosition } from '../interface';
import {
  calculateReadReceiptFallbackLayout,
  calculateReadReceiptLayout,
} from '../read-receipt-layout';
import type { IReadReceiptPosition } from '../read-receipt-layout';
import { createVirtualListHeightCache } from '../virtual-list-height-cache';
import {
  calculateViewportAnchorScrollTop,
  createVirtualResizeAnchorController,
  getViewportOffsetForScrollAnchor,
} from '../virtual-list-scroll-anchor';
import type { IVirtualResizeAnchorTransaction } from '../virtual-list-scroll-anchor';
import { createLifecycleGuard } from './lifecycle-guard';

type IUIMessage = string | IRCKitCachedMessage;
interface IVirtualRenderItem {
  item: IUIMessage;
  index: number;
  key: string;
}
interface IVirtualScrollAnchor {
  key: string;
  offset: number;
}
interface IVirtualResizeAnchor extends IVirtualScrollAnchor {
  viewportOffset: number;
}

const context = ctx();
const isReactionEnabled = context.isMessageReactionEnabled;
const canShowReactionEntry = (message: IRCKitCachedMessage): boolean => isReactionEnabled && canReactToMessage(message);
const hoveredMessageUId = ref<string>('');

const emit = defineEmits<{(e: 'selection-change', active: boolean, messages: IRCKitCachedMessage[]): void}>();

// 多选只属于当前消息列表实例，离开列表或切换会话时清空。
const multiChoiceMode = ref(false);
const selectedMessageUids = ref<string[]>([]);
const selected = ref(true);
const selectedMessages = computed(() => {
  if (!multiChoiceMode.value || !selectedMessageUids.value.length) return [];
  const messagesById = new Map(messageList.value.map((message) => [message.messageUId || `${message.transactionId}`, message]));
  const messages: IRCKitCachedMessage[] = [];
  selectedMessageUids.value.forEach((id) => {
    const message = messagesById.get(id);
    if (message) messages.push(message);
  });
  return messages;
});

const exitMultiChoiceMode = (): void => {
  selectedMessageUids.value = [];
  selected.value = true;
  multiChoiceMode.value = false;
};

defineExpose({ exitMultiChoiceMode });

// #region 语音转文字状态管理
/** 获取转换状态 */
const getSTTStatus = (messageUId: string): 'converting' | 'success' | 'error' | undefined => sttStatusMap.value[messageUId];

/** 获取转换文本 */
const getSTTText = (messageUId: string): string => {
  const text = sttTextMap.value[messageUId] || context.speechToTextStore.getSTTText(messageUId) || '';
  // 如果文本为空字符串，返回空格
  return text === '' ? $tt('message.speech.to.text.empty') : text;
};

/** 判断是否应该显示转换状态 */
const shouldShowSTTStatus = (messageUId: string): boolean => {
  // 如果被隐藏了，不显示
  if (sttHiddenMap.value[messageUId]) {
    return false;
  }
  const status = getSTTStatus(messageUId);
  if (status) return true;
  // 如果已经转换成功但状态未设置，也显示
  const text = context.speechToTextStore.getSTTText(messageUId);
  if (text) {
    sttStatusMap.value[messageUId] = 'success';
    sttTextMap.value[messageUId] = text;
    return true;
  }
  return false;
};

// #endregion

const weeklist: Array<keyof IRCKitLanguageEntries> = [
  'time.format.sunday',
  'time.format.monday',
  'time.format.tueday',
  'time.format.wedday',
  'time.format.thurday',
  'time.format.friday',
  'time.format.satday',
];

// 时间组件数据过滤
const handleTimeFilter = (time: number): string => {
  const {
    year, month, day, weekDay,
  } = formatTime(time)!;
  const today = new Date();
  const date = new Date(time);
  // 比较本地日历日期，避免跨午夜及夏令时导致的 24 小时差值误判。
  const interval = (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    - Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000;
  if (interval === 0) return $tt('time.format.today');
  if (interval === 1) return $tt('time.format.yesterday');
  if (interval >= 2 && interval < 7) {
    return $tt(weeklist[weekDay] as keyof IRCKitLanguageEntries);
  }
  return $tt('time.format.full', year, month, day);
};

// #region 消息列表

/**
 * 计算 v-for 渲染 key。
 * 要点：本地发送的消息在"发送中 → 发送成功"期间，transactionId 始终不变，而 messageUId 是发送成功后才回填的。
 * 若以 messageUId 优先做 key，会在回填瞬间发生 key 跳变，触发 Vue 销毁并重建整条气泡（包括内部 <img>），
 * 导致 GIF 等远端 URL 类媒体消息出现短暂白屏。因此本地消息优先用稳定的 transactionId 作为 key，
 * 收到的历史/他端消息 transactionId 为 NaN，再回退到 messageUId。
 */
const getRenderItemKey = (item: IUIMessage, index: number): string => {
  if (typeof item === 'string') {
    // 显示文案可能相同，时间行以所属日期和首条消息标识区分，并在分页/语言变化时保持稳定。
    const message = messageRenderList.value[index + 1];
    if (message && typeof message !== 'string') {
      return `time-${new Date(message.sentTime).toDateString()}-${getRenderItemKey(message, index + 1)}`;
    }
    return `rc-kit-time-${index}`;
  }
  if (Number.isFinite(item.transactionId)) {
    return `tx-${item.transactionId}`;
  }
  return item.messageUId || `rc-kit-${index}`;
};

let hasMoreForward = true;
const hasMoreBackward = ref<boolean>(false);

/**
 * 根据历史消息计算渲染数据，区分不同时间段的消息
 */
const messageRenderList = computed(() => {
  const list = messageList.value;
  const result: IUIMessage[] = [];

  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    result.unshift(item);

    const before = list[i - 1];
    if (before) {
      // 与前一消息不属于同一天，向前插入时间数据
      if (new Date(item.sentTime).toDateString() !== new Date(before.sentTime).toDateString()) {
        result.unshift(handleTimeFilter(item.sentTime));
      }
    } else if (!hasMoreForward) {
      // 当前消息为第一条消息，判断是否有更多可拉取的历史消息，没有则插入时间数据
      result.unshift(handleTimeFilter(item.sentTime));
    }
  }
  return result;
});

const VIRTUAL_ITEM_ESTIMATED_HEIGHT = 88;
const VIRTUAL_TIME_ESTIMATED_HEIGHT = 32;
const VIRTUAL_OVERSCAN_COUNT = 8;

const virtualRange = reactive({ start: 0, end: -1 });
const topSpacerHeight = ref(0);
const bottomSpacerHeight = ref(0);
const rowHeightCache = createVirtualListHeightCache();
let virtualWindowFrame = 0;
let virtualMeasureFrame = 0;
const resizeAnchorController = createVirtualResizeAnchorController<IVirtualResizeAnchor>();
const bottomScrollGuard = createLifecycleGuard();
let bottomLayoutToken: number | null = null;
const beginBottomLayout = () => {
  const token = bottomScrollGuard.capture();
  bottomLayoutToken = token;
  wasStrictlyAtBottomBeforeResize = true;
  hasUserScrolledAwayFromBottom = false;
  resizeAnchorController.cancel();
  return token;
};
const multiChoiceScrollGuard = createLifecycleGuard();
let keepBottomDuringMultiChoiceChange = false;
const cancelMultiChoiceScroll = () => {
  multiChoiceScrollGuard.invalidate();
  keepBottomDuringMultiChoiceChange = false;
};
const cancelResizeScrollAnchor = () => {
  resizeAnchorController.cancel();
  cancelAdjustMessageListScroll();
  cancelMultiChoiceScroll();
};
const messageListLifecycleGuard = createLifecycleGuard();
let messageListLifecycleToken = 0;
const isCurrentMessageList = (conversation: IConversationIdentifier, lifecycleToken: number) => (
  messageListLifecycleGuard.isCurrent(lifecycleToken)
  && !!opened.value
  && isSameConversation(conversation, opened.value)
);
const onDestroyUserCache = () => {
  messageListLifecycleGuard.invalidate();
  messageListLifecycleToken = 0;
  cancelAdjustMessageListScroll();
  cancelPaginationTimer();
  exitMultiChoiceMode();
  cancelMultiChoiceScroll();
};

const getVirtualItemKey = (index: number, item = messageRenderList.value[index]): string => {
  if (!item) {
    return `rc-kit-empty-${index}`;
  }
  return getRenderItemKey(item, index);
};

const getEstimatedItemHeight = (item: IUIMessage | undefined): number => {
  if (typeof item === 'string') {
    return VIRTUAL_TIME_ESTIMATED_HEIGHT;
  }
  return VIRTUAL_ITEM_ESTIMATED_HEIGHT;
};

const getVirtualItemHeight = (index: number): number => {
  const item = messageRenderList.value[index];
  if (!item) {
    return 0;
  }
  return rowHeightCache.get(getVirtualItemKey(index, item)) || getEstimatedItemHeight(item);
};

const getHeightBeforeIndex = (targetIndex: number): number => {
  const list = messageRenderList.value;
  const end = Math.max(0, Math.min(targetIndex, list.length));
  let height = 0;
  for (let i = 0; i < end; i += 1) {
    height += getVirtualItemHeight(i);
  }
  return height;
};

const getVirtualTotalHeight = (): number => getHeightBeforeIndex(messageRenderList.value.length);

const findVirtualIndexByOffset = (offset: number): number => {
  const list = messageRenderList.value;
  if (!list.length) {
    return 0;
  }

  let height = 0;
  for (let i = 0; i < list.length; i += 1) {
    const nextHeight = height + getVirtualItemHeight(i);
    if (nextHeight >= offset) {
      return i;
    }
    height = nextHeight;
  }
  return list.length - 1;
};

const recalculateVirtualWindow = () => {
  const list = messageRenderList.value;
  const metrics = readMessageListMetrics();
  if (!list.length) {
    virtualRange.start = 0;
    virtualRange.end = -1;
    topSpacerHeight.value = 0;
    bottomSpacerHeight.value = 0;
    return;
  }

  const scrollTop = metrics?.scrollTop || 0;
  const clientHeight = metrics?.clientHeight || 0;
  const visibleStart = findVirtualIndexByOffset(scrollTop);
  const visibleEnd = findVirtualIndexByOffset(scrollTop + clientHeight);
  const start = Math.max(0, visibleStart - VIRTUAL_OVERSCAN_COUNT);
  const end = Math.min(list.length - 1, visibleEnd + VIRTUAL_OVERSCAN_COUNT);
  const topHeight = getHeightBeforeIndex(start);
  const renderedHeight = getHeightBeforeIndex(end + 1) - topHeight;
  const totalHeight = getVirtualTotalHeight();

  virtualRange.start = start;
  virtualRange.end = end;
  topSpacerHeight.value = topHeight;
  bottomSpacerHeight.value = Math.max(totalHeight - topHeight - renderedHeight, 0);
  closeFloatingLayerWhenTargetInvisible();
};

const renderVirtualWindowAroundIndex = (anchorIndex: number) => {
  const list = messageRenderList.value;
  const metrics = readMessageListMetrics();
  if (!list.length) {
    recalculateVirtualWindow();
    return;
  }

  const visibleCount = Math.max(
    Math.ceil((metrics?.clientHeight || VIRTUAL_ITEM_ESTIMATED_HEIGHT) / VIRTUAL_ITEM_ESTIMATED_HEIGHT),
    1,
  );
  const start = Math.max(anchorIndex - VIRTUAL_OVERSCAN_COUNT, 0);
  const end = Math.min(anchorIndex + visibleCount + VIRTUAL_OVERSCAN_COUNT, list.length - 1);
  const topHeight = getHeightBeforeIndex(start);
  const renderedHeight = getHeightBeforeIndex(end + 1) - topHeight;

  virtualRange.start = start;
  virtualRange.end = end;
  topSpacerHeight.value = topHeight;
  bottomSpacerHeight.value = Math.max(getVirtualTotalHeight() - topHeight - renderedHeight, 0);
  closeFloatingLayerWhenTargetInvisible();
};

const scheduleVirtualMeasurement = () => {
  if (virtualMeasureFrame) {
    return;
  }
  const el = messageListRef.value;
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  virtualMeasureFrame = requestAnimationFrame(() => {
    virtualMeasureFrame = 0;
    if (!el || messageListRef.value !== el || !conversation
      || !isCurrentMessageList(conversation, lifecycleToken)) return;
    measureVirtualRows();
  });
};

const scheduleVirtualWindowUpdate = () => {
  if (virtualWindowFrame) {
    return;
  }
  const el = messageListRef.value;
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => !!el && messageListRef.value === el && !!conversation
    && isCurrentMessageList(conversation, lifecycleToken);
  virtualWindowFrame = requestAnimationFrame(() => {
    virtualWindowFrame = 0;
    if (!isCurrent()) return;
    recalculateVirtualWindow();
    nextTick(() => {
      if (isCurrent()) scheduleVirtualMeasurement();
    });
  });
};

const refreshVirtualWindow = async () => {
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => !!conversation && isCurrentMessageList(conversation, lifecycleToken);
  await nextTick();
  if (!isCurrent()) return;
  if (!invalidateVirtualHeightsForWidthChange()) {
    recalculateVirtualWindow();
  }
  await nextTick();
  if (!isCurrent()) return;
  scheduleVirtualMeasurement();
};

const waitForNextFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => resolve());
});

const settleMessageListToBottom = async (retryCount = 3, scrollToken = beginBottomLayout()) => {
  const el = messageListRef.value;
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => messageListRef.value === el
    && !!conversation && isCurrentMessageList(conversation, lifecycleToken)
    && bottomScrollGuard.isCurrent(scrollToken);
  try {
    if (!el || !isCurrent()) return;
    let previousScrollHeight = -1;
    for (let i = 0; i < retryCount; i += 1) {
      // Flush editor and virtual spacer changes within the same paint. Waiting for
      // animation frames here exposes the old scroll position while a row grows.
      await nextTick();
      if (!isCurrent()) return;
      // Custom elements and virtual spacers can finish layout after the first scroll.
      // Measure restored editors, then flush the resulting spacer heights before scrolling.
      measureVirtualRows();
      await nextTick();
      if (!isCurrent()) return;
      const metrics = syncScrollbarPosition();
      if (!metrics) {
        return;
      }

      const targetScrollTop = Math.max(metrics.scrollHeight - metrics.clientHeight, 0);
      if (Math.abs(el.scrollTop - targetScrollTop) > 1) {
        el.scrollTop = targetScrollTop;
      }
      recalculateVirtualWindow();
      await nextTick();
      if (!isCurrent()) return;
      // Rendering a different virtual window may change its spacers again.
      // Correct that flush too, including the last bounded measurement pass.
      el.scrollTop = Math.max(el.scrollHeight - el.clientHeight, 0);
      const latestMetrics = syncScrollbarPosition();
      if (latestMetrics && isNearMessageListBottom(latestMetrics, 2)
        && Math.abs(latestMetrics.scrollHeight - previousScrollHeight) <= 0.5) {
        break;
      }
      previousScrollHeight = latestMetrics?.scrollHeight ?? -1;
    }
  } finally {
    if (bottomLayoutToken === scrollToken) {
      bottomLayoutToken = null;
      if (el && isCurrent()) syncBottomStateFromMetrics();
    }
  }
};

const virtualRenderList = computed<IVirtualRenderItem[]>(() => {
  const list = messageRenderList.value;
  if (!list.length || virtualRange.end < virtualRange.start) {
    return [];
  }

  const end = Math.min(virtualRange.end, list.length - 1);
  const result: IVirtualRenderItem[] = [];
  for (let index = virtualRange.start; index <= end; index += 1) {
    const item = list[index];
    result.push({
      item,
      index,
      key: getVirtualItemKey(index, item),
    });
  }
  return result;
});

const measureVirtualRows = () => {
  const el = messageListRef.value as HTMLElement | undefined;
  if (!el) {
    return;
  }
  alignMessageEditStatuses();

  let changed = false;
  const shouldKeepBottom = bottomLayoutToken !== null || keepBottomDuringMultiChoiceChange
    || shouldFollowMessageListBottom();
  const resizeAnchorTransaction = resizeAnchorController.take();
  const rows = el.querySelectorAll<HTMLElement>('.rc-kit-msg-list-box[data-virtual-index]');
  rows.forEach((row) => {
    const index = Number(row.dataset.virtualIndex);
    const item = messageRenderList.value[index];
    if (!item) {
      return;
    }

    const style = window.getComputedStyle(row);
    const marginBottom = Number.parseFloat(style.marginBottom) || 0;
    const measuredHeight = row.getBoundingClientRect().height + marginBottom;
    const key = getVirtualItemKey(index, item);
    const cachedHeight = rowHeightCache.get(key);
    if (measuredHeight > 0 && Math.abs((cachedHeight || 0) - measuredHeight) > 0.5) {
      rowHeightCache.set(key, measuredHeight);
      changed = true;
    }
  });

  if (
    resizeAnchorTransaction
    && !shouldKeepBottom
  ) {
    const resizeAnchor = resizeAnchorTransaction.value;
    const anchorIndex = findRenderIndexByKey(resizeAnchor.key);
    if (anchorIndex === -1) {
      resizeAnchorController.cancel();
      restoreScrollAnchor(resizeAnchor);
      return;
    }
    renderVirtualWindowAroundIndex(anchorIndex);
    nextTick(() => restoreResizeScrollAnchor(resizeAnchorTransaction));
    return;
  }
  if (resizeAnchorTransaction) {
    resizeAnchorController.cancel();
  }
  if (changed) {
    recalculateVirtualWindow();
    const latestMetrics = update();
    if (shouldKeepBottom && latestMetrics && messageListRef.value) {
      messageListRef.value.scrollTop = Math.max(latestMetrics.scrollHeight - latestMetrics.clientHeight, 0);
      syncScrollbarPosition();
      onBottomArea.value = true;
      hasUserScrolledAwayFromBottom = false;
      wasStrictlyAtBottomBeforeResize = true;
    }
  }
};

const alignMessageEditStatuses = () => {
  const list = messageListRef.value as HTMLElement | undefined;
  if (!list) return;
  const viewport = list.getBoundingClientRect();
  list.querySelectorAll<HTMLElement>('.rc-kit-edit-status-anchor').forEach((anchor) => {
    const wrapper = anchor.parentElement;
    const body = wrapper?.querySelector('rc-message-bubble')?.shadowRoot?.querySelector('.message-body-wrapper');
    const feedback = anchor.querySelector<HTMLElement>('.rc-kit-edit-feedback');
    if (!body || !feedback) return;
    const bubbleRect = body.getBoundingClientRect();
    const statusWidth = feedback.getBoundingClientRect().width;
    const rightAligned = wrapper?.classList.contains('rc-kit-msg-bubble-wrapper-right');
    const left = rightAligned && statusWidth > bubbleRect.width ? bubbleRect.right - statusWidth : bubbleRect.left;
    // Status must not widen a short bubble or extend outside the message viewport.
    feedback.style.left = `${Math.max(viewport.left + 10, left) - anchor.getBoundingClientRect().left}px`;
  });
};

const resetVirtualWindow = () => {
  rowHeightCache.reset();
  cancelResizeScrollAnchor();
  virtualRange.start = 0;
  virtualRange.end = -1;
  topSpacerHeight.value = 0;
  bottomSpacerHeight.value = 0;
  if (virtualWindowFrame) {
    cancelAnimationFrame(virtualWindowFrame);
    virtualWindowFrame = 0;
  }
  if (virtualMeasureFrame) {
    cancelAnimationFrame(virtualMeasureFrame);
    virtualMeasureFrame = 0;
  }
};

const findRenderIndexByKey = (key: string): number => (
  messageRenderList.value.findIndex((item, index) => getVirtualItemKey(index, item) === key)
);

const captureScrollAnchor = (): IVirtualScrollAnchor | null => {
  const metrics = readMessageListMetrics();
  const list = messageRenderList.value;
  if (!metrics || !list.length) {
    return null;
  }

  const index = findVirtualIndexByOffset(metrics.scrollTop);
  return {
    key: getVirtualItemKey(index, list[index]),
    offset: metrics.scrollTop - getHeightBeforeIndex(index),
  };
};

const restoreScrollAnchor = (anchor: IVirtualScrollAnchor | null) => {
  resizeAnchorController.cancel();
  if (!anchor || !messageListRef.value) {
    scheduleVirtualWindowUpdate();
    return;
  }

  const index = findRenderIndexByKey(anchor.key);
  if (index === -1) {
    scheduleVirtualWindowUpdate();
    return;
  }

  messageListRef.value.scrollTop = Math.max(getHeightBeforeIndex(index) + anchor.offset, 0);
  recalculateVirtualWindow();
  scheduleVirtualMeasurement();
  syncScrollbarPosition();
  syncBottomStateFromMetrics();
};

const getRenderedVirtualRowByKey = (key: string): HTMLElement | null => {
  const index = findRenderIndexByKey(key);
  if (index === -1) {
    return null;
  }
  return (messageListRef.value?.querySelector(
    `.rc-kit-msg-list-box[data-virtual-index="${index}"]`,
  ) as HTMLElement | null) || null;
};

const getRenderedViewportOffset = (key: string): number | null => {
  const el = messageListRef.value;
  const row = getRenderedVirtualRowByKey(key);
  if (!el || !row) {
    return null;
  }
  return row.getBoundingClientRect().top - el.getBoundingClientRect().top;
};

const restoreResizeScrollAnchor = (
  transaction: IVirtualResizeAnchorTransaction<IVirtualResizeAnchor>,
) => {
  const el = messageListRef.value;
  if (!el || !resizeAnchorController.isCurrent(transaction)) {
    return;
  }

  const anchor = transaction.value;
  const currentViewportOffset = getRenderedViewportOffset(anchor.key);
  if (currentViewportOffset === null) {
    resizeAnchorController.cancel();
    restoreScrollAnchor(anchor);
    return;
  }

  el.scrollTop = calculateViewportAnchorScrollTop(
    el.scrollTop,
    currentViewportOffset,
    anchor.viewportOffset,
  );
  resizeAnchorController.cancel();
  recalculateVirtualWindow();
  scheduleVirtualMeasurement();
  syncScrollbarPosition();
  syncBottomStateFromMetrics();
};

const invalidateVirtualHeightsForWidthChange = (): boolean => {
  const viewportWidth = messageListRef.value?.clientWidth || 0;
  if (resizeAnchorController.peek()) {
    rowHeightCache.syncViewportWidth(viewportWidth);
    return true;
  }
  const anchor = captureScrollAnchor();
  const widthChanged = rowHeightCache.syncViewportWidth(viewportWidth);
  if (!widthChanged) {
    return false;
  }

  if (bottomLayoutToken !== null || shouldFollowMessageListBottom()) {
    resizeAnchorController.cancel();
    recalculateVirtualWindow();
    scheduleBottomResync();
    return true;
  }

  if (!anchor) {
    resizeAnchorController.cancel();
    recalculateVirtualWindow();
    return true;
  }

  const contentTopInset = messageBoxRef.value
    ? Number.parseFloat(window.getComputedStyle(messageBoxRef.value).paddingTop) || 0
    : 0;
  resizeAnchorController.begin({
    ...anchor,
    viewportOffset: getViewportOffsetForScrollAnchor(anchor.offset, contentTopInset),
  });

  const anchorIndex = findRenderIndexByKey(anchor.key);
  if (anchorIndex === -1) {
    resizeAnchorController.cancel();
    recalculateVirtualWindow();
    return true;
  }

  renderVirtualWindowAroundIndex(anchorIndex);
  return true;
};

const findRenderIndexByMessage = (message: IRCKitCachedMessage): number => (
  messageRenderList.value.findIndex((item) => (
    typeof item !== 'string' && isSameMessage(item, message)
  ))
);

const isRenderIndexVisible = (index: number): boolean => (
  index >= virtualRange.start && index <= virtualRange.end
);

const closeFloatingLayerWhenTargetInvisible = () => {
  if (currentSelectMessage.value) {
    const index = findRenderIndexByMessage(currentSelectMessage.value);
    if (index === -1 || !isRenderIndexVisible(index)) {
      hideMsgMenu();
    }
  }
  if (reactionTargetMessage.value) {
    const index = findRenderIndexByMessage(reactionTargetMessage.value);
    if (index === -1 || !isRenderIndexVisible(index)) {
      hideReactionPanel();
    }
  }
  if (readReceiptMessage.value) {
    const index = findRenderIndexByMessage(readReceiptMessage.value);
    if (index === -1 || !isRenderIndexVisible(index)) {
      handleCloseReadReceiptModal();
    }
  }
};

watch(messageRenderList, () => {
  rowHeightCache.prune(new Set(
    messageRenderList.value.map((item, index) => getVirtualItemKey(index, item)),
  ));
  scheduleVirtualWindowUpdate();
}, { flush: 'post' });

/**
 * 处理用户详细信息
 */
const handleUserProfiles = (msg: IRCKitCachedMessage): {
  name: string
  nickname?: string
  userId: string
  portraitUri: string
} => {
  if (msg.messageDirection === MessageDirection.SEND) {
    return currentUserProfile.value!;
  }
  if (opened.value?.conversationType === ConversationType.GROUP) {
    const value = getSelectedGroupMember(msg.senderUserId);
    return value || {
      name: msg.senderUserId,
      userId: msg.senderUserId,
      portraitUri: opened.value?.portraitUri,
    };
  }
  return {
    name: opened.value!.name,
    userId: opened.value!.targetId,
    portraitUri: opened.value!.portraitUri,
  };
};

/**
 * 点击头像派发点击事件
 * @param msg
 */
const handleIconClisk = (msg: IRCKitCachedMessage) => {
  const profile = handleUserProfiles(msg);
  context.emit(new RCKitEvent(RCKitEvents.CONVERSATION_ICON_CLICK, {
    conversation: {
      conversationType: msg.conversationType,
      targetId: msg.targetId,
      channelId: msg.channelId,
    },
    profile,
  }), 2);
};

const unreadCountTop = ref<number>(0);

let backupFirstUnreadMessageTime = 0;
const FOCUS_ON_LATEST_MESSAGE = context.store.getCommandSwitch(RCKitCommand.FOCUS_ON_LATEST_MESSAGE);

let firstUnreadMessageTime = 0;

// 会话打开时，历史消息、实时消息、发送态消息可能并发进入列表，需要统一按消息标识合并
const hasValidMessageId = (message: IRCKitCachedMessage): boolean => typeof message.messageId === 'number' && !Number.isNaN(message.messageId);

const hasValidTransactionId = (message: IRCKitCachedMessage): boolean => typeof message.transactionId === 'number' && !Number.isNaN(message.transactionId);

const isSameMessage = (source: IRCKitCachedMessage, target: IRCKitCachedMessage): boolean => {
  if (hasValidTransactionId(source) && hasValidTransactionId(target)) {
    return source.transactionId === target.transactionId;
  }
  if (source.messageUId && target.messageUId) {
    return source.messageUId === target.messageUId;
  }
  if (hasValidMessageId(source) && hasValidMessageId(target)) {
    return source.messageId === target.messageId;
  }
  return false;
};

const mergeMessagesByUniqueKey = (...groups: IRCKitCachedMessage[][]): IRCKitCachedMessage[] => {
  const result: IRCKitCachedMessage[] = [];
  groups.forEach((group) => {
    group.forEach((message) => {
      const index = result.findIndex((item) => isSameMessage(item, message));
      if (index === -1) {
        result.push(message);
      } else {
        result.splice(index, 1, message);
      }
    });
  });
  return result;
};

/**
 *
 * @param timestamp 拉取时间戳
 * @param backward 是否要往后拉取
 */
const handleReqHistories = async (
  conversation: IConversationIdentifier,
  timestamp: number,
  backward: boolean,
  isCurrent: () => boolean,
  initialBottomToken?: number,
): Promise<IRCKitCachedMessage[]> => {
  if (!isCurrent()) return [];
  resizeAnchorController.cancel();

  // 判断是否需要往后拉取
  if (backward) {
    const { code: code1, list, hasMore: hasMore1 } = await context.message.reqHistories(
      conversation,
      timestamp - 1,
      false,
    );
    if (!isCurrent()) {
      return [];
    }
    if (code1 === ErrorCode.SUCCESS) {
      hasMoreBackward.value = hasMore1;
      messageList.value = mergeMessagesByUniqueKey(list);
      await refreshVirtualWindow();
      if (!isCurrent()) return [];
      syncScrollbarPosition();
    }
  }

  const anchor = backward ? captureScrollAnchor() : null;
  const { code, list, hasMore } = await context.message.reqHistories(
    conversation,
    timestamp,
    true,
  );
  if (!isCurrent()) {
    return [];
  }
  if (code === ErrorCode.SUCCESS) {
    messageList.value = mergeMessagesByUniqueKey(list, messageList.value);
    hasMoreForward = hasMore;
    await refreshVirtualWindow();
    if (!isCurrent()) return [];
    const metrics = syncScrollbarPosition();
    if (!metrics || !messageListRef.value) {
      return messageList.value;
    }
    if (backward) {
      restoreScrollAnchor(anchor);
    } else if (initialBottomToken !== undefined) {
      // Initial focus belongs to this load, and must not wait for read receipts
      // or override a scroll gesture made while histories were being requested.
      if (bottomScrollGuard.isCurrent(initialBottomToken)) await setScroll2bottom(initialBottomToken);
      if (!isCurrent()) return [];
    } else {
      // 新滚动位置是为底部
      messageListRef.value.scrollTop = metrics.scrollHeight - metrics.offsetHeight;
      recalculateVirtualWindow();
      syncScrollbarPosition();
    }
    syncBottomStateFromMetrics();
  }
  return messageList.value;
};

/**
 * 初始化消息列表
 * 首次进入会话获取历史消息逻辑：
 * FOCUS_ON_LATEST_MESSAGE => true - 进入会话，会话中展示的是最新消息（Default）
 *  - 默认拉取时间为 0, 向前获取
 * FOCUS_ON_LATEST_MESSAGE => false - 进入会话，会话中展示的是最近已读消息
 *  - 根据该时间戳向前获取历史消息，同时也要向后获取一次历史消息
 *  - 滚动条需定位到首次消息加载的位置
 *
 */
const initMessageList = async () => {
  cancelPaginationTimer();
  if (!opened.value) {
    messageListLifecycleGuard.invalidate();
    messageListLifecycleToken = 0;
    return;
  }

  const lifecycleToken = messageListLifecycleGuard.capture();
  messageListLifecycleToken = lifecycleToken;
  const {
    conversationType, targetId, channelId, unreadCount,
  } = opened.value;
  const conversation = { conversationType, targetId, channelId };
  const isCurrent = () => isCurrentMessageList(conversation, lifecycleToken);
  // 切换会话，数据重置
  resetVirtualWindow();
  messageList.value.length = 0;
  firstUnreadMessageTime = 0;
  const initialBottomToken = FOCUS_ON_LATEST_MESSAGE ? beginBottomLayout() : undefined;

  if (electronExtension.enable()) {
    const { data } = await getFirstUnreadMessage(conversation);
    if (!isCurrent()) {
      return;
    }
    backupFirstUnreadMessageTime = data?.sentTime || 0;
    if (!FOCUS_ON_LATEST_MESSAGE) {
      firstUnreadMessageTime = backupFirstUnreadMessageTime;
    }
  }

  const backward = !FOCUS_ON_LATEST_MESSAGE && firstUnreadMessageTime > 0;
  if (backward) stopFollowingMessageListBottom();
  let list: IRCKitCachedMessage[];
  try {
    list = await handleReqHistories(conversation, firstUnreadMessageTime, backward, isCurrent, initialBottomToken);
  } finally {
    if (bottomLayoutToken === initialBottomToken) bottomLayoutToken = null;
  }
  if (!isCurrent()) {
    return;
  }

  if (FOCUS_ON_LATEST_MESSAGE && electronExtension.enable() && unreadCount) {
    const count = unreadCount - list.length;
    unreadCountTop.value = count < 0 ? 0 : count;
  }

  const { length } = list;
  const latestSentTime = list[length - 1]?.sentTime || opened.value.latestMessage?.sentTime || Date.now();

  // Web 不关注是否有未读数的情况再发送回执，多端时未读数同步，web 会清空所有未读，导致 web 发送回执异常
  // Electron 平台可以按照有未读数的情况发送回执
  if (unreadCountBottom.value) {
    await context.conversation.clearUnreadCountByTimestamp(conversation, latestSentTime);
    if (!isCurrent()) return;
    await context.message.sendReadReceiptMessage(conversation, list);
  } else if (!electronExtension.enable()) {
    await context.message.sendReadReceiptMessage(conversation, list);
  }
};

// #endregion

// #region 自定义消息气泡

const showAvatar = (message: IRCKitCachedMessage, beforMessage: IUIMessage): boolean => true;
// if (!beforMessage || typeof beforMessage === 'string') {
//   return true
// }
// const isSameDay =  new Date(message.sentTime).toDateString() !== new Date(beforMessage.sentTime).toDateString()
// if (isGreyMessage(beforMessage.messageType) && message.senderUserId === beforMessage.senderUserId) {
//   return true
// }
// if (message.senderUserId !== beforMessage.senderUserId ||  isSameDay ) {
//   return true
// }

// return false

const messageBubbleCfg = ref<IRCKitMessageBubbleCfg>();
// 根据配置是否展示用户头像
const bubbleShowPortrait = (item: IRCKitCachedMessage): boolean => {
  const showMyProfileInGroupConversation = messageBubbleCfg.value?.showMyProfileInGroupConversation;
  const showMyProfileInPrivateConversation = messageBubbleCfg.value?.showMyProfileInPrivateConversation;
  const showOthersProfileInGroupConversation = messageBubbleCfg.value?.showOthersProfileInGroupConversation;
  const showOthersProfileInPrivateConversation = messageBubbleCfg.value?.showOthersProfileInPrivateConversation;
  if (
    item.messageDirection === MessageDirection.SEND
    && item.conversationType === ConversationType.PRIVATE
  ) {
    return !!showMyProfileInPrivateConversation;
  }
  if (
    item.messageDirection === MessageDirection.SEND
    && item.conversationType === ConversationType.GROUP
  ) {
    return !!showMyProfileInGroupConversation;
  }
  if (
    item.messageDirection === MessageDirection.RECEIVE
    && item.conversationType === ConversationType.PRIVATE
  ) {
    return !!showOthersProfileInPrivateConversation;
  }
  if (
    item.messageDirection === MessageDirection.RECEIVE
    && item.conversationType === ConversationType.GROUP
  ) {
    return !!showOthersProfileInGroupConversation;
  }
  return false;
};
// 根据配置是否展示用户昵称
const bubbleShowName = (item: IRCKitCachedMessage): boolean => {
  const showMyNameInPrivateConversation = messageBubbleCfg.value?.showMyNameInPrivateConversation;
  const showMyNameInGroupConversation = messageBubbleCfg.value?.showMyNameInGroupConversation;
  const showOthersNameInGroupConversation = messageBubbleCfg.value?.showOthersNameInGroupConversation;
  const showOthersNameInPrivateConversation = messageBubbleCfg.value?.showOthersNameInPrivateConversation;

  if (
    item.messageDirection === MessageDirection.SEND
    && item.conversationType === ConversationType.PRIVATE
  ) {
    return !!showMyNameInPrivateConversation;
  }
  if (
    item.messageDirection === MessageDirection.SEND
    && item.conversationType === ConversationType.GROUP
  ) {
    return !!showMyNameInGroupConversation;
  }
  if (
    item.messageDirection === MessageDirection.RECEIVE
    && item.conversationType === ConversationType.PRIVATE
  ) {
    return !!showOthersNameInPrivateConversation;
  }
  if (
    item.messageDirection === MessageDirection.RECEIVE
    && item.conversationType === ConversationType.GROUP
  ) {
    return !!showOthersNameInGroupConversation;
  }
  return false;
};
// 根据配置修改对齐方式
const bubbleDirection = (item: IRCKitCachedMessage) => {
  if (
    item.messageDirection === 1
    && messageBubbleCfg.value?.layout === RCKitBubbleLayout.LEFT_RIGHT
  ) {
    return 'row-reverse';
  }
  return 'row';
};
// 根据配置修改文字和背景颜色、边框角
const bubbleColorStyle = (item: IRCKitCachedMessage, showAvatar: boolean) => {
  if (!messageBubbleCfg.value) {
    return;
  }

  const textColorForOthers = normalizeColor(messageBubbleCfg.value.textColorForOthers);
  const backgroundColorForOthers = normalizeColor(messageBubbleCfg.value.backgroundColorForOthers);
  const textColorForMyself = normalizeColor(messageBubbleCfg.value.textColorForMyself);
  const backgroundColorForMyself = normalizeColor(messageBubbleCfg.value.backgroundColorForMyself);

  let color = textColorForOthers;
  let backgroundColor = backgroundColorForOthers;
  let borderRadius = `${messageBubbleCfg.value.radius}px`;

  if (item.messageDirection === MessageDirection.SEND) {
    color = textColorForMyself;
    backgroundColor = backgroundColorForMyself;
  }

  // 只有在没有 quoteInfo 且没有 reactions 的情况下，才为图片、视频、GIF 消息设置透明背景
  if ([MessageType.IMAGE, MessageType.SIGHT, MessageType.GIF].includes(item.messageType as any) && !item.quoteInfo && !(item.reactions?.length > 0)) {
    backgroundColor += '00';
  }

  return {
    color,
    backgroundColor,
    borderRadius,
  };
};

const bubbleStyleAlign = (item: IRCKitCachedMessage) => !!(item.messageDirection === 1 && messageBubbleCfg.value?.layout === 'left-right');

const mediaMessageTypes: string[] = [
  MessageType.IMAGE,
  MessageType.SIGHT,
  MessageType.GIF,
];

const isMediaMessage = (messageType: string): boolean => mediaMessageTypes.includes(messageType);

const handleBubbleClick = (item: IRCKitCachedMessage) => {
  if ([SentStatus.SENDING, SentStatus.FAILED].includes(item.sentStatus as SentStatus)) {
    return;
  }

  switch (item.messageType) {
    case MessageType.IMAGE:
      context.emit(new RCKitEvent(RCKitEvents.MEDIA_MESSAGE_MODAL_EVENT, item));
      break;
    case MessageType.SIGHT:
      context.audioPlayer.pause();
      context.emit(new RCKitEvent(RCKitEvents.MEDIA_MESSAGE_MODAL_EVENT, item));
      break;
    case MessageType.GIF:
      context.emit(new RCKitEvent(RCKitEvents.MEDIA_MESSAGE_MODAL_EVENT, item));
      break;
    case MessageType.COMBINE:
    case MessageType.COMBINE_V2:
      context.emit(new RCKitEvent(RCKitEvents.COMBINE_MESSAGE_MODAL_EVENT, item));
      break;
    default:
      break;
  }
};

// #endregion

// #region 右键菜单
const messageViewportRef = ref<HTMLElement>();
const messageListRef = ref();
const messageMenuRef = ref();

const msgMenu = ref<
  { id: string; icon: string; label: string; message: IRCKitCachedMessage }[]
>([]);
const messageMenuStyle = reactive({ left: 0, top: 0, display: 'none' });
let updateMessageMenuPosition: (() => void) | undefined;

// 使用公共滚动控制工具
const scrollControl = createScrollControl(messageListRef);

const currentSelectMessage = ref<IRCKitCachedMessage>();
const isH5 = ref(false);
const activeEditUId = ref<string>();
let editSwitchGeneration = 0;
const syncActiveEdit = () => {
  activeEditUId.value = opened.value
    ? context.conversation.getCachedConversationByKey(trans2ConversationKey(opened.value))?.updatingMessageUId
    : undefined;
  if (reactionPanelMode.value === 'edit' && reactionTargetMessage.value?.messageUId !== activeEditUId.value) hideReactionPanel();
};
const isVisibleEditor = (message: IRCKitCachedMessage) => !isH5.value && !multiChoiceMode.value
  && activeEditUId.value === message.messageUId;
const handleEditBeforeResize = () => {
  if (bottomLayoutToken !== null || shouldFollowMessageListBottom() || wasMessageListStrictlyAtBottom()) {
    wasStrictlyAtBottomBeforeResize = true;
    scheduleBottomResync();
    return;
  }
  if (resizeAnchorController.peek()) return;
  const anchor = captureScrollAnchor();
  const viewportOffset = anchor && getRenderedViewportOffset(anchor.key);
  if (anchor && viewportOffset !== null) resizeAnchorController.begin({ ...anchor, viewportOffset });
};
const handleEditResize = () => {
  if (bottomLayoutToken !== null) return;
  if (shouldFollowMessageListBottom()) {
    scheduleBottomResync();
  } else {
    // A history anchor must also be restored before the resized row is painted.
    measureVirtualRows();
  }
};
const handleStartEdit = async (message: IRCKitCachedMessage) => {
  if (!opened.value || isH5.value || multiChoiceMode.value) return;
  const conversation = { ...opened.value };
  const lifecycleToken = messageListLifecycleToken;
  const generation = ++editSwitchGeneration;
  syncActiveEdit();
  const previousUid = activeEditUId.value;
  if (previousUid && previousUid !== message.messageUId) {
    if (!await context.confirm('message.edit.switch')) return;
    if (generation !== editSwitchGeneration || !isCurrentMessageList(conversation, lifecycleToken)
      || multiChoiceMode.value || isH5.value) return;
    syncActiveEdit();
    if (activeEditUId.value !== previousUid) return;
    // Check the selected row again before discarding the old draft.
    const current = context.message.getCachedMessage(conversation, message.messageUId);
    if (!current || !context.message.canEdit(current)) { context.alert('message.edit.expired'); return; }
    context.message.clearEdit(conversation, previousUid);
  }
  if (!isCurrentMessageList(conversation, lifecycleToken)) return;
  handleEditBeforeResize();
  context.message.startEdit(conversation, message.messageUId);
  syncActiveEdit();
};
const checkDevice = () => {
  isH5.value = isMobileDevice();
};

/**
 * 获取原始点击事件
 * @param e
 */
const getSourceMouseEvent = (e: MouseEvent | CustomEvent) => {
  let mouseEvent = e as MouseEvent;
  if ('detail' in e && Array.isArray(e.detail) && e.detail[0] instanceof MouseEvent) {
    [mouseEvent] = e.detail;
  }
  return mouseEvent;
};

/**
 * 获取点击按钮对应的气泡正文位置
 * @param event
 */
const getBubbleBodyRectByEvent = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  const rootNode = target?.getRootNode();
  if (rootNode instanceof ShadowRoot) {
    return rootNode.querySelector('.message-body-wrapper')?.getBoundingClientRect();
  }
  return undefined;
};

/**
 * 根据气泡方向和点击按钮位置计算弹窗位置
 * @param popupWidth
 * @param popupHeight
 * @param event
 * @param alignRight
 */
const calculateActionPopupPosition = (
  popupWidth: number,
  popupHeight: number,
  event: MouseEvent,
  alignRight: boolean | null,
  anchorRect?: DOMRect,
  bubbleBodyRect = getBubbleBodyRectByEvent(event),
) => {
  if (!messageViewportRef.value) {
    return { left: 0, top: 0 };
  }
  const containerRect = messageViewportRef.value.getBoundingClientRect();
  const target = event.target as HTMLElement | null;
  const targetRect = anchorRect || target?.getBoundingClientRect();
  const gap = 4;
  const bottomSafeGap = 10;
  const maxTop = Math.max(0, containerRect.height - popupHeight - bottomSafeGap);

  if (!targetRect) {
    const relativeX = event.clientX - containerRect.left;
    const relativeY = event.clientY - containerRect.top;
    return {
      left: Math.max(0, Math.min(relativeX, containerRect.width - popupWidth)),
      top: Math.max(0, Math.min(relativeY, maxTop)),
    };
  }

  let left = alignRight
    ? targetRect.left - containerRect.left - popupWidth - gap
    : targetRect.right - containerRect.left + gap;
  let top = (bubbleBodyRect?.top ?? targetRect.top) - containerRect.top;

  if (left + popupWidth > containerRect.width) {
    left = containerRect.width - popupWidth;
  }
  if (left < 0) left = 0;

  if (top > maxTop) {
    top = maxTop;
  }
  if (top < 0) top = 0;

  return { left, top };
};

/**
 * 计算 H5 消息菜单位置：菜单与消息气泡顶部对齐，并紧贴气泡左右两侧。
 * 空间不足时，左右和底部保留 10px 间距，顶部不留间距。
 */
const calculateMessageMenuPosition = (
  popupWidth: number,
  popupHeight: number,
  event: MouseEvent,
  alignRight: boolean | null,
  bubbleRect?: DOMRect,
) => {
  if (!messageViewportRef.value) {
    return { left: 0, top: 0 };
  }

  const containerRect = messageViewportRef.value.getBoundingClientRect();
  const edgeGap = 10;
  const maxLeft = Math.max(0, containerRect.width - popupWidth - edgeGap);
  const minLeft = Math.min(edgeGap, maxLeft);
  const maxTop = Math.max(0, containerRect.height - popupHeight - edgeGap);

  if (!bubbleRect) {
    return {
      left: Math.max(minLeft, Math.min(event.clientX - containerRect.left, maxLeft)),
      top: Math.max(0, Math.min(event.clientY - containerRect.top, maxTop)),
    };
  }

  const gap = 4;
  const preferredLeft = alignRight
    ? bubbleRect.left - containerRect.left - popupWidth - gap
    : bubbleRect.right - containerRect.left + gap;

  return {
    left: Math.max(minLeft, Math.min(preferredLeft, maxLeft)),
    top: Math.max(0, Math.min(bubbleRect.top - containerRect.top, maxTop)),
  };
};

const handleMessageRightClick = async (message: IRCKitCachedMessage, e: MouseEvent | CustomEvent) => {
  if (multiChoiceMode.value) {
    return;
  }

  // 任何方式打开消息菜单时，关闭已读未读弹窗
  handleCloseReadReceiptModal();
  hideReactionPanel();

  const mouseEvent = getSourceMouseEvent(e);
  // 在 await 前保存元素，避免事件派发结束后 target 被重定向到气泡宿主。
  const bubbleBodyElement = e.currentTarget instanceof HTMLElement
    ? e.currentTarget.shadowRoot?.querySelector('.message-body-wrapper')
    : undefined;
  // 悬浮按钮以按钮为横向锚点；右键与长按以正文气泡为锚点。
  const menuAnchorElement = e instanceof CustomEvent
    ? mouseEvent.target as Element | null
    : bubbleBodyElement;

  currentSelectMessage.value = message;

  let list = context.msgMenu.getMenu(message)
    .filter((item) => (isH5.value || item.id !== RCKitMessageMenuID.REACTIONS)
      && (!isH5.value || item.id !== RCKitMessageMenuID.EDIT))
    .map((item) => ({
      id: item.id,
      icon: item.icon,
      label: $tt(item.id as keyof IRCKitLanguageEntries),
      message,
    }));

  // 根据转文字状态动态切换菜单项
  if (message.messageType === MessageType.HQ_VOICE && message.messageUId) {
    const shouldShow = shouldShowSTTStatus(message.messageUId);
    // 查找转文字相关的菜单项索引
    const sttIndex = list.findIndex((item) => item.id === RCKitMessageMenuID.SPEECH_TO_TEXT
      || item.id === RCKitMessageMenuID.CANCEL_SPEECH_TO_TEXT);

    if (sttIndex !== -1) {
      // 根据状态替换菜单项
      if (shouldShow) {
        // 如果显示转文字状态，则显示"取消转文字"
        list[sttIndex] = {
          id: RCKitMessageMenuID.CANCEL_SPEECH_TO_TEXT,
          icon: list[sttIndex].icon,
          label: $tt(RCKitMessageMenuID.CANCEL_SPEECH_TO_TEXT as keyof IRCKitLanguageEntries),
          message,
        };
      } else {
        // 如果隐藏转文字状态，则显示"转文字"
        list[sttIndex] = {
          id: RCKitMessageMenuID.SPEECH_TO_TEXT,
          icon: list[sttIndex].icon,
          label: $tt(RCKitMessageMenuID.SPEECH_TO_TEXT as keyof IRCKitLanguageEntries),
          message,
        };
      }
    }
  }

  msgMenu.value.splice(0, msgMenu.value.length, ...list);
  messageMenuStyle.display = 'block';
  await nextTick();
  if (!messageMenuRef.value) {
    hideMsgMenu();
    return;
  }
  const menu = messageMenuRef.value;
  updateMessageMenuPosition = () => {
    if (messageMenuRef.value !== menu || messageMenuStyle.display !== 'block') return;
    const menuPosition = isH5.value
      ? calculateMessageMenuPosition(
        menu.clientWidth,
        menu.clientHeight,
        mouseEvent,
        bubbleStyleAlign(message),
        bubbleBodyElement?.getBoundingClientRect(),
      )
      : calculateActionPopupPosition(
        menu.clientWidth,
        menu.clientHeight,
        mouseEvent,
        bubbleStyleAlign(message),
        menuAnchorElement?.getBoundingClientRect(),
        bubbleBodyElement?.getBoundingClientRect(),
      );
    messageMenuStyle.top = menuPosition.top;
    messageMenuStyle.left = menuPosition.left;
  };
  updateMessageMenuPosition();
};

// iOS Safari 触摸长按不派发 contextmenu，用 touch 检测长按后复用右键菜单逻辑
const handleMessageTouchStart = (message: IRCKitCachedMessage, e: TouchEvent) => {
  const { target, currentTarget } = e;
  longPressTouchStart(e, (point) => {
    handleMessageRightClick(message, createLongPressSyntheticEvent(point, target, currentTarget));
  });
};

const handleMenuItemClick = async (
  menuId: string,
  message: IRCKitCachedMessage,
  event: MouseEvent | CustomEvent,
) => {
  context.statistic(StatisticKey.CONVERSATION_MESSAGE_OPTION_CLICK);

  switch (menuId) {
    case RCKitMessageMenuID.EDIT:
      hideMsgMenu();
      await handleStartEdit(message);
      break;
    case RCKitMessageMenuID.COPY: { // 复制
      const text = (message as BaseMessage<ITextMessageContent | IReferenceMessageContent>).content.content || '';
      if (!navigator.clipboard || !text) {
        return;
      }
      navigator.clipboard.writeText(text);
      // 显示复制成功提示
      context.emit(new RCKitEvent(RCKitEvents.TOAST_EVENT, {
        message: context.i18n.format('toast.copy.success'),
        showIcon: true,
      }));
      break;
    }
    case RCKitMessageMenuID.DELETE:
      handleDeleteMessage([message]);
      break;
    case RCKitMessageMenuID.RECALL:
      handleRecallMessage([message]);
      break;
    case RCKitMessageMenuID.MULTI_CHOICE:
      // 开启多选模式，多选模式开启后支持逐条转发功能与删除功能
      multiChoiceMode.value = true;
      break;
    case RCKitMessageMenuID.REPLY:
      // 引用回复，在输入框最前部插入 @xxx
      selectReplyMessage(message);
      break;
    case RCKitMessageMenuID.REACTIONS:
      // 阻止全局 click 监听在面板打开后立即将其关闭
      event.stopPropagation();
      await handleReactionClick(message, event);
      break;
    case RCKitMessageMenuID.FORWARD: // 单条消息转发，直接派发事件，业务层可拦截处理
      forwarding(RCKitModalForwardingType.SINGLE, [message]);
      break;
    case RCKitMessageMenuID.SPEECH_TO_TEXT: // 转文字
      if (message.messageUId) {
        // 清除隐藏状态，设置显示
        delete sttHiddenMap.value[message.messageUId];
        // 先检查是否已经转换过（包括内容为空的情况）
        const hasConverted = context.speechToTextStore.hasConverted(message.messageUId);
        if (hasConverted) {
          // 已经转换过，直接设置为成功状态（即使内容为空）
          const cachedText = context.speechToTextStore.getSTTText(message.messageUId) || '';
          sttStatusMap.value[message.messageUId] = 'success';
          sttTextMap.value[message.messageUId] = cachedText;
        } else {
          // 没有缓存，设置状态为转换中，触发UI展示
          sttStatusMap.value[message.messageUId] = 'converting';
          await context.speechToTextStore.requestForMessage(message);
        }
      }
      break;
    case RCKitMessageMenuID.CANCEL_SPEECH_TO_TEXT: // 取消转文字
      if (message.messageUId) {
        // 设置隐藏状态，隐藏转换状态
        sttHiddenMap.value[message.messageUId] = true;
        delete sttStatusMap.value[message.messageUId];
        delete sttTextMap.value[message.messageUId];
      }
      break;
    default:
      // 业务自定义菜单
      context.emit(new RCKitEvent(RCKitEvents.MESSAGE_MENU_ITEM_CLICK, { id: menuId, message }));
      break;
  }
};

const hideMsgMenu = () => {
  updateMessageMenuPosition = undefined;
  messageMenuStyle.display = 'none';
  currentSelectMessage.value = undefined;
  msgMenu.value.splice(0, msgMenu.value.length);
};

// #region 表情回复面板
const reactionPanelRef = ref<HTMLElement>();
const reactionPanelStyle = reactive({ left: 0, top: 0, display: 'none' });
let updateReactionPanelPosition: (() => void) | undefined;
const reactionTargetMessage = ref<IRCKitCachedMessage>();
const reactionPanelMode = ref<'reaction' | 'edit'>('reaction');
const editorEmoji = ref<{ messageUId: string; value: string; sequence: number }>();
let editorEmojiSequence = 0;
watch([multiChoiceMode, isH5], () => {
  if (reactionPanelMode.value === 'edit' && (multiChoiceMode.value || isH5.value)) hideReactionPanel();
});

const calculateCenteredReactionPanelPosition = (panelWidth: number, panelHeight: number) => {
  if (!messageViewportRef.value) {
    return { left: 0, top: 0 };
  }
  return {
    left: Math.max(0, (messageViewportRef.value.clientWidth - panelWidth) / 2),
    top: Math.max(0, (messageViewportRef.value.clientHeight - panelHeight) / 2),
  };
};

const handleReactionClick = async (message: IRCKitCachedMessage, e: MouseEvent | CustomEvent, mode: 'reaction' | 'edit' = 'reaction') => {
  if (multiChoiceMode.value || !opened.value) return;
  const conversation = { ...opened.value };
  const lifecycleToken = messageListLifecycleToken;
  if (mode === 'edit' && !isVisibleEditor(message)) return;
  if (reactionPanelStyle.display !== 'none' && reactionPanelMode.value === mode
    && reactionTargetMessage.value?.messageUId === message.messageUId) { hideReactionPanel(); return; }
  const mouseEvent = getSourceMouseEvent(e);
  // 菜单会在面板渲染前关闭，因此需提前保存触发入口的位置。
  const anchorRect = (mouseEvent.target as HTMLElement | null)?.getBoundingClientRect();

  hideMsgMenu();
  handleCloseReadReceiptModal();

  reactionTargetMessage.value = message;
  reactionPanelMode.value = mode;
  reactionPanelStyle.display = 'block';
  await nextTick();
  if (!isCurrentMessageList(conversation, lifecycleToken)
    || reactionTargetMessage.value?.messageUId !== message.messageUId || reactionPanelMode.value !== mode) return;
  if (reactionPanelRef.value) {
    reactionPanelRef.value.scrollTop = 0;
  }
  if (!reactionPanelRef.value) {
    hideReactionPanel();
    return;
  }

  const panel = reactionPanelRef.value;
  updateReactionPanelPosition = () => {
    if (!isCurrentMessageList(conversation, lifecycleToken) || reactionPanelRef.value !== panel
      || reactionTargetMessage.value?.messageUId !== message.messageUId || reactionPanelMode.value !== mode) return;
    const panelPosition = isH5.value
      ? calculateCenteredReactionPanelPosition(panel.offsetWidth, panel.offsetHeight)
      : calculateActionPopupPosition(panel.offsetWidth, panel.offsetHeight, mouseEvent, bubbleStyleAlign(message), anchorRect);

    reactionPanelStyle.top = panelPosition.top;
    reactionPanelStyle.left = panelPosition.left;
  };
  updateReactionPanelPosition();
};

const hideReactionPanel = () => {
  updateReactionPanelPosition = undefined;
  reactionPanelStyle.display = 'none';
  reactionTargetMessage.value = undefined;
  reactionPanelMode.value = 'reaction';
};

const handleReactionEmojiClick = (emoji: string) => {
  const msg = reactionTargetMessage.value;
  if (!msg) return;
  if (reactionPanelMode.value === 'edit') {
    if (isVisibleEditor(msg)) editorEmoji.value = { messageUId: msg.messageUId, value: emoji, sequence: ++editorEmojiSequence };
    hideReactionPanel();
    return;
  }

  // 已经添加的情况下，点击为取消回应
  const reaction = msg.reactions.find(({ reactionId }) => reactionId === emoji);
  const isRemove: boolean = !!reaction && reaction.hasCurrentUserReacted;
  context.message.updateMessageReaction(msg, emoji, isRemove);
  hideReactionPanel();
};

// #endregion

// 监听菜单显示状态，控制滚动条
watch(() => messageMenuStyle.display, (newDisplay) => {
  if (newDisplay === 'block') {
    // 菜单显示时禁用滚动
    scrollControl.disableScroll();
  } else {
    // 菜单隐藏时恢复滚动
    scrollControl.enableScroll();
  }
});

const handleResendMessage = (message: IRCKitCachedMessage, event?: MouseEvent) => {
  if (message.sentStatus === SentStatus.FAILED) {
    hideMsgMenu();
    hideReactionPanel();
    handleCloseReadReceiptModal();
    context.message.resendMessage(message);
  } else if (
    message.conversationType === ConversationType.GROUP
    && (message.sentStatus === SentStatus.SENT || message.sentStatus === SentStatus.READ)
    && context.readReceiptVersion === GroupReadReceiptVersion.V5
  ) {
    showReadReceiptModalMessageUId.value = message.messageUId;
    // V5群聊点击查看已读未读列表（仅 v5 版本才处理）
    handleShowReadReceiptModal(message, event);
  }
};
// #endregion

// #region 已读未读弹窗
const showReadReceiptModal = ref<boolean>(false);
const showReadReceiptModalMessageUId = ref<string>('');
const readReceiptMessage = ref<IRCKitCachedMessage | null>(null);
const readUsers = ref<any[]>([]);
const unreadUsers = ref<any[]>([]);
const readPageToken = ref<string | undefined>(undefined);
const unreadPageToken = ref<string | undefined>(undefined);
const readHasMore = ref<boolean>(false);
const unreadHasMore = ref<boolean>(false);
const readLoading = ref<boolean>(false);
const unreadLoading = ref<boolean>(false);
const readReceiptPosition = reactive<IReadReceiptPosition>(
  calculateReadReceiptFallbackLayout(0, 0),
);
const readReceiptStatusElement = ref<HTMLElement | null>(null);

const findStatusElementInMessageItem = (messageItem: HTMLElement | null): HTMLElement | null => {
  if (!messageItem) {
    return null;
  }

  const statusElement = messageItem.querySelector('.rc-kit-msg-sent-status') as HTMLElement | null;
  if (statusElement) {
    return statusElement;
  }

  const innerStatusElement = messageItem.querySelector('.rc-kit-message-sent-status') as HTMLElement | null;
  if (innerStatusElement) {
    return innerStatusElement;
  }

  const messageBubble = messageItem.querySelector('rc-message-bubble') as HTMLElement | null;
  const shadowStatusElement = messageBubble?.shadowRoot?.querySelector('.rc-kit-msg-sent-status') as HTMLElement | null;
  if (shadowStatusElement) {
    return shadowStatusElement;
  }

  return messageBubble?.shadowRoot?.querySelector('.rc-kit-message-sent-status') as HTMLElement | null;
};

// 说明：readCount/unreadCount 直接使用 getMessagesReadReceiptUsersByPageV5 返回的 totalCount，
// 避免依赖 readReceiptMessage.kitReadReceiptInfo（该字段由 getMessageReadReceiptInfoV5 异步填充，
// 存在"弹窗打开时还没回来"的时机问题，且消息对象被 onMessageStateChange 深拷贝替换后，
// 旧引用上的 kitReadReceiptInfo 也无法再被更新到）。
const readCount = ref<number>(0);
const unreadCount = ref<number>(0);

// 更新弹窗位置
const updateReadReceiptPosition = (statusElement: HTMLElement | null) => {
  if (!messageListRef.value || !messageViewportRef.value) {
    return;
  }
  if (!statusElement) {
    // 如果元素不存在，尝试重新查找
    if (readReceiptMessage.value?.messageUId) {
      const messageItem = messageListRef.value?.querySelector(`.rc-kit-msg-list-item[data-message-uid="${readReceiptMessage.value.messageUId}"]`) as HTMLElement;
      if (messageItem) {
        const foundElement = findStatusElementInMessageItem(messageItem);
        if (foundElement) {
          readReceiptStatusElement.value = foundElement;
          statusElement = foundElement;
        } else {
          console.warn('[ReadReceipt] status element not found during update');
          return;
        }
      } else {
        console.warn('[ReadReceipt] message item not found during update');
        return;
      }
    } else {
      return;
    }
  }

  const rect = statusElement.getBoundingClientRect();
  const containerRect = messageViewportRef.value.getBoundingClientRect();
  Object.assign(readReceiptPosition, calculateReadReceiptLayout({
    viewportWidth: containerRect.width,
    viewportHeight: containerRect.height,
    statusTop: rect.top - containerRect.top,
    statusBottom: rect.bottom - containerRect.top,
    statusLeft: rect.left - containerRect.left,
    statusRight: rect.right - containerRect.left,
  }));
};

const handleShowReadReceiptModal = async (message: IRCKitCachedMessage, event?: MouseEvent) => {
  // 任何方式打开已读未读弹窗时，关闭消息菜单和表情回复面板
  hideMsgMenu();
  hideReactionPanel();

  if (!message.messageUId || message.conversationType !== ConversationType.GROUP) {
    console.log('[ReadReceipt] handleShowReadReceiptModal: invalid message', {
      messageUId: message.messageUId,
      conversationType: message.conversationType,
    });
    return;
  }

  readReceiptMessage.value = message;
  readUsers.value = [];
  unreadUsers.value = [];
  readPageToken.value = undefined;
  unreadPageToken.value = undefined;
  readHasMore.value = false;
  unreadHasMore.value = false;
  readCount.value = 0;
  unreadCount.value = 0;

  // 计算位置（基于点击事件或消息状态图标位置）
  await nextTick(); // 确保 DOM 已更新

  let statusElement: HTMLElement | null = null;

  if (event && event.target) {
    const target = event.target as HTMLElement;
    if (target && typeof target.closest === 'function') {
      statusElement = target.closest('.rc-kit-msg-sent-status')
                      || target.closest('.rc-kit-message-sent-status');
    }
    // 如果 closest 找不到，且 target 本身就是状态元素
    if (!statusElement && target) {
      if (target.classList.contains('rc-kit-msg-sent-status')
          || target.classList.contains('rc-kit-message-sent-status')) {
        statusElement = target;
      }
    }
  }

  // 如果通过事件没找到，通过消息列表查找
  if (!statusElement) {
    // 通过消息项的 data-message-uid 属性查找
    const messageItem = messageListRef.value?.querySelector(`.rc-kit-msg-list-item[data-message-uid="${message.messageUId}"]`) as HTMLElement;
    if (messageItem) {
      statusElement = findStatusElementInMessageItem(messageItem);
    }
  }

  if (statusElement) {
    readReceiptStatusElement.value = statusElement;
    updateReadReceiptPosition(statusElement);
  } else {
    console.warn('[ReadReceipt] status element not found, using default position');
    const viewportWidth = messageViewportRef.value?.clientWidth || 0;
    const viewportHeight = messageViewportRef.value?.clientHeight || 0;
    Object.assign(
      readReceiptPosition,
      calculateReadReceiptFallbackLayout(viewportWidth, viewportHeight),
    );
  }

  // 加载初始数据
  await Promise.all([
    loadReadUsers(message, true),
    loadUnreadUsers(message, true),
  ]);

  showReadReceiptModal.value = true;
};

const loadReadUsers = async (message: IRCKitCachedMessage, isFirst: boolean = false) => {
  if (readLoading.value) {
    return;
  }

  readLoading.value = true;
  try {
    const conversation = {
      conversationType: message.conversationType,
      targetId: message.targetId,
      channelId: message.channelId,
    };
    const requestedCount = 15;
    const { code, data } = await context.message.getMessagesReadReceiptUsersByPageV5(
      conversation,
      message.messageUId!,
      {
        pageToken: readPageToken.value,
        count: requestedCount,
        type: 'read',
      },
    );
    if (code === ErrorCode.SUCCESS && data) {
      readUsers.value.push(...(data.users || []));
      readPageToken.value = data.pageToken;
      // 分页接口的 totalCount 就是已读总人数，直接用于弹窗标题，避免依赖 kitReadReceiptInfo
      readCount.value = data.totalCount || 0;
      // 如果返回的列表长度小于请求的 count，说明没有更多数据了
      readHasMore.value = data.totalCount && data.totalCount > readUsers.value.length;
    } else {
      console.warn('[ReadReceipt] loadReadUsers: failed', { code, data });
    }
  } catch (e) {
    console.warn('[ReadReceipt] loadReadUsers error:', e);
  } finally {
    readLoading.value = false;
  }
};

const loadUnreadUsers = async (message: IRCKitCachedMessage, isFirst: boolean = false) => {
  if (unreadLoading.value) {
    return;
  }

  unreadLoading.value = true;
  try {
    const conversation = {
      conversationType: message.conversationType,
      targetId: message.targetId,
      channelId: message.channelId,
    };
    const requestedCount = 15;
    const { code, data } = await context.message.getMessagesReadReceiptUsersByPageV5(
      conversation,
      message.messageUId!,
      {
        pageToken: unreadPageToken.value,
        count: requestedCount,
        type: 'unread',
      },
    );

    if (code === ErrorCode.SUCCESS && data) {
      unreadUsers.value.push(...(data.users || []));
      unreadPageToken.value = data.pageToken;
      // 分页接口的 totalCount 就是未读总人数，直接用于弹窗标题，避免依赖 kitReadReceiptInfo
      unreadCount.value = data.totalCount || 0;
      // 如果返回的列表长度小于请求的 count，说明没有更多数据了
      unreadHasMore.value = data.totalCount && data.totalCount > unreadUsers.value.length;
    } else {
      console.warn('[ReadReceipt] loadUnreadUsers: failed', { code, data });
    }
  } catch (e) {
    console.warn('[ReadReceipt] loadUnreadUsers error:', e);
  } finally {
    unreadLoading.value = false;
  }
};

const handleReadReceiptScroll = async (listScrollInfo: { scrollTop: number, scrollHeight: number, clientHeight: number }, type: 'read' | 'unread') => {
  if (!readReceiptMessage.value) return;

  const scrollTop = listScrollInfo.scrollTop || 0;
  const scrollHeight = listScrollInfo.scrollHeight || 0;
  const clientHeight = listScrollInfo.clientHeight || 0;

  if (scrollHeight - scrollTop - clientHeight < 50) {
    if (type === 'read' && readHasMore.value && !readLoading.value) {
      await loadReadUsers(readReceiptMessage.value, false);
    } else if (type === 'unread' && unreadHasMore.value && !unreadLoading.value) {
      await loadUnreadUsers(readReceiptMessage.value, false);
    }
  }
};

// 包装函数，用于模板中的事件处理
const onReadReceiptScroll = (event: CustomEvent) => {
  // Vue 3 中，emit 的多个参数会被包装在 CustomEvent.detail 数组中
  const [listScrollInfo, type] = event.detail as [{ scrollTop: number, scrollHeight: number, clientHeight: number }, 'read' | 'unread'];
  handleReadReceiptScroll(listScrollInfo, type);
};

const handleCloseReadReceiptModal = () => {
  showReadReceiptModal.value = false;
  readReceiptMessage.value = null;
  readUsers.value = [];
  unreadUsers.value = [];
  readPageToken.value = undefined;
  unreadPageToken.value = undefined;
  readHasMore.value = false;
  unreadHasMore.value = false;
  readCount.value = 0;
  unreadCount.value = 0;
  readReceiptStatusElement.value = null;
};

// 点击外部关闭弹窗
const handleClickOutside = (e: MouseEvent) => {
  if (showReadReceiptModal.value) {
    const target = e.target as HTMLElement;
    if (!target.closest('.read-receipt-popover')) {
      handleCloseReadReceiptModal();
    }
  }
};
// #endregion

// #region 滚动逻辑
let paginationTimer: ReturnType<typeof setTimeout> | null = null;
let paginationTimerToken: number | null = null;
const cancelPaginationTimer = (lifecycleToken?: number) => {
  if (lifecycleToken !== undefined && paginationTimerToken !== lifecycleToken) {
    return;
  }
  if (paginationTimer !== null) {
    clearTimeout(paginationTimer);
    paginationTimer = null;
  }
  paginationTimerToken = null;
};
const ratioY = ref(1);
const sizeHeight = ref(0);
const moveY = ref(0);
const messageBoxRef = ref();
// 底部区域
const onBottomArea = ref<boolean>(true);
const STRICT_BOTTOM_THRESHOLD_PX = 2;
const BOTTOM_AREA_THRESHOLD_PX = 100;

// 滚动条显示控制
const showScrollbar = ref(false);
const isHoveringScrollbar = ref(false);
let scrollbarHideTimer: any = null;
let resizeUpdateFrame = 0;
let hasUserScrolledAwayFromBottom = false;
// Preserve bottom intent across image decoding and browser scroll anchoring.
// Only user scrolling or explicit history positioning should clear it.
let wasStrictlyAtBottomBeforeResize = true;
let scrollTouchY: number | null = null;

interface IMessageListMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  offsetHeight: number;
}

const readMessageListMetrics = (): IMessageListMetrics | null => {
  const el = messageListRef.value;
  if (!el) {
    return null;
  }

  const {
    scrollHeight, scrollTop, clientHeight, offsetHeight,
  } = el;
  return {
    scrollHeight, scrollTop, clientHeight, offsetHeight,
  };
};

const getDistanceFromBottom = (metrics: IMessageListMetrics): number => (
  metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop
);

const isNearMessageListBottom = (metrics: IMessageListMetrics, threshold = BOTTOM_AREA_THRESHOLD_PX): boolean => getDistanceFromBottom(metrics) <= threshold;

const isMessageListStrictlyAtBottom = (metrics: IMessageListMetrics): boolean => getDistanceFromBottom(metrics) <= STRICT_BOTTOM_THRESHOLD_PX;

const shouldFollowMessageListBottom = (): boolean => wasStrictlyAtBottomBeforeResize
  && !hasUserScrolledAwayFromBottom && !hasMoreBackward.value;

const wasMessageListStrictlyAtBottom = (): boolean => {
  const metrics = readMessageListMetrics();
  if (!metrics || hasMoreBackward.value) {
    return false;
  }
  return isMessageListStrictlyAtBottom(metrics);
};

const isMessageListInBottomArea = (metrics: IMessageListMetrics): boolean => isNearMessageListBottom(metrics, BOTTOM_AREA_THRESHOLD_PX);

const cancelAdjustMessageListScroll = () => {
  bottomScrollGuard.invalidate();
  bottomLayoutToken = null;
};

const stopFollowingMessageListBottom = () => {
  hasUserScrolledAwayFromBottom = true;
  wasStrictlyAtBottomBeforeResize = false;
  cancelResizeScrollAnchor();
};

const canScrollMessageListUp = (event: Event): boolean => {
  const el = messageListRef.value;
  // A textarea or another nested scroller can consume the gesture itself.
  // Include shadow-root descendants, stopping at the message list boundary.
  const targets = event.composedPath();
  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    if (target === el) return el.scrollTop > 0;
    if (target instanceof HTMLElement && target.scrollTop > 0
      && ['auto', 'scroll'].includes(window.getComputedStyle(target).overflowY)) return false;
  }
  return false;
};

const handleScrollTouchStart = (event: TouchEvent) => {
  if (scrollControl.isScrollDisabled) return;
  scrollTouchY = event.touches[0]?.clientY ?? null;
  cancelResizeScrollAnchor();
};

const handleScrollTouchMove = (event: TouchEvent) => {
  if (scrollControl.isScrollDisabled || scrollTouchY === null) return;
  const y = event.touches[0]?.clientY;
  if (y === undefined || Math.abs(y - scrollTouchY) < 1) return;
  // A downward finger movement scrolls towards older messages. A tap must
  // leave bottom intent intact, even if it cancelled a pending correction.
  if (y > scrollTouchY && canScrollMessageListUp(event)) {
    stopFollowingMessageListBottom();
  } else {
    cancelResizeScrollAnchor();
  }
  scrollTouchY = y;
};

const handleScrollTouchEnd = () => {
  scrollTouchY = null;
  if (!scrollControl.isScrollDisabled && shouldFollowMessageListBottom()) scheduleBottomResync();
};

const handleScrollWheel = (event: WheelEvent) => {
  if (scrollControl.isScrollDisabled || !event.deltaY) return;
  if (event.deltaY < 0 && canScrollMessageListUp(event)) {
    stopFollowingMessageListBottom();
  } else {
    cancelResizeScrollAnchor();
    if (shouldFollowMessageListBottom()) scheduleBottomResync();
  }
};

const handleScrollKeydown = (event: KeyboardEvent) => {
  if (scrollControl.isScrollDisabled || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!['ArrowUp', 'PageUp', 'Home'].includes(event.key) && !(event.key === ' ' && event.shiftKey)) return;
  // Composed paths also expose inputs inside the message editor's shadow root.
  if (event.composedPath().some((target) => target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)))) return;
  if (messageListRef.value?.scrollTop > 0) stopFollowingMessageListBottom();
};

const syncBottomStateFromMetrics = (metrics = readMessageListMetrics()) => {
  if (!metrics || bottomLayoutToken !== null || keepBottomDuringMultiChoiceChange) {
    return;
  }
  const isStrictlyAtBottom = !hasMoreBackward.value && isMessageListStrictlyAtBottom(metrics);
  onBottomArea.value = isMessageListInBottomArea(metrics);
  hasUserScrolledAwayFromBottom = !isStrictlyAtBottom;
  wasStrictlyAtBottomBeforeResize = isStrictlyAtBottom;
  if (!isStrictlyAtBottom) {
    cancelAdjustMessageListScroll();
  }
};

const handleScrollbarEnter = () => {
  isHoveringScrollbar.value = true;
  showScrollbar.value = true;
  if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
};

const handleScrollbarLeave = () => {
  isHoveringScrollbar.value = false;
  if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
  scrollbarHideTimer = setTimeout(() => {
    showScrollbar.value = false;
  }, 1000);
};

/**
 * 滚动逻辑细分：
 * 向上（在当前时间戳往前获取）: 取第一条消息时间戳请求历史消息，添加数据时设置滚动条位置保持数据不发生异常滑动
 * 向下（在当前时间戳往后获取）: 只有 RCKitCommand.FOCUS_ON_LATEST_MESSAGE 为 false 滚动的一定位置获取历史消息
 *
 * todo: 当渲染数据达到最大限制时需要进行裁切，涉及数据滚动位置，没有很好的方案。等做自定义滚动条组件时再考虑这部分逻辑
 */
const handleScroll = () => {
  // 如果滚动被禁用，不处理滚动事件
  if (scrollControl.isScrollDisabled) {
    return;
  }

  hideReactionPanel();
  handleCloseReadReceiptModal();

  showScrollbar.value = true;
  if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
  if (!isHoveringScrollbar.value) {
    scrollbarHideTimer = setTimeout(() => {
      showScrollbar.value = false;
    }, 1000);
  }

  if (!opened.value || messageList.value.length === 0) return;
  const conversation: IConversationIdentifier = {
    conversationType: opened.value.conversationType, targetId: opened.value.targetId, channelId: opened.value.channelId,
  };
  const lifecycleToken = messageListLifecycleToken;
  if (!isCurrentMessageList(conversation, lifecycleToken)) return;
  const metrics = readMessageListMetrics();
  if (!metrics) return;
  const { scrollHeight, scrollTop, clientHeight } = metrics;
  scheduleVirtualWindowUpdate();
  // 布局变化造成的浏览器自动滚动不代表用户离开底部，待布局稳定后再同步状态。
  if (bottomLayoutToken !== null || keepBottomDuringMultiChoiceChange) {
    syncScrollbarPosition(metrics);
    return;
  }
  // 设置滚动条距离底部多少显示定位组件（与 setScroll2bottom 一致使用 clientHeight，减轻 Safari 上与 offsetHeight 混用的亚像素差异）
  const isAtBottom = !hasMoreBackward.value && isMessageListStrictlyAtBottom(metrics);
  onBottomArea.value = isMessageListInBottomArea(metrics);
  if (isAtBottom) {
    hasUserScrolledAwayFromBottom = false;
    wasStrictlyAtBottomBeforeResize = true;
  } else if (shouldFollowMessageListBottom()) {
    // Safari may dispatch scroll before ResizeObserver after an image grows.
    // This does not indicate a user gesture, even if scrollTop was clamped up.
    scheduleBottomResync();
  }
  // 计算滑块滚动距离
  syncScrollbarPosition(metrics);

  // 在当前时间戳往前获取
  if (scrollTop <= 200 && paginationTimer === null) {
    if (!hasMoreForward) return;
    paginationTimerToken = lifecycleToken;
    paginationTimer = setTimeout(async () => {
      await moreForward(conversation, lifecycleToken);
    }, 1000);
  }

  // 在当前时间戳往后获取（滚动到底部时触发）
  if (
    hasMoreBackward.value
    && scrollHeight - scrollTop - clientHeight <= 200
    && paginationTimer === null
  ) {
    if (!hasMoreBackward.value) return;
    paginationTimerToken = lifecycleToken;
    paginationTimer = setTimeout(async () => {
      await moreBackward(conversation, lifecycleToken);
    }, 1000);
  }
};

const moreForward = async (conversation: IConversationIdentifier, lifecycleToken: number) => {
  const isCurrent = () => isCurrentMessageList(conversation, lifecycleToken);
  try {
    if (!isCurrent() || messageList.value.length === 0) return;
    resizeAnchorController.cancel();
    const anchor = captureScrollAnchor();
    const { hasMore, code, list } = await context.message.reqHistories(
      conversation,
      messageList.value[0].sentTime,
      true,
    );
    if (!isCurrent()) return;
    if (code === ErrorCode.SUCCESS) {
      messageList.value = [...list, ...messageList.value];
      hasMoreForward = hasMore;
      if (unreadCountTop.value) {
        const count = unreadCountTop.value - list.length;
        unreadCountTop.value = count < 0 ? 0 : count;
      }
      await refreshVirtualWindow();
      if (!isCurrent()) return;
      const metrics = syncScrollbarPosition();
      if (metrics && messageListRef.value) {
        restoreScrollAnchor(anchor);
      }
      // 重新计算滚动距离后再判断数据是否有超最大限制
      if (messageList.value.length > 300) {
        messageList.value.splice(300);
        await refreshVirtualWindow();
        if (!isCurrent()) return;
        syncScrollbarPosition();
        hasMoreBackward.value = true;
      }
      // 发送单群已读回执
      if (conversation.conversationType === ConversationType.GROUP && electronExtension.enable() && isCurrent()) {
        await context.message.sendReadReceiptMessage(conversation, list);
      }
    }
  } finally {
    cancelPaginationTimer(lifecycleToken);
  }
};

const moreBackward = async (conversation: IConversationIdentifier, lifecycleToken: number) => {
  const isCurrent = () => isCurrentMessageList(conversation, lifecycleToken);
  try {
    if (!isCurrent() || messageList.value.length === 0) return;
    resizeAnchorController.cancel();
    const anchor = captureScrollAnchor();
    const { hasMore, code, list } = await context.message.reqHistories(
      conversation,
      messageList.value[messageList.value.length - 1].sentTime,
      false,
    );
    if (!isCurrent()) return;
    if (code === 0) {
      messageList.value = [...messageList.value, ...list];
      hasMoreBackward.value = hasMore;

      // 如果会话还存在未读数
      if (unreadCountBottom.value && list.length > 0) {
        const msg = list[list.length - 1];
        if (electronExtension.enable() && isCurrent()) {
          // electron 平台按时间戳清理未读数
          await context.conversation.clearUnreadCountByTimestamp(conversation, msg.sentTime);
          if (!isCurrent()) return;
          await context.message.sendReadReceiptMessage(conversation, list);
        }
        if (!electronExtension.enable() && !hasMore && isCurrent()) {
          // Web 等拉取完所有消息才会清除未读数，时间戳没有作用
          await context.conversation.clearUnreadCountByTimestamp(conversation, msg.sentTime);
          if (!isCurrent()) return;
          await context.message.sendReadReceiptMessage(conversation, list);
        }
      }

      // 插入数据后等 Dom 渲染完成，重新更新滑块位置
      await refreshVirtualWindow();
      if (!isCurrent()) return;
      syncScrollbarPosition();
      // 当数据超过最大渲染时，进行数据裁切。
      if (messageList.value.length > 300) {
        messageList.value.splice(0, messageList.value.length - 300);
        await refreshVirtualWindow();
        if (!isCurrent()) return;
        syncScrollbarPosition();
        restoreScrollAnchor(anchor);
      }
    }
  } finally {
    cancelPaginationTimer(lifecycleToken);
  }
};

/**
 * 处理滚轮跳移动距离
 * @param e
 */
const handleMove = (e: CustomEvent) => {
  if (scrollControl.isScrollDisabled) {
    return;
  }
  const metrics = readMessageListMetrics();
  if (!messageListRef.value || !metrics) return;
  cancelResizeScrollAnchor();
  const thumbPositionPercentage = e.detail[0];
  messageListRef.value.scrollTop = (thumbPositionPercentage * metrics.scrollHeight) / 100;
  syncBottomStateFromMetrics();
  syncScrollbarPosition();
};

/**
 * 重置滑块高度和比率
 */
const update = (metrics = readMessageListMetrics()): IMessageListMetrics | null => {
  if (!metrics) return null;

  const { offsetHeight, scrollHeight } = metrics;
  const original = offsetHeight ** 2 / scrollHeight;
  const originalHeight = Math.floor(original * 100) / 100;

  // 滑块最小高度为 20
  const height = Math.max(originalHeight, 20);

  const ratio = originalHeight / (offsetHeight - originalHeight) / (height / (offsetHeight - height));
  ratioY.value = Math.floor(ratio * 100) / 100 || 1;
  sizeHeight.value = originalHeight < offsetHeight ? Math.floor(height) : 0;
  return metrics;
};

const syncScrollbarPosition = (metrics = readMessageListMetrics()): IMessageListMetrics | null => {
  const latestMetrics = update(metrics);
  if (!latestMetrics) {
    return null;
  }
  if (!sizeHeight.value || latestMetrics.scrollTop <= 0) {
    moveY.value = 0;
    return latestMetrics;
  }
  if (isNearMessageListBottom(latestMetrics, 2)) {
    moveY.value = ((latestMetrics.offsetHeight - sizeHeight.value) * 100) / sizeHeight.value;
    return latestMetrics;
  }
  moveY.value = ((latestMetrics.scrollTop * 100) / latestMetrics.offsetHeight) * ratioY.value || 0;
  return latestMetrics;
};

/**
 * 设置滚动条到底部
 */
const setScroll2bottom = async (scrollToken = beginBottomLayout()) => {
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => !!conversation && isCurrentMessageList(conversation, lifecycleToken)
    && bottomScrollGuard.isCurrent(scrollToken);
  try {
    resizeAnchorController.cancel();
    await refreshVirtualWindow();
    if (!isCurrent() || !messageListRef.value) {
      return;
    }
    const metrics = syncScrollbarPosition();
    if (!metrics) {
      return;
    }
    const { scrollHeight, clientHeight } = metrics;
    messageListRef.value.scrollTop = Math.max(scrollHeight - clientHeight, 0);
    recalculateVirtualWindow();
    await nextTick();
    if (!isCurrent()) return;
    scheduleVirtualMeasurement();
    syncScrollbarPosition();
    await settleMessageListToBottom(3, scrollToken);
  } finally {
    if (bottomLayoutToken === scrollToken) {
      bottomLayoutToken = null;
      if (isCurrent()) syncBottomStateFromMetrics();
    }
  }
};

// #endregion

// #region 定位组件
const handleLocation2Bottom = async () => {
  if (!opened.value) return;

  const conversation = {
    conversationType: opened.value.conversationType,
    targetId: opened.value.targetId,
    channelId: opened.value.channelId,
  };
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => isCurrentMessageList(conversation, lifecycleToken);
  if (!isCurrent()) return;
  resizeAnchorController.cancel();
  // 直接请求最新时间点的消息，其他数据抛弃
  const { code, list, hasMore } = await context.message.reqHistories(conversation, 0, true);
  if (!isCurrent()) return;
  if (code === ErrorCode.SUCCESS) {
    messageList.value = list;
    hasMoreForward = hasMore;
    hasMoreBackward.value = false;
    // 滚动到底部
    await refreshVirtualWindow();
    if (!isCurrent()) return;
    const metrics = syncScrollbarPosition();
    if (metrics && messageListRef.value) {
      const { scrollHeight, offsetHeight } = metrics;
      messageListRef.value.scrollTop = scrollHeight - offsetHeight;
      recalculateVirtualWindow();
      await nextTick();
      if (!isCurrent()) return;
      scheduleVirtualMeasurement();
      syncBottomStateFromMetrics();
      syncScrollbarPosition();
      await settleMessageListToBottom();
    }
    if (!isCurrent() || !list.length) return;
    const firstSentTime = list[0].sentTime;
    // 清除会话未读数
    await context.conversation.clearUnreadCountByTimestamp(conversation, list[list.length - 1].sentTime);
    if (!isCurrent()) return;
    // Electron 平台 starMsgUid 需要取第一条未读消息
    if (electronExtension.enable()) {
      const { data } = await getFirstUnreadMessage(conversation);
      if (!isCurrent()) return;
      if (data && data.sentTime > firstSentTime) {
        list.unshift(createRCKitCacheMessage(data));
      }
    }
    await context.message.sendReadReceiptMessage(conversation, list);
  }
};

const handleLocation2Top = async () => {
  if (!opened.value) return;
  const conversation = {
    conversationType: opened.value.conversationType,
    channelId: opened.value.channelId,
    targetId: opened.value.targetId,
  };
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => isCurrentMessageList(conversation, lifecycleToken);
  const timestamp = backupFirstUnreadMessageTime;
  if (!isCurrent()) return;
  stopFollowingMessageListBottom();
  unreadCountTop.value = 0;
  hasMoreBackward.value = true;
  await refreshVirtualWindow();
  if (!isCurrent()) return;
  syncScrollbarPosition();
  // 拉取未读消息时间戳前后消息
  const list = await handleReqHistories(conversation, timestamp, true, isCurrent);
  if (!isCurrent() || !list.length) return;
  await context.message.sendReadReceiptMessage(conversation, list);
};
// #endregion

// #region 多选组件
const DOMSelect = ref();

const stopMultiChoiceScrollWatch = watch(multiChoiceMode, async () => {
  // 必须同步读取切换前的 DOM；默认 pre watcher 执行时，父组件可能已替换底部工具栏。
  const shouldKeepBottom = keepBottomDuringMultiChoiceChange || wasMessageListStrictlyAtBottom();
  cancelMultiChoiceScroll();
  if (!shouldKeepBottom) {
    nextTick(() => scheduleVirtualMeasurement());
    return;
  }

  const token = multiChoiceScrollGuard.capture();
  keepBottomDuringMultiChoiceChange = true;
  resizeAnchorController.cancel();
  cancelAdjustMessageListScroll();

  try {
    await nextTick();
    if (!multiChoiceScrollGuard.isCurrent(token) || !messageListRef.value) {
      return;
    }
    // 工具栏切换会改变可视区域高度，先确保列表尾部参与实际测量。
    renderVirtualWindowAroundIndex(messageRenderList.value.length - 1);
    let previousMetrics: IMessageListMetrics | null = null;
    let stableFrames = 0;
    while (stableFrames < 2) {
      await nextTick();
      await waitForNextFrame();
      if (!multiChoiceScrollGuard.isCurrent(token) || !messageListRef.value) {
        return;
      }
      measureVirtualRows();
      // 等待行高缓存引起的虚拟占位 DOM 更新，不能使用更新前的 scrollHeight 判定贴底。
      await nextTick();
      if (!multiChoiceScrollGuard.isCurrent(token) || !messageListRef.value) {
        return;
      }
      const el = messageListRef.value;
      el.scrollTop = Math.max(el.scrollHeight - el.clientHeight, 0);
      recalculateVirtualWindow();
      await nextTick();
      if (!multiChoiceScrollGuard.isCurrent(token)) {
        return;
      }
      const metrics = readMessageListMetrics();
      if (!metrics) {
        return;
      }
      // 输入框恢复显示和虚拟窗口更新可能分帧完成，尺寸连续稳定且仍贴底后才结束。
      const isStable = previousMetrics
        && previousMetrics.clientHeight === metrics.clientHeight
        && previousMetrics.scrollHeight === metrics.scrollHeight
        && isMessageListStrictlyAtBottom(metrics);
      stableFrames = isStable ? stableFrames + 1 : 0;
      previousMetrics = metrics;
    }
  } finally {
    if (multiChoiceScrollGuard.isCurrent(token)) {
      cancelMultiChoiceScroll();
      syncScrollbarPosition();
      syncBottomStateFromMetrics();
    }
  }
}, { flush: 'sync' });

// 先记录模式切换前的滚动位置，再通知父容器切换输入框和工具栏。
watch(multiChoiceMode, (active) => {
  if (active) {
    hoveredMessageUId.value = '';
    longPressTouchCancel();
    hideMsgMenu();
    hideReactionPanel();
    handleCloseReadReceiptModal();
    context.audioPlayer.pause();
  }
  emit('selection-change', active, selectedMessages.value);
}, { flush: 'sync' });
watch(selectedMessages, (messages) => {
  emit('selection-change', multiChoiceMode.value, messages);
});

/**
 * checked 全选，从最新消息开始判断 y 坐标以及加上本身内容高度是否大于选择器y坐标
 */
const handleSelectMessages = () => {
  if (!messageViewportRef.value || !messageListRef.value || !DOMSelect.value) {
    return;
  }
  const messageListRect = messageListRef.value.getBoundingClientRect();
  const selectedY = DOMSelect.value.getBoundingClientRect().top - messageListRect.top;
  const messageBoxStyle = messageBoxRef.value ? window.getComputedStyle(messageBoxRef.value) : null;
  const paddingTop = messageBoxStyle ? Number.parseFloat(messageBoxStyle.paddingTop) || 0 : 0;
  const selectedContentY = messageListRef.value.scrollTop + selectedY - paddingTop;
  const shouldSelect = selected.value;

  for (let i = messageRenderList.value.length - 1; i >= 0; i -= 1) {
    const topY = getHeightBeforeIndex(i);
    if (topY <= selectedContentY) {
      break;
    }

    const item = messageRenderList.value[i];
    if (
      typeof item === 'string'
      || item.sentStatus === 10
      || isGreyMessage(item.messageType)
    ) {
      continue;
    }

    setMessageCheckedStatus(item, shouldSelect);
  }
  selected.value = !selected.value;
};

const setMessageCheckedStatus = (message: IRCKitCachedMessage, checked: boolean) => {
  const value = message.messageUId || `${message.transactionId}`;
  if (checked) {
    const index = selectedMessageUids.value.findIndex((item) => value === item);
    if (index === -1) {
      selectedMessageUids.value.unshift(value);
    }
  } else {
    const index = selectedMessageUids.value.findIndex((item) => value === item);
    if (index >= 0) {
      selectedMessageUids.value.splice(index, 1);
    }
  }
};

// #endregion

const onDeleteMessages = async (e: MessagesDeletedEvent) => {
  e.data.forEach((item) => {
    const { target, recallMsg } = item;
    if (!opened.value || !isSameConversation(target, opened.value)) return;
    // 删除和撤回都立即取消选择，包括已离开当前加载窗口的消息。
    selectedMessageUids.value = selectedMessageUids.value.filter((id) => (
      id !== target.messageUId && (!hasValidTransactionId(target) || id !== `${target.transactionId}`)
    ));
    // 被删除的消息可能为已发送消息，或发送失败消息，不能仅根据 messageUId 进行匹配，优先判断 transactionId
    const index = messageList.value.findIndex((message) => isSameMessage(message, target));
    if (index === -1) {
      return;
    }
    if (recallMsg) {
      // 撤回消息替换 UI 数据。
      messageList.value.splice(index, 1, recallMsg);
    } else {
      messageList.value.splice(index, 1);
    }
  });
  // 删除/撤回可能命中非最新消息；此时会话列表不一定发出变更事件，
  // 仍需同步清除消息列表本地持有的可见编辑标识。
  syncActiveEdit();
  await refreshVirtualWindow();
  syncScrollbarPosition();
};

const onFileUploadProgress = (e: FileUploadProgressEvent) => {
  const { message } = e.data;
  const index = findLastIndex(messageList.value, (item) => item.transactionId === message.transactionId);
  if (index === -1) return;
  messageList.value.splice(index, 1, { ...message });
};

const isMessageListAtBottom = () => wasMessageListStrictlyAtBottom();

const onMessageStateChange = (e: MessageStateChangeEvent) => {
  const conversation: IRCKitCachedConversation | null = opened.value;
  if (!conversation) {
    return;
  }
  handleEditBeforeResize();
  syncActiveEdit();
  const shouldStickToBottom = isMessageListAtBottom();
  let hasMessageUpdated = false;

  e.data.forEach((message) => {
    if (isSameConversation(conversation, message)) {
      const index = findLastIndex(messageList.value, (item) => isSameMessage(item, message));
      if (index === -1) return;

      const oldTime = messageList.value[index].sentTime;
      // 说明：这里必须用 splice 触发数组级响应式变更，因为派发过来的 message 对象与 messageList[index]
      // 的 proxy 底层是同一原对象，直接字段赋值会被 Vue 的 hasChanged 判定"同值"而跳过 trigger，
      // 导致发送状态（sentStatus）等变更无法反映到 UI。
      // 另外，依赖 :key 的稳定（见 getRenderItemKey），即便 splice 用的是 JSON 深拷贝出来的新对象，
      // Vue diff 也会复用原 DOM 节点，不会销毁 <rc-gif-message> 内部的 <img>，因此不会引发媒体类消息白屏闪烁。
      const updatedMessage = JSON.parse(JSON.stringify(message));

      // 如果发送时间改变（常见于重发成功），将消息从原位置移除并插入到正确的位置
      if (message.sentTime !== oldTime) {
        messageList.value.splice(index, 1);
        const insertIndex = findLastIndex(messageList.value, (item) => item.sentTime <= message.sentTime);
        messageList.value.splice(insertIndex + 1, 0, updatedMessage);
      } else {
        messageList.value.splice(index, 1, updatedMessage);
      }
      hasMessageUpdated = true;
    }
  });

  if (shouldStickToBottom && hasMessageUpdated) {
    onBottomArea.value = true;
    scheduleBottomResync();
  }
};

// 处理文本消息中邮箱和链接点击
const handleLinkClick = (data: CustomEvent) => {
  context.emit(new RCKitEvent(RCKitEvents.MESSAGE_LINK_CLICK, data.detail[0]));
};

/**
 * 处理收到新消息
 * @param RecvNewMessagesEvent
 */
const onRecvNewMessages = async (e: RecvNewMessagesEvent) => {
  if (!opened.value) return;
  const conversation = {
    conversationType: opened.value.conversationType,
    targetId: opened.value.targetId,
    channelId: opened.value.channelId,
  };
  const msgList: IRCKitCachedMessage[] = [];
  e.data.forEach(async (item) => {
    if (!isSameConversation(conversation, item)) {
      return;
    }
    // 防止消息重复，对应场景：创建群组。原因是获取了历史消息，同时收到了该消息
    const index = messageList.value.findIndex((msg) => isSameMessage(msg, item));
    if (index < 0) {
      msgList.push(item);
    } else {
      messageList.value = mergeMessagesByUniqueKey(messageList.value, [item]);
    }
  });

  if (!msgList.length) return;

  // Keep receiving while a previous image is growing, unless the user left
  // the bottom. Being merely within the bottom area must not force a scroll.
  if (!shouldFollowMessageListBottom() && !wasMessageListStrictlyAtBottom()) {
    hasMoreBackward.value = true;
    return;
  }
  messageList.value = mergeMessagesByUniqueKey(messageList.value, msgList);

  await setScroll2bottom();
  const { length } = msgList;
  // 清除会话未读数以及发送消息回执
  // 因为会话有定时 20ms 后更新会话，会出现多端未读数同步时机会早于会话更新时机，导致会话未读数一直累加
  setTimeout(async () => {
    const { code } = await context.conversation.clearUnreadCountByTimestamp(conversation, msgList[length - 1].sentTime);
    if (code === ErrorCode.SUCCESS) {
      await context.message.sendReadReceiptMessage(conversation, msgList);
    }
  }, 100);
};

/**
 * 处理发送消息
 * @param e
 */
const onInsertNewMessages = async (e: InsertNewMessagesEvent) => {
  const conversation: IRCKitCachedConversation | null = opened.value;
  if (!conversation) {
    return;
  }
  // 还有历史消息直接请求最新时间点的消息，其他数据抛弃
  if (hasMoreBackward.value) {
    const { code, list, hasMore } = await context.message.reqHistories({
      conversationType: conversation.conversationType,
      targetId: conversation.targetId,
      channelId: conversation.channelId,
    }, 0, true);
    // 异步请求，结果返回后二次校验会话数据
    if (code === ErrorCode.SUCCESS && opened.value && isSameConversation(conversation, opened.value)) {
      messageList.value.length = 0;
      messageList.value = mergeMessagesByUniqueKey(list);
      hasMoreForward = hasMore;
      hasMoreBackward.value = false;
      // 添加数据后，滚到底部
      await setScroll2bottom();
    }
    return;
  }
  e.data.forEach(async (item) => {
    if (isSameConversation(conversation, item)) {
      messageList.value = mergeMessagesByUniqueKey(messageList.value, [item]);
      if (messageList.value.length > 300) {
        messageList.value.splice(0, messageList.value.length - 300);
      }
      // 添加数据后，滚到底部
      await setScroll2bottom();
    }
  });
};

/**
 *  切换会话
 * @param e
 */
const onSelectedChanged = (e: ConversationSelectedEvent) => {
  editSwitchGeneration += 1;
  syncActiveEdit();
  exitMultiChoiceMode();
  cancelMultiChoiceScroll();
  cancelAdjustMessageListScroll();
  resetVirtualWindow();
  hasMoreForward = true;
  hasMoreBackward.value = false;
  onBottomArea.value = true;
  hasUserScrolledAwayFromBottom = false;
  wasStrictlyAtBottomBeforeResize = true;
  scrollTouchY = null;
  unreadCountTop.value = 0;
  initMessageList();
};

// 监听容器高度变化，更新滑块
const useResizeObserver = (el: HTMLElement, callback: ConstructorParameters<typeof ResizeObserver>[0]) => {
  let observer: ResizeObserver | null = null;
  if (window && 'ResizeObserver' in window && el) {
    observer = new ResizeObserver(callback);
    observer.observe(el);
  }
  return observer;
};

/**
 * 多选模式下，在捕获阶段阻断消息个体的鼠标与触摸交互
 */
const stopEventWhenMultiChoiceMode = (evt: Event) => {
  if (multiChoiceMode.value) {
    if (evt.type === 'touchstart') {
      cancelResizeScrollAnchor();
    }
    if (evt.type === 'click' || evt.type === 'contextmenu') {
      evt.preventDefault();
    }
    evt.stopImmediatePropagation();
  }
};

const scheduleResizeUpdate = () => {
  if (resizeUpdateFrame) {
    return;
  }
  const el = messageListRef.value;
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  const isCurrent = () => !!el && messageListRef.value === el && !!conversation
    && isCurrentMessageList(conversation, lifecycleToken);
  resizeUpdateFrame = requestAnimationFrame(() => {
    resizeUpdateFrame = 0;
    if (!isCurrent()) return;
    const widthChanged = invalidateVirtualHeightsForWidthChange();
    if (!widthChanged) {
      recalculateVirtualWindow();
    }
    const metrics = syncScrollbarPosition();
    if (!metrics) {
      return;
    }
    if (widthChanged) {
      nextTick(() => {
        if (isCurrent()) scheduleVirtualMeasurement();
      });
    }
  });
};

const handleResizeRef = () => {
  scheduleResizeUpdate();
  // 输入框最终高度可能晚于模式切换完成，跟随可视区域的实际尺寸变化继续贴底。
  if (shouldFollowMessageListBottom()) {
    scheduleBottomResync();
  }
};

const scheduleBottomResync = () => {
  const el = messageListRef.value;
  const conversation = opened.value;
  const lifecycleToken = messageListLifecycleToken;
  if (!el || !conversation || !isCurrentMessageList(conversation, lifecycleToken)
    || !shouldFollowMessageListBottom() || bottomLayoutToken !== null || keepBottomDuringMultiChoiceChange) {
    return;
  }
  const scrollToken = beginBottomLayout();
  nextTick(async () => {
    if (!bottomScrollGuard.isCurrent(scrollToken)) return;
    if (messageListRef.value !== el || !isCurrentMessageList(conversation, lifecycleToken)
      || !shouldFollowMessageListBottom()) {
      cancelAdjustMessageListScroll();
      return;
    }
    await settleMessageListToBottom(3, scrollToken);
  });
};

const handleAdjustMessageListScroll = () => {
  scheduleBottomResync();
};

const handleMessageBoxResize = () => {
  scheduleVirtualMeasurement();
  // 只有变化前真正贴底，内容高度变化后才继续保持底部；底部区域内慢滚不强制吸底。
  if (shouldFollowMessageListBottom()) {
    scheduleBottomResync();
  } else {
    scheduleResizeUpdate();
  }
};

// v-if recreates these elements when a conversation is closed and reopened.
watch(messageListRef, (el, previous, onCleanup) => {
  if (!el) return;
  const observer = useResizeObserver(el, handleResizeRef);
  onCleanup(() => observer?.disconnect());
}, { flush: 'post' });
watch(messageBoxRef, (el, previous, onCleanup) => {
  if (!el) return;
  const observer = useResizeObserver(el, handleMessageBoxResize);
  onCleanup(() => observer?.disconnect());
}, { flush: 'post' });
watch(messageMenuRef, (el, previous, onCleanup) => {
  if (!el) return;
  // Custom-element menu items and their icons can finish layout after nextTick.
  const observer = useResizeObserver(el, () => updateMessageMenuPosition?.());
  if (messageViewportRef.value) observer?.observe(messageViewportRef.value);
  onCleanup(() => observer?.disconnect());
}, { flush: 'post' });
watch(reactionPanelRef, (el, previous, onCleanup) => {
  if (!el) return;
  const observer = useResizeObserver(el, () => updateReactionPanelPosition?.());
  if (messageViewportRef.value) observer?.observe(messageViewportRef.value);
  onCleanup(() => observer?.disconnect());
}, { flush: 'post' });

const handleWindowResize = () => {
  hideMsgMenu();
  hideReactionPanel();
  handleCloseReadReceiptModal();
};

onMounted(async () => {
  // 全局监听关闭
  window.addEventListener('click', hideMsgMenu);
  window.addEventListener('click', hideReactionPanel);
  window.addEventListener('click', handleClickOutside);
  checkDevice();
  syncActiveEdit();
  window.addEventListener('resize', checkDevice);
  window.addEventListener('resize', scheduleResizeUpdate);
  window.addEventListener('resize', handleWindowResize);
  context.addEventListener(RCKitEvents.CONVERSATION_SELECTED, onSelectedChanged);
  context.addEventListener(InnerEvent.DESTROY_USER_CACHE, onDestroyUserCache);
  context.addEventListener(InnerEvent.RECV_NEW_MESSAGES, onRecvNewMessages);
  context.addEventListener(InnerEvent.INSERT_NEW_MESSAGES, onInsertNewMessages);
  context.addEventListener(RCKitEvents.MESSAGES_DELETED, onDeleteMessages);
  context.addEventListener(InnerEvent.MESSAGE_STATE_CHANGE, onMessageStateChange);
  context.addEventListener(InnerEvent.FILE_UPLOAD_PROGRESS, onFileUploadProgress);
  context.addEventListener(InnerEvent.ADJUST_MESSAGE_LIST_SCROLL, handleAdjustMessageListScroll);
  initMessageList();
  messageBubbleCfg.value = context.bubble.messageBubbleCfg;
});

onBeforeUnmount(() => {
  messageListLifecycleGuard.invalidate();
  cancelAdjustMessageListScroll();
  messageListLifecycleToken = 0;
  cancelPaginationTimer();
  stopMultiChoiceScrollWatch();
  cancelMultiChoiceScroll();
  exitMultiChoiceMode();
});

onUnmounted(() => {
  cancelMultiChoiceScroll();
  // 清理滚动禁用事件监听
  scrollControl.enableScroll();
  if (scrollbarHideTimer) clearTimeout(scrollbarHideTimer);
  if (resizeUpdateFrame) cancelAnimationFrame(resizeUpdateFrame);
  if (virtualWindowFrame) cancelAnimationFrame(virtualWindowFrame);
  if (virtualMeasureFrame) cancelAnimationFrame(virtualMeasureFrame);
  context.removeEventListener(RCKitEvents.CONVERSATION_SELECTED, onSelectedChanged);
  context.removeEventListener(InnerEvent.DESTROY_USER_CACHE, onDestroyUserCache);
  context.removeEventListener(InnerEvent.RECV_NEW_MESSAGES, onRecvNewMessages);
  context.removeEventListener(InnerEvent.INSERT_NEW_MESSAGES, onInsertNewMessages);
  context.removeEventListener(RCKitEvents.MESSAGES_DELETED, onDeleteMessages);
  context.removeEventListener(InnerEvent.MESSAGE_STATE_CHANGE, onMessageStateChange);
  context.removeEventListener(InnerEvent.FILE_UPLOAD_PROGRESS, onFileUploadProgress);
  context.removeEventListener(InnerEvent.ADJUST_MESSAGE_LIST_SCROLL, handleAdjustMessageListScroll);
  window.removeEventListener('click', hideMsgMenu);
  window.removeEventListener('click', hideReactionPanel);
  window.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', checkDevice);
  window.removeEventListener('resize', scheduleResizeUpdate);
  window.removeEventListener('resize', handleWindowResize);
});
</script>

<style>
p {
  margin: 0;
}
ul,li {
  padding: 0;
  margin: 0;
  list-style: none;
}
.rc-kit-msg-list {
  position: relative;
  overflow: hidden;
  height: 100%;
  box-sizing: border-box;
}

.rc-kit-msg-list-scroll {
  overflow-y: scroll;
  overflow-x: hidden;
  overflow-anchor: none;
  height: 100%;
  scrollbar-width: none;
  box-sizing: border-box;
}

.rc-kit-msg-list-scroll::-webkit-scrollbar {
  display: none;
}

.rc-kit-msg-list-item {
  display: flex;
  flex: 1;
  min-width: 0;
}

.rc-kit-grey-message {
  flex: 1;
  text-align: center;
}

.rc-kit-msg-avatar {
  padding: 0 8px;
  flex-shrink: 0;
}

.rc-kit-msg-bubble-wrapper {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 70%;
  align-items: flex-start;
}

.rc-kit-msg-bubble-wrapper-right {
  align-items: flex-end;
}

/* Resolve file content percentages against the row, independently of upload controls. */
.rc-kit-msg-bubble-wrapper-file {
  width: 70%;
}

.rc-kit-msg-bubble-wrapper-edit {
  flex: 1 1 90%;
  width: 90%;
  min-width: 0;
  max-width: 90%;
}

.rc-kit-msg-bubble {
  border-radius: 8px 0 8px;
  font-size: 12px;
  line-height: 16px;
  overflow: visible;
  min-width: 0;
  max-width: 100%;
}

.rc-kit-msg-bubble-file {
  width: max-content;
}

/* 媒体消息：图片/GIF/视频自身按气泡可用宽度收缩，这里兜底保证不撑破消息行。 */
.rc-kit-msg-bubble-media {
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 768px) {
  .rc-kit-msg-list-item,
  .rc-kit-grey-message {
    user-select: none;
    -webkit-user-select: none;
    /* iOS 长按的链接/图片系统预览（callout）会抢占自定义菜单，触摸小屏下禁用（可继承，覆盖气泡 shadow 内容） */
    -webkit-touch-callout: none;
  }
}

/* 语音转文字状态样式 */
.rc-kit-stt-status {
  padding: 9px;
  font-size: 14px;
  line-height: 18px;
  word-break: break-word;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  border-radius: 8px;
  background: #E3E7EF;
}

.rc-kit-stt-status-right {
  align-items: flex-end;
  border-radius: 8px;
}

.rc-kit-stt-converting {
  display: flex;
  align-items: center;
}

.rc-kit-stt-loading {
  display: block;
  font-size: 0;
  color: #000;
  width: 54px;
}

.rc-kit-stt-loading .rc-kit-stt-loading-dot {
  display: inline-block;
  float: none;
  background-color: currentColor;
  border: 0 solid currentColor;
  width: 6px;
  height: 6px;
  margin: 4px;
  border-radius: 100%;
  animation: ball-pulse 1s ease infinite;
}

.rc-kit-stt-loading .rc-kit-stt-loading-dot:nth-child(1) {
  animation-delay: -200ms;
}

.rc-kit-stt-loading .rc-kit-stt-loading-dot:nth-child(2) {
  animation-delay: -100ms;
}

.rc-kit-stt-loading .rc-kit-stt-loading-dot:nth-child(3) {
  animation-delay: 0ms;
}

@keyframes ball-pulse {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.rc-kit-stt-error {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rc-kit-stt-error-text {
  color: #1D2129;
}

.rc-kit-stt-success {
  color: #333333;
  min-height: 18px;
  line-height: 18px;
  white-space: pre-wrap;
  display: block;
}

.rc-message-list-menu {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  /* padding: 5px; */
  background-color: #fff;
  border-radius: 9px;
  box-shadow: 0px 5px 16px 0px #00000014;
  min-width: 95px;
}

.rc-message-list-menu-mask {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
}

.rc-kit-msg-list-box {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.rc-kit-msg-list-box:last-child {
  margin-bottom: 0;
}

.rc-kit-msg-list-box[data-virtual-is-last="true"] {
  margin-bottom: 0;
}

.rc-kit-msg-list-box.rc-kit-msg-list-box-edit {
  box-sizing: border-box;
  width: calc(100% + 20px);
  margin: 0 -10px 10px;
  padding: 20px 10px;
  background: #E8F0FE;
}

.rc-kit-msg-list-spacer {
  flex: 0 0 auto;
  width: 100%;
  pointer-events: none;
}

.rc-kit-time-section {
  width: 100%;
}

.rc-kit-msg-list-box .checkbox {
  flex: 0 0 18px;
  margin-right: 7px;
  align-self: flex-start;
}

.rc-kit-msg-list-box .checkbox input[type="checkbox"] {
  display: none;
}

.rc-kit-msg-list-box .checkbox .custom {
  display: flex;
  width: 16px;
  height: 16px;
  border: 1px solid #ABB8CB;
  border-radius: 50%;
  background-color: #FFFFFF;
  font-size: 0;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.rc-kit-msg-list-box .checkbox input[type="checkbox"]:checked+.custom {
  background-color: #16D258;
  border-color: #16D258;
}

.rc-kit-select {
  position: absolute;
  top: 150px;
  left: 0px;
  width: 100%;
  box-sizing: border-box;
  z-index: 1;
}

.rc-kit-edit-status-anchor { width: 0; align-self: flex-start; margin-top: 4px; }
.rc-kit-edit-feedback { position: relative; width: max-content; }
.rc-kit-edit-status {
  display: flex;
  align-items: center;
  gap: 4px;
  width: max-content;
  white-space: nowrap;
  margin: 0;
  padding: 0;
  border: 0;
  color: #0047FF;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  line-height: 20px;
  text-align: start;
}
.rc-kit-edit-status img { display: block; flex: 0 0 12px; width: 12px; height: 12px; }
.rc-kit-edit-status.edit-retry { color: #FF5A50; }
.edit-retry { cursor: pointer; }
.edit-retry:focus-visible { outline: 2px solid #0047FF; outline-offset: 2px; }
.rc-kit-edit-status:disabled { cursor: default; opacity: .5; }
.edit-spinner { animation: edit-spin 1s linear infinite; }
@keyframes edit-spin { to { transform: rotate(360deg); } }
.rc-reaction-panel {
  position: absolute;
  z-index: 3;
  width: 100%;
  max-width: 376px;
  min-width: 0;
  height: 196px;
  max-height: 100%;
  box-sizing: border-box;
}
.rc-reaction-panel > rc-character-emoji-panel-provider {
  display: block;
  width: 100%;
  min-width: 0;
  height: 100%;
}
</style>
