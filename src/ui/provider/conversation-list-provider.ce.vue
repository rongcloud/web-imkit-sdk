<template>
  <rc-scrollbar-provider v-if="conversationList.length > 0" ref="scrollbar" @loading="handleScrollLoading" @scroll="handleConversationScroll">
    <div class="rc-conversation-wrap" ref="conversationWrapRef">
      <div v-if="isH5 && conversationMenuStyle.display === 'block'" class="rc-conversation-list-menu-mask" @click="handleHide({ button: 0 })"></div>
      <div class="rc-conversation-list-menu" ref="conversationMenuRef"
        :style="{ top: `${conversationMenuStyle.top}px`, left: `${conversationMenuStyle.left}px`, display: conversationMenuStyle.display }">
        <rc-conversation-list-menu-item
          v-for="item in menu"
          :icon="item.icon"
          :id="item.id"
          :label="item.label"
          @click="handleMenuItemClick(item.id, item.target)"
          ></rc-conversation-list-menu-item>
      </div>

      <div class="rc-conversation-list" :style="{ height: `${totalConversationListHeight}px` }">
        <div
          v-if="topSpacerHeight"
          class="rc-conversation-list-spacer"
          :style="{ height: `${topSpacerHeight}px` }"
        ></div>
        <rc-conversation-list-item v-for="item in virtualConversationList"
          :message="getConversationMessageDigest(item.latestMessage)"
          :time="handleTimeFilter(item.updateTime)"
          :key="item.key"
          :conversation="item"
          :draft="isDraft(item)"
          :statusEnable="handleShowSentStatus(item.latestMessage)"
          :name="handleUserProfile(item.latestMessage)"
          :selected="opened ? isSameConversation(item, opened): false"
          :rightClicked="rightClickedConversationKey === item.key"
              @contextmenu.prevent.native="handleConversationRightClick(item, $event)"
              @touchstart.passive="handleConversationTouchStart(item, $event)"
              @touchmove.passive="longPressTouchMove"
              @touchend="longPressTouchEnd"
              @touchcancel.passive="longPressTouchCancel"
              @menu-click="handleConversationRightClick(item, $event.detail[0])"
          @click="handleConversationClick(item, $event)"
          ></rc-conversation-list-item>
        <div
          v-if="bottomSpacerHeight"
          class="rc-conversation-list-spacer"
          :style="{ height: `${bottomSpacerHeight}px` }"
        ></div>

          <template v-if="loading">
            <rc-conversation-loading></rc-conversation-loading>
          </template>
      </div>
    </div>
  </rc-scrollbar-provider>
  <rc-conversation-list-empty v-else :desc="emptyDesc"></rc-conversation-list-empty>
</template>

<script setup lang="ts">
import {
  computed, onMounted, ref, reactive, onUnmounted, nextTick, watch,
} from 'vue';
import { ConversationType, ErrorCode, MessageType } from '@rongcloud/engine';
import { RCKitEvents } from '@lib/core/EventDefined';
import { StatisticKey } from '@lib/modules/Statistic';
import { InnerErrorCode } from '@lib/enums/RCKitCode';
import {
  ctx, conversationList, openedConversation as opened, handleShowSentStatus, textarea, getMessageDigest,
  conversationListHasMore as loading, loadMoreConversations as handleScrollLoading,
} from './context';
import { IRCKitCachedConversation } from '../../modules/conversation/IRCKitCachedConversation';
import { $tt, $t } from '../i18n-vue';
import {
  createLongPressSyntheticEvent, longPressTouchCancel, longPressTouchEnd, longPressTouchMove, longPressTouchStart,
} from '../long-press';
import { RCKitEvent } from '../../core/RCKitEvent';
import { isSameConversation, formatTime, isMobileDevice } from '../../helper';
import { IRCKitLanguageEntries } from '../../languages';
import { IRCKitCachedMessage } from '../../modules/MessageDataModule';

const context = ctx();

const getConversationMessageDigest = (message: IRCKitCachedMessage | null): string => {
  const digest = getMessageDigest(message);
  if (!message || message.messageType !== MessageType.FILE) {
    return digest;
  }
  return `${digest}${(message.content as { name?: string }).name ?? ''}`;
};

