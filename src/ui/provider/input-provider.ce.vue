<template>
  <div class="rc-input-provider">
    <!-- emoji 面板 -->
    <rc-emoji-panel-provider v-if="showEmoji" class="rc-input-emoji-panel"
      @insert-chat="handleInsertChatEmoji($event)" @send-image="handleSendImageEmoji($event)" />
    <!-- @ 人员列表 -->
    <rc-at-users-panel-provider @at-user="handleAtUser" @at-all="handleAtAllWrapper" v-show="showAtList" :atAll="atAll"
      :members="selectedGroupMembers" style="width: 100%; box-sizing: border-box;" />

    <!-- 顶部按钮栏 -->
    <div class="rc-input-top-buttons">
      <img
        class="rc-input-menu-button"
        v-for="item in allTopButtons"
        :key="item.id"
        :src="getButtonIcon(item)"
        :alt="item.label"
        @mouseenter="hoveredButtonId = item.id"
        @mouseleave="hoveredButtonId = null"
        @click.stop="handleMenuClick(item, $event)">
    </div>

    <!-- 输入框容器（包裹输入框、发送按钮和引用消息） -->
    <div class="rc-input-wrapper" ref="main">
      <!-- 引用消息条 -->
      <component :is="replyPreviewBarTag" class="replay-bar" v-if="replyBarProps"
        :username="replyBarProps.username"
        :message="replyBarProps.message"
        :preview-text="replyBarProps.previewText"
        :thumbnail="replyBarProps.thumbnail"
        :cancel="replyBarProps.cancel">
      ></component>

      <!-- 输入框和发送按钮容器 -->
      <div class="rc-input-inner-wrapper">
        <!-- 输入框 -->
        <div class="input-text-container" ref="inputContainer">
          <textarea ref="textarea" class="textarea" :placeholder="isH5 ? '' : placeholder"
            id="textarea"
            name="textarea"
            :enterkeyhint="isH5 ? 'send' : undefined"
            @keyup="onKeyUp" @keydown="handleKeyDown"
            @focus="handleTextareaFocus" @blur="handleTextareaBlur"
            @input="handleInputWrapper($event as InputEvent)"></textarea>
          <!-- 用于动态计算调整 textarea 宽高 -->
          <div ref="hiddenDom" contenteditable class="hidden-dom"></div>
        </div>

        <!-- 发送按钮 -->
        <button
          class="rc-input-send-button"
          :class="{ 'disabled': !hasContent }"
          :disabled="!hasContent"
          @click="handleSendClick">
          <img :src="hasContent ? INPUT_ICON_SEND_ACTIVE_ICON : INPUT_ICON_SEND_ICON" alt="send" />
          <span v-if="!isH5">{{ $t('input.send').value }}</span>
        </button>
      </div>
      <!-- 二级菜单 -->
      <div class="secondary-menu" ref="secondarDOM" v-show="secondaryVisible" @click.stop>
        <div v-for="item in secondaryMenu" :key="item.id" class="secondary-menu-item" @click="handleMenuClick(item, $event)">
            <img :src="item.icon" alt="Icon"><span>{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onBeforeUnmount, ref, watch, nextTick,
} from 'vue';
import { RCKitCommand } from '@lib/enums/RCKitCommand';
import {
  ConversationSelectedEvent, RCKitEvents, InnerEvent, SetTextareaValueEvent, MessagesDeletedEvent, MessageStateChangeEvent,
} from '@lib/core/EventDefined';
import { StatisticKey } from '@lib/modules/Statistic';
import { isMobileDevice, isSameConversation } from '@lib/helper';
import { getSuccessfulEditTimestamp } from '@lib/modules/message-editing';
import { RCKitEvent } from '../../core/RCKitEvent';
import { IRCKitCachedConversation } from '../../modules/conversation/IRCKitCachedConversation';
import { IRCKitInputMenuItem, RCKitInputMenuID } from '../../modules/InputModule';
import { $t } from '../i18n-vue';
import {
  ctx, replyMessage, replyBarProps, selectedGroupMembers, textarea, openedConversation,
  getOverrideAbleComponentTag,
} from './context';
import {
  IRCKitReplyPreviewBarComponentProps, OverrideAbleComponentTagInner,
} from '../override-able';
import { IRCKitLanguageEntries } from '../../languages';
import {
  hidePrompt, pickFiles, showAtList, showEmoji, insertChatEmoji, sendImageEmoji,
  onKeyDown, handleEnterOnKeyDown, onKeyUp, onPaste, handleInput, handleAtAll, addMentionedUser, clearMentionedInfo,
  resetTextareaValue, resizeTextarea, sendText, secondaryVisible, adjustMessageListScroll,
} from './input-helper';
import { INPUT_ICON_SEND_ICON, INPUT_ICON_SEND_ACTIVE_ICON } from '../../assets';