const conversationMenuRef = ref();
const conversationWrapRef = ref<any>(null);
const isH5 = ref(false);
const scrollbar = ref<any>(null);
const rightClickedConversationKey = ref<string | null>(null);

// Must match the item component's 78 px height plus its 6 px top margin.
const CONVERSATION_ITEM_HEIGHT = 84;
const CONVERSATION_LOADING_HEIGHT = 30;
const CONVERSATION_OVERSCAN = 6;
const DEFAULT_CONVERSATION_VIEWPORT_HEIGHT = 727;
const virtualStartIndex = ref(0);
const virtualEndIndex = ref(0);
let conversationScrollTop = 0;
let conversationViewportHeight = DEFAULT_CONVERSATION_VIEWPORT_HEIGHT;
let virtualWindowFrame: number | null = null;

const conversationMenuStyle = reactive({
  left: 0,
  top: 0,
  display: 'none',
});

const menu = ref<{ id: string, icon: string, label: string, target: string }[]>([]);
const weeklist: Array<keyof IRCKitLanguageEntries> = [
  'time.format.sunday',
  'time.format.monday',
  'time.format.tueday',
  'time.format.wedday',
  'time.format.thurday',
  'time.format.friday',
  'time.format.satday',
];
const emptyDesc = $t('conversation.list.empty.desc');

const totalConversationListHeight = computed(() => {
  if (!conversationList.value.length) {
    return 0;
  }
  return conversationList.value.length * CONVERSATION_ITEM_HEIGHT + (loading.value ? CONVERSATION_LOADING_HEIGHT : 0);
});
const topSpacerHeight = computed(() => (virtualStartIndex.value > 0
  ? virtualStartIndex.value * CONVERSATION_ITEM_HEIGHT
  : 0));
const bottomSpacerHeight = computed(() => Math.max(conversationList.value.length - virtualEndIndex.value, 0) * CONVERSATION_ITEM_HEIGHT);
const virtualConversationList = computed(() => conversationList.value.slice(virtualStartIndex.value, virtualEndIndex.value));

const updateVirtualConversationWindow = () => {
  const total = conversationList.value.length;
  if (!total) {
    virtualStartIndex.value = 0;
    virtualEndIndex.value = 0;
    return;
  }

  const viewportHeight = conversationViewportHeight || DEFAULT_CONVERSATION_VIEWPORT_HEIGHT;
  const visibleStart = Math.floor(conversationScrollTop / CONVERSATION_ITEM_HEIGHT);
  const visibleCount = Math.ceil(viewportHeight / CONVERSATION_ITEM_HEIGHT);
  const start = Math.max(visibleStart - CONVERSATION_OVERSCAN, 0);
  const end = Math.min(visibleStart + visibleCount + CONVERSATION_OVERSCAN, total);

  virtualStartIndex.value = start;
  virtualEndIndex.value = Math.max(end, start + 1);
};

const scheduleVirtualConversationWindowUpdate = () => {
  if (virtualWindowFrame !== null) {
    cancelAnimationFrame(virtualWindowFrame);
  }
  virtualWindowFrame = requestAnimationFrame(() => {
    virtualWindowFrame = null;
    updateVirtualConversationWindow();
  });
};

const syncConversationViewportMetrics = () => {
  const position = scrollbar.value?.getScrollPosition?.();
  const size = scrollbar.value?.getViewportSize?.();
  conversationScrollTop = position?.top || 0;
  conversationViewportHeight = size?.height || DEFAULT_CONVERSATION_VIEWPORT_HEIGHT;
};

const getConversationScrollMetrics = (eventOrMetrics: CustomEvent | { scrollTop?: number, clientHeight?: number }) => {
  const detail = (eventOrMetrics as CustomEvent)?.detail;
  const metrics = Array.isArray(detail) ? detail[0] : detail || eventOrMetrics;
  if (!metrics || typeof metrics.scrollTop !== 'number') {
    return null;
  }
  return metrics as { scrollTop: number, clientHeight?: number };
};

const handleConversationScroll = (eventOrMetrics: CustomEvent | { scrollTop?: number, clientHeight?: number }) => {
  const metrics = getConversationScrollMetrics(eventOrMetrics);
  if (!metrics) {
    return;
  }
  conversationScrollTop = metrics.scrollTop || 0;
  conversationViewportHeight = metrics.clientHeight || DEFAULT_CONVERSATION_VIEWPORT_HEIGHT;
  scheduleVirtualConversationWindowUpdate();
};

const refreshVirtualConversationWindow = () => {
  syncConversationViewportMetrics();
  updateVirtualConversationWindow();
};

// 共享数据由 context 更新，组件只在 DOM 更新后重算可视窗口。
watch([() => conversationList.value.slice(), loading], refreshVirtualConversationWindow, { flush: 'post' });

// 监听菜单显示状态，控制滚动条
watch(() => conversationMenuStyle.display, (newDisplay) => {
  if (newDisplay === 'block') {
    // 菜单显示时禁用滚动
    scrollbar.value?.disableScroll?.();
  } else {
    // 菜单隐藏时恢复滚动
    scrollbar.value?.enableScroll?.();
  }
});

/**
 * 控制时间格式转化
 * @param updateTime
 */
const handleTimeFilter = (updateTime: number): string => {
  const {
    year, month, day, hour, minute, weekDay,
  } = formatTime(updateTime)!;
  const interval: number = (Date.now() - updateTime) / 1000 / 60 / 60 / 24;
  if (new Date().toDateString() === new Date(updateTime).toDateString()) {
    return `${hour}:${minute}`;
  }
  if ((new Date().toDateString() !== new Date(updateTime).toDateString() && interval < 1) || interval >= 1 && interval < 2) {
    return $tt('time.format.yesterday');
  }
  if (interval >= 2 && interval < 7) {
    return $tt(weeklist[weekDay] as keyof IRCKitLanguageEntries);
  }
  return $tt('time.format.full', year, month, day);
};

const checkDevice = () => {
  isH5.value = isMobileDevice();
};

const handleResize = () => {
  checkDevice();
  refreshVirtualConversationWindow();
};

/**
 * 处理鼠标右键事件
 */
const handleConversationRightClick = async (conversation: IRCKitCachedConversation, e: MouseEvent) => {
  e.preventDefault();

  const list = context.conversationMenu.getMenum(conversation).map((item) => ({
    id: item.id, icon: item.icon, label: $tt(item.id as keyof IRCKitLanguageEntries), target: conversation.key,
  }));
  menu.value.splice(0, menu.value.length, ...list);
  rightClickedConversationKey.value = conversation.key;
  conversationMenuStyle.display = 'block';
  await nextTick();

  if (!conversationWrapRef.value || !conversationMenuRef.value || !scrollbar.value) {
    return;
  }

  const viewportRect = scrollbar.value.getViewportRect?.();
  const viewportSize = scrollbar.value.getViewportSize?.();
  const scrollPosition = scrollbar.value.getScrollPosition?.();
  if (!viewportRect || !viewportSize || !scrollPosition) {
    return;
  }

  const localX = e.clientX - viewportRect.left + scrollPosition.left;
  const localY = e.clientY - viewportRect.top + scrollPosition.top;
  conversationMenuStyle.top = calculateTop(
    conversationMenuRef.value.clientHeight,
    localY,
    viewportSize.height,
    scrollPosition.top,
  );
  conversationMenuStyle.left = calculateLeft(
    conversationMenuRef.value.clientWidth,
    localX,
    viewportSize.width,
    scrollPosition.left,
  );
};

// iOS Safari 触摸长按不派发 contextmenu，用 touch 检测长按后复用右键菜单逻辑
const handleConversationTouchStart = (conversation: IRCKitCachedConversation, e: TouchEvent) => {
  const { target, currentTarget } = e;
  longPressTouchStart(e, (point) => {
    handleConversationRightClick(conversation, createLongPressSyntheticEvent(point, target, currentTarget));
  });
};

const handleConversationClick = async (item: IRCKitCachedConversation, e: MouseEvent) => {
  e.preventDefault();
  // 点击会话项时关闭右键菜单
  conversationMenuStyle.display = 'none';
  rightClickedConversationKey.value = null;
  // 切换会话前判断是否要设置/清除缓存
  if (opened.value) {
    context.conversation.handleConversationDraft(opened.value, textarea.value?.value);
  }
  if (item.conversationType === ConversationType.SYSTEM) {
    // 派发点击事件，允许业务层拦截
    const evt = new RCKitEvent(RCKitEvents.BEFORE_SYSTEM_CONVERSATION_OPEN, item);
    context.emit(evt, 2);
    if (evt.isDefaultPrevented()) {
      // 业务已阻断，不再继续执行
      return;
    }
  } else {
    context.statistic(StatisticKey.CONVERSATION_LIST_ITEM_CLICK);
  }
  const { code } = await context.conversation.openConversation(item);
  if (code === InnerErrorCode.CONVERSATION_LIST_NOT_READY) {
    context.alert('alert.conversation.list.not.ready');
  } else if (code === ErrorCode.SUCCESS) {
    context.conversation.clearConversationUnreadMark(item);
  }
};