const context = ctx();
const replyPreviewBarTag = getOverrideAbleComponentTag(OverrideAbleComponentTagInner.ReplyPreviewBarComponent);

// at all 功能开关
const atAll = context.store.getCommandSwitch(RCKitCommand.AT_ALL);

const props = defineProps<{
  conversation: IRCKitCachedConversation;
}>();

const isH5 = ref(false);

// 跟踪当前悬停的按钮 ID
const hoveredButtonId = ref<string | null>(null);

const checkDevice = () => {
  isH5.value = isMobileDevice();
};

const placeholder = $t('input.placeholder');

// 用于追踪输入内容的响应式变量
const inputValue = ref('');

/** 二级菜单 DOM */
const secondarDOM = ref();
/** 主容器 DOM */
const main = ref();
const inputContainer = ref();
const hiddenDom = ref();

/** 当前显示的二级菜单项 */
const secondaryMenu = ref<Array<IRCKitInputMenuItem & { label: string }>>([]);
/** 当前触发二级菜单的按钮元素，用于定位二级菜单 */
const currentMenuButton = ref<HTMLElement | null>(null);
/** 当前处于打开态的顶部按钮 ID，用于面板互斥切换 */
const activePanelButtonId = ref<string | null>(null);

const filter = (item: IRCKitInputMenuItem) => !item.filter || item.filter(props.conversation);
const mapHandle = (item: IRCKitInputMenuItem) => ({ ...item, label: $t(item.id as keyof IRCKitLanguageEntries).value });

const menuList = computed<Array<IRCKitInputMenuItem & { label: string }>>(
  () => context.input.menuList.filter(filter).map(mapHandle),
);

// 合并所有顶部按钮（表情、图片、文件、拍照），排除PLUS按钮
const allTopButtons = computed(() => {
  const buttons: Array<IRCKitInputMenuItem & { label: string }> = [];

  // 添加二级菜单中的按钮（图片、文件、拍照），排除PLUS
  buttons.push(...menuList.value);

  // 按order排序
  return buttons.sort((a, b) => (a.order || 0) - (b.order || 0));
});

// 根据悬停状态获取按钮图标
const getButtonIcon = (item: IRCKitInputMenuItem) => {
  if (hoveredButtonId.value === item.id && item.hoverIcon) {
    return item.hoverIcon;
  }
  return item.icon;
};

// 判断输入框是否有内容
const hasContent = computed(() => inputValue.value.trim().length > 0);

const getTextareaEventData = () => ({
  value: textarea.value?.value || '',
});

const emitTextareaChange = () => {
  context.emit(new RCKitEvent(RCKitEvents.INPUT_TEXTAREA_CHANGE, getTextareaEventData()), 2);
};

const syncInputValueAndDispatchChange = () => {
  const value = textarea.value?.value || '';
  if (inputValue.value === value) {
    return;
  }
  inputValue.value = value;
  emitTextareaChange();
};

const handleTextareaFocus = () => {
  context.emit(new RCKitEvent(RCKitEvents.INPUT_TEXTAREA_FOCUS, getTextareaEventData()), 2);
};

const handleTextareaBlur = () => {
  context.emit(new RCKitEvent(RCKitEvents.INPUT_TEXTAREA_BLUR, getTextareaEventData()), 2);
};

const closeAllPanels = () => {
  hidePrompt();
  secondaryMenu.value = [];
  currentMenuButton.value = null;
  activePanelButtonId.value = null;
};

const toggleEmojiPanel = (item: IRCKitInputMenuItem) => {
  const shouldCloseCurrentPanel = showEmoji.value && activePanelButtonId.value === item.id;
  closeAllPanels();
  if (shouldCloseCurrentPanel) {
    return;
  }
  showEmoji.value = true;
  activePanelButtonId.value = item.id;
};

const toggleSecondaryMenu = (
  item: IRCKitInputMenuItem,
  triggerButton: HTMLElement,
  menus: Array<IRCKitInputMenuItem & { label: string }>,
) => {
  const isSameMenuOpen = secondaryVisible.value
    && activePanelButtonId.value === item.id
    && currentMenuButton.value === triggerButton;

  closeAllPanels();
  if (isSameMenuOpen || menus.length === 0) {
    return;
  }

  secondaryMenu.value = menus;
  currentMenuButton.value = triggerButton;
  activePanelButtonId.value = item.id;
  showSecondaryMenu();
};

const handleMenuClick = (item: IRCKitInputMenuItem, event: MouseEvent) => {
  // 如果点击的是二级菜单项，直接执行操作
  const isSecondaryMenuItem = secondaryMenu.value.some((menuItem) => menuItem.id === item.id);

  if (isSecondaryMenuItem) {
    closeAllPanels();
    executeMenuItemAction(item, event);
    return;
  }

  if (item.id === RCKitInputMenuID.EMOJI) {
    event.stopPropagation();
    ctx().statistic(StatisticKey.INPUT_EMOJI_ENTRY_CLICK);
    toggleEmojiPanel(item);
    return;
  }

  // 如果菜单项有二级菜单，显示二级菜单
  if (item.submenu && item.submenu.length > 0) {
    event.stopPropagation();
    const filteredSubmenu = item.submenu.filter(filter).map(mapHandle);
    toggleSecondaryMenu(item, event.currentTarget as HTMLElement, filteredSubmenu);
    return;
  }

  // 没有二级菜单，直接执行操作
  closeAllPanels();
  executeMenuItemAction(item, event);
};

const executeMenuItemAction = (item: IRCKitInputMenuItem, event: MouseEvent) => {
  const { id } = item;
  switch (id) {
    case RCKitInputMenuID.PHOTO:
      context.emit(new RCKitEvent(RCKitEvents.TAKE_PHOTO_MODAL_EVENT));
      return;
    case RCKitInputMenuID.EMOJI:
      event.stopPropagation();
      ctx().statistic(StatisticKey.INPUT_EMOJI_ENTRY_CLICK);
      closeAllPanels();
      showEmoji.value = true;
      return;
    case RCKitInputMenuID.IMAGES:
      pickFiles('image/jpg, image/png, image/jpeg, image/gif', (files) => context.message.sendFiles(props.conversation, files));
      return;
    case RCKitInputMenuID.FILES:
      pickFiles('*/*', (files) => context.message.sendFiles(props.conversation, files));
      return;
    default:
      // 业务自定义事件
      context.emit(new RCKitEvent(RCKitEvents.INPUT_MENU_ITEM_CLICK, { id, conversation: props.conversation }), 2);
  }
};

const showSecondaryMenu = () => {
  if (!secondarDOM.value || !currentMenuButton.value) {
    return;
  }

  // 先显示菜单以获取实际高度
  secondaryVisible.value = true;

  // 使用 nextTick 确保 DOM 已更新
  setTimeout(() => {
    if (!secondarDOM.value || !currentMenuButton.value || !main.value) {
      return;
    }

    const buttonRect = currentMenuButton.value.getBoundingClientRect();
    const wrapperRect = main.value.getBoundingClientRect();
    const menuElement = secondarDOM.value as HTMLElement;

    // 计算二级菜单位置：在按钮上方显示（因为输入框在底部）
    const buttonTop = buttonRect.top - wrapperRect.top;
    // 设置二级菜单位置：显示在按钮上方
    menuElement.style.bottom = `${wrapperRect.height - buttonTop + 8}px`;
    menuElement.style.left = `${buttonRect.left - wrapperRect.left}px`;
    menuElement.style.right = 'auto';
  }, 0);
};