const handleMenuItemClick = (menuId: string, key: string) => {
  context.statistic(StatisticKey.CONVERSATION_LIST_ITEM_OPTION_CLICK);

  const conversation = context.conversation.getCachedConversationByKey(key);
  context.emit(new RCKitEvent(RCKitEvents.CONVERSATION_MENU_ITEM_CLICK, { id: menuId, conversation }));
  conversationMenuStyle.display = 'none';
  rightClickedConversationKey.value = null;
};

/**
 * 根据内容高度计算菜单 top 值
 * @param menuHeight
 * @param clientY
 */
const calculateTop = (menuHeight: number, localY: number, containerHeight: number, scrollTop: number) => {
  if (conversationMenuStyle) {
    const visibleY = localY - scrollTop;
    return containerHeight - visibleY < menuHeight ? (localY - menuHeight) : localY;
  }
  return 0;
};

/**
 * 根据内容宽度计算菜单 left 值
 * @param menuWidth
 * @param clientX
 */
const calculateLeft = (menuWidth: number, localX: number, containerWidth: number, scrollLeft: number) => {
  if (conversationMenuStyle) {
    const visibleX = localX - scrollLeft;
    return containerWidth - visibleX < menuWidth ? (localX - menuWidth) : localX;
  }
  return 0;
};

/**
 * 关闭菜单
 * @param e
 */
const handleHide = (e: any) => {
  if (e.button !== 0) {
    return;
  }
  conversationMenuStyle.display = 'none';
  rightClickedConversationKey.value = null;
};

const handleUserProfile = (message: IRCKitCachedMessage | null) => {
  if (!message || message.senderUserId === ctx().userId || message.messageType === MessageType.RECALL || message.messageType === MessageType.RECALL_NOTIFICATION_MESSAGE) return '';
  if (message.conversationType === ConversationType.SYSTEM) return context.appData.getSystemProfiles([message.targetId])[0].name;
  return context.appData.getUserProfile(message.senderUserId).name;
};
const isDraft = (conversation: IRCKitCachedConversation): boolean => {
  if (opened.value) {
    return !isSameConversation(opened.value, conversation) && !!conversation.draft;
  }
  return !!conversation.draft;
};

onMounted(() => {
  checkDevice();
  window.addEventListener('resize', handleResize);
  document.body.addEventListener('mouseup', handleHide, false);
  window.addEventListener('blur', handleHide, false);

  refreshVirtualConversationWindow();
});

onUnmounted(() => {
  if (virtualWindowFrame !== null) {
    cancelAnimationFrame(virtualWindowFrame);
    virtualWindowFrame = null;
  }
  window.removeEventListener('resize', handleResize);
  document.body.removeEventListener('mouseup', handleHide, false);
  window.removeEventListener('blur', handleHide, false);
});

</script>

<style>
/* 让会话列表 provider 宿主作为块级容器参与布局 */
:host {
  display: block;
  height: 100%;
}

.rc-conversation-wrap {
  padding: 0 10px;
  position: relative;
}
.rc-conversation-list {
  display: flow-root;
  box-sizing: border-box;
}
.rc-conversation-list-menu {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 101;
  padding: 7px 4px;
  background-color: #fff;
  border-radius: 6px;
  box-shadow: 0px 4px 15.9px 0px #0000001C;
  min-width: 95px;
}
.rc-conversation-list-menu-mask {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
}
.rc-conversation-list-spacer {
  width: 100%;
  flex: 0 0 auto;
}

/* 触摸小屏下禁用 iOS 长按的文本选择与链接/图片系统预览（callout），让自定义菜单接管 */
@media (max-width: 768px) {
  .rc-conversation-list {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
}
</style>