const handleInsertChatEmoji = (evt: CustomEvent) => {
  insertChatEmoji(evt, textarea.value);
  closeAllPanels();
  syncInputValueAndDispatchChange();
};

const handleSendImageEmoji = (evt: CustomEvent) => {
  sendImageEmoji(evt, props.conversation);
  closeAllPanels();
};

// 处理输入事件包装函数
const handleInputWrapper = (event: InputEvent) => {
  handleInput(textarea.value, hiddenDom.value, inputContainer.value, event);
  syncInputValueAndDispatchChange();
};

// 包装发送消息函数，发送后同步更新 inputValue
const sendMessageWrapper = () => {
  if (!textarea.value) {
    return;
  }

  // 保存发送前的值，用于判断是否真的发送了消息
  const beforeValue = textarea.value.value;

  // 调用发送消息函数（会清空textarea.value）
  sendText(textarea.value, hiddenDom.value, inputContainer.value, main.value);

  // 如果消息已发送（textarea 被清空），同步更新 inputValue
  if (textarea.value.value === '' && beforeValue.trim().length > 0) {
    syncInputValueAndDispatchChange();
  }
};

// 处理发送按钮点击
const handleSendClick = () => {
  if (!hasContent.value || !textarea.value) {
    return;
  }

  sendMessageWrapper();
};

// 统一在 keydown 中处理按键行为：
// 1. 复用 input-helper 中已有的 Shift 状态维护和面板收起逻辑
// 2. 在 keydown 阶段处理 Enter 发送，规避 Safari 对 keypress 触发不稳定的问题
const handleKeyDown = (e: KeyboardEvent) => {
  // 保存发送前的值，用于判断是否真的发送了消息
  const beforeValue = textarea.value?.value || '';

  onKeyDown(e);
  handleEnterOnKeyDown(e, hiddenDom.value, inputContainer.value, main.value);

  // 如果是 Enter 键且没有按 Shift（即可能发送了消息），检查并更新 inputValue
  if (e.key === 'Enter' && !e.shiftKey) {
    nextTick(() => {
      // 如果 textarea 被清空且之前有内容，说明消息已发送，更新 inputValue
      if (textarea.value && textarea.value.value === '' && beforeValue.trim().length > 0) {
        syncInputValueAndDispatchChange();
      }
    });
  }
};

const handleAtUser = (evt: CustomEvent) => {
  const [userId] = evt.detail;
  addMentionedUser(userId, textarea.value);
  syncInputValueAndDispatchChange();
};

const handleAtAllWrapper = () => {
  handleAtAll(textarea.value);
  syncInputValueAndDispatchChange();
};

const handleConversationOpen = async (evt: ConversationSelectedEvent) => {
  const conversation = evt.data?.conversation;
  const focusInput = evt.data?.focusInput;
  const draft = conversation?.draft || '';
  // 选中回话发生变更，清理输入框既有内容
  replyMessage.value = null;
  closeAllPanels();
  clearMentionedInfo();
  resetTextareaValue(textarea.value, hiddenDom.value, inputContainer.value, main.value, draft);
  syncInputValueAndDispatchChange();
  if (conversation && focusInput !== false) {
    textarea.value.focus();
  } else if (textarea.value) {
    textarea.value.blur();
  }
};

const setTextareaValue = (e: SetTextareaValueEvent) => {
  if (!e.data) return;
  textarea.value.focus();
  const { length } = textarea.value.value;
  textarea.value.setRangeText(e.data, length, length, 'end');
  syncInputValueAndDispatchChange();
  resizeTextarea(textarea.value, hiddenDom.value, inputContainer.value);
};

// 监听回复消息变更
watch(replyMessage, (val, oldVal) => {
  // 同一回复目标的内容更新不应重复插入 @、抢占焦点或调整滚动位置。
  if (val && oldVal && val.messageUId && val.messageUId === oldVal.messageUId && isSameConversation(val, oldVal)) return;
  // reply 消息变更，保留输入框信息和 MentionedInfo。只有切换会话和发送消息成功清空
  // clearMentionedInfo();
  // resetTextareaValue(textarea.value, hiddenDom.value, inputContainer.value, main.value);
  // 重新添加 @ 信息
  if (val && context.store.getCommandSwitch(RCKitCommand.PROMPT_SENDER_WHEN_QUOTE_MESSAGE)) {
    addMentionedUser(val.senderUserId, textarea.value, true);
  }

  // 点击回复时自动聚焦输入框
  if (val && textarea.value) {
    textarea.value.focus();
  }

  // 当引用消息变化时（添加或移除），调整消息列表滚动位置
  // 使用 nextTick 确保 DOM 已更新（引用消息条的显示/隐藏）
  nextTick(() => {
    adjustMessageListScroll();
  });
});

const handleWindowClick = (event: MouseEvent) => {
  // 如果点击的是二级菜单或菜单按钮，不关闭
  const target = event.target as HTMLElement;
  if (secondarDOM.value && secondarDOM.value.contains(target)) {
    return;
  }
  if (currentMenuButton.value && currentMenuButton.value.contains(target)) {
    return;
  }
  closeAllPanels();
};

// 处理窗口大小改变，重新计算 textarea 高度
const handleWindowResize = () => {
  checkDevice();
  // 窗口大小改变时，重新计算 textarea 高度以适应新的宽度（自动换行可能改变行数）
  if (textarea.value && hiddenDom.value && inputContainer.value && main.value) {
    resizeTextarea(textarea.value, hiddenDom.value, inputContainer.value);
  }
};

const handleMessagesDeleted = (evt: MessagesDeletedEvent) => {
  if (!replyMessage.value) return;
  const unavailableMessage = evt.data.find((data) => data.target.messageUId === replyMessage.value?.messageUId);
  if (!unavailableMessage) return;

  replyMessage.value = null;
  context.alert(unavailableMessage.recallMsg ? 'alert.message-recalled' : 'alert.message-deleted');
};

const handleMessageStateChange = (evt: MessageStateChangeEvent) => {
  const target = replyMessage.value;
  if (!target?.messageUId) return;
  const targetTimestamp = getSuccessfulEditTimestamp(target) || 0;
  const updated = evt.data.find((message) => {
    const timestamp = getSuccessfulEditTimestamp(message);
    return message.messageUId === target.messageUId && isSameConversation(message, target)
      && timestamp !== undefined && timestamp >= targetTimestamp;
  });
  // 替换快照以触发预览更新；消息缓存可能已在响应式代理之外修改了原对象。
  if (updated) replyMessage.value = { ...updated };
};

onMounted(() => {
  checkDevice();
  // 全局监听关闭
  window.addEventListener('click', handleWindowClick);
  window.addEventListener('resize', handleWindowResize);
  textarea.value.addEventListener('paste', onPaste);
  const draft = openedConversation.value?.draft || '';
  // 重挂载恢复草稿必须走 resetTextareaValue，按内容行数重算输入框高度，否则多行草稿会被压回单行高度
  resetTextareaValue(textarea.value, hiddenDom.value, inputContainer.value, main.value, draft);
  syncInputValueAndDispatchChange();
  context.addEventListener(RCKitEvents.CONVERSATION_SELECTED, handleConversationOpen);
  context.addEventListener(InnerEvent.SET_TEXTAREA_VALUE_EVENT, setTextareaValue);
  context.addEventListener(RCKitEvents.MESSAGES_DELETED, handleMessagesDeleted);
  context.addEventListener(InnerEvent.MESSAGE_STATE_CHANGE, handleMessageStateChange);
});
onBeforeUnmount(() => {
  // 全局移除监听
  window.removeEventListener('click', handleWindowClick);
  window.removeEventListener('resize', handleWindowResize);
  textarea.value.removeEventListener('paste', onPaste);
  context.removeEventListener(RCKitEvents.CONVERSATION_SELECTED, handleConversationOpen);
  context.removeEventListener(InnerEvent.SET_TEXTAREA_VALUE_EVENT, setTextareaValue);
  context.removeEventListener(RCKitEvents.MESSAGES_DELETED, handleMessagesDeleted);
  context.removeEventListener(InnerEvent.MESSAGE_STATE_CHANGE, handleMessageStateChange);
});
</script>

<style>
.rc-input-provider {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  padding: 0 12px;
  box-sizing: border-box;
}

.rc-input-emoji-panel,
.rc-input-at-prompt {
  float: left;
  width: 100%;
  max-height: 248px;
  border-bottom: 1px solid #efefef;
  border-top: 1px solid #efefef;
}

/* 顶部按钮栏 */
.rc-input-top-buttons {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  box-sizing: border-box;
}

.rc-input-menu-button {
  width: 30px;
  height: 30px;
  cursor: pointer;
  flex-shrink: 0;
}

/* 输入框外层容器（包裹输入框、发送按钮和引用消息） */
.rc-input-wrapper {
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #E4E7ED;
  border-radius: 20px;
  margin: 0 0 12px 0;
  box-sizing: border-box;
  background-color: #fff;
  position: relative;
}

/* 输入框和发送按钮内部容器 */
.rc-input-inner-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 8px;
  gap: 8px;
  box-sizing: border-box;
}

.input-text-container {
  background: none;
  flex: 1;
  min-width: 0;
  font-size: 14px;
  overflow: hidden;
  line-height: 21px;
  min-height: 21px;
  border: none;
  border-radius: 0;
  margin: 4px 0 0;
  padding: 9px 10px;
  overflow-y: hidden;
  box-sizing: border-box;
}

.textarea {
  display: block;
  border: none;
  outline: none;
  background: none;
  min-height: 21px;
  height: 21px;
  max-height: calc(21px * 4 + 6px);
  box-sizing: border-box;
  padding: 0;
  width: 100%;
  resize: none;
  word-wrap: break-word;
  font-size: 14px;
  line-height: 21px;
  overflow-y: hidden;
  margin: 0;
}

/* 优化 textarea 滚动条样式 */
.textarea::-webkit-scrollbar {
  width: 4px;
}

.textarea::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.textarea::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  transition: background 0.2s;
}

.textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Firefox 滚动条样式 */
.textarea {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.hidden-dom {
  border: none;
  outline: none;
  background: none;
  line-height: 21px;
  min-height: 21px;
  height: 21px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0;
  width: 100%;
  resize: none;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: transparent;
  position: absolute;
  visibility: hidden;
}

/* 发送按钮 */
.rc-input-send-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 16px;
  border: none;
  border-radius: 30px;
  background-color: #ECF1FF;
  color: #0047FF;
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
  min-width: 60px;
  height: 28px;
  box-sizing: border-box;
  transition: background-color 0.2s, color 0.2s;
  margin: 8px 0;
}

.rc-input-send-button:hover:not(.disabled) {
  background-color: #D0DDFF;
}

.rc-input-send-button.disabled {
  background-color: #F3F5FA;
  color: #CCCCCC;
  cursor: not-allowed;
  border-radius: 30px;
}

.rc-input-send-button img {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.replay-bar {
  width: 100%;
  padding: 8px 8px 0 8px;
  box-sizing: border-box;
}

.secondary-menu {
  position: absolute;
  min-width: 126px;
  background-color: #fff;
  border-radius: 9px;
  box-shadow: 0 0 4px 0 rgba(0, 0, 0, 0.1);
  padding: 8px 4px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  font-size: 14px;
  color: #606060;
  z-index: 1000;
}

.secondary-menu-item {
  flex-direction: row;
  height: 36px;
  width: 100%;
  box-sizing: border-box;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 5px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.secondary-menu-item:hover {
  background-color: #D2E1FE;
}

.secondary-menu-item img {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  flex-shrink: 0;
}

.secondary-menu-item span {
  white-space: nowrap;
}

/* H5 自适应 */
@media (max-width: 768px) {
  .rc-input-provider {
    padding: 0 8px;
  }

  .rc-input-top-buttons {
    padding: 8px 0;
    gap: 6px;
  }

  .rc-input-menu-button {
    width: 28px;
    height: 28px;
  }

  .rc-input-wrapper {
    margin: 0 0 8px 0;
    border-radius: 20px;
  }

  .rc-input-inner-wrapper {
    padding: 6px;
    gap: 6px;
  }

  .rc-input-send-button {
    min-width: 50px;
    font-size: 12px;
  }

  .rc-input-send-button span {
    display: none; /* H5隐藏文字，只显示图标 */
  }
}
</style>
