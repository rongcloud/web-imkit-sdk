<template>
  <div v-if="visible" class="read-receipt-popover" :style="popoverStyle" @click.stop>
    <div class="read-receipt-content">
      <!-- 已读列表 -->
      <div class="read-receipt-column">
        <div class="read-receipt-title">{{ $tt('message.list.read-receipt.tooltip.read-count', readCount) }}</div>
        <div class="read-receipt-list-wrapper">
          <div class="read-receipt-list" ref="readListRef" @scroll="(e) => handleScroll(e, 'read')">
            <ul class="read-receipt-ul">
              <li v-for="user in readUsers" :key="user.userId" class="read-receipt-item">
                <rc-icon
                  :url="context.appData.getUserProfile(user.userId).portraitUri"
                  :radius="50" :width="20" :height="20" :online="false"></rc-icon>
                <div class="read-receipt-info">
                  <p class="read-receipt-name">{{ truncateName(context.appData.getUserProfile(user.userId).name) }}</p>
                  <p class="read-receipt-time" v-if="user.timestamp">
                    {{ timeController(user.timestamp) }}
                  </p>
                </div>
              </li>
            </ul>
          </div>
          <rc-scrollbar-thumb-provider
            v-if="readSizeHeight"
            @handlemove="handleReadMove"
            :height="readSizeHeight"
            :move="readMoveY"
            :scrollheight="readListRef?.scrollHeight"
            :ratio="readRatioY">
          </rc-scrollbar-thumb-provider>
        </div>
      </div>
      <!-- 未读列表 -->
      <div class="read-receipt-column">
        <div class="read-receipt-title">{{ $tt('message.list.read-receipt.tooltip.unread-count', unreadCount) }}</div>
        <div class="read-receipt-list-wrapper">
          <div class="read-receipt-list" ref="unreadListRef" @scroll="(e) => handleScroll(e, 'unread')">
            <ul class="read-receipt-ul">
              <li v-for="user in unreadUsers" :key="user.userId" class="read-receipt-item">
                <rc-icon
                  :url="context.appData.getUserProfile(user.userId).portraitUri"
                  :radius="50" :width="20" :height="20" :online="false"></rc-icon>
                <div class="read-receipt-info">
                  <p class="read-receipt-name">{{ truncateName(context.appData.getUserProfile(user.userId).name) }}</p>
                </div>
              </li>
            </ul>
          </div>
          <rc-scrollbar-thumb-provider
            v-if="unreadSizeHeight"
            @handlemove="handleUnreadMove"
            :height="unreadSizeHeight"
            :move="unreadMoveY"
            :scrollheight="unreadListRef?.scrollHeight"
            :ratio="unreadRatioY">
          </rc-scrollbar-thumb-provider>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, ref, watch, onMounted, nextTick, onBeforeUnmount,
} from 'vue';
import { ctx } from '../provider/context';
import { IRCKitCachedMessage } from '../../modules/MessageDataModule';
import { $tt } from '../i18n-vue';
import { formatTime } from '../../helper';
import type { IReadReceiptPosition } from '../read-receipt-layout';

const props = defineProps<{
  message: IRCKitCachedMessage | null;
  visible: boolean;
  readUsers: any[];
  unreadUsers: any[];
  readCount: number;
  unreadCount: number;
  readLoading: boolean;
  unreadLoading: boolean;
  position?: IReadReceiptPosition;
}>();

const emit = defineEmits<{(e: 'close'): void;
  (e: 'read-status-scroll', listScrollInfo: { scrollTop: number, scrollHeight: number, clientHeight: number }, type: 'read' | 'unread'): void;
}>();

const context = ctx();

// 已读列表滚动条相关
const readListRef = ref<HTMLDivElement>();
const readSizeHeight = ref(0);
const readMoveY = ref(0);
const readRatioY = ref(1);

// 未读列表滚动条相关
const unreadListRef = ref<HTMLDivElement>();
const unreadSizeHeight = ref(0);
const unreadMoveY = ref(0);
const unreadRatioY = ref(1);

// 更新已读列表滚动条
const updateReadScrollbar = () => {
  if (!readListRef.value) return;
  const original = readListRef.value.offsetHeight ** 2 / readListRef.value.scrollHeight;
  const originalHeight = Math.floor(original * 100) / 100;
  const height = Math.max(originalHeight, 20);
  const ratio = originalHeight / (readListRef.value.offsetHeight - originalHeight) / (height / (readListRef.value.offsetHeight - height));
  readRatioY.value = Math.floor(ratio * 100) / 100 || 1;
  readSizeHeight.value = originalHeight < readListRef.value.offsetHeight ? Math.floor(height) : 0;
};

// 更新未读列表滚动条
const updateUnreadScrollbar = () => {
  if (!unreadListRef.value) return;
  const original = unreadListRef.value.offsetHeight ** 2 / unreadListRef.value.scrollHeight;
  const originalHeight = Math.floor(original * 100) / 100;
  const height = Math.max(originalHeight, 20);
  const ratio = originalHeight / (unreadListRef.value.offsetHeight - originalHeight) / (height / (unreadListRef.value.offsetHeight - height));
  unreadRatioY.value = Math.floor(ratio * 100) / 100 || 1;
  unreadSizeHeight.value = originalHeight < unreadListRef.value.offsetHeight ? Math.floor(height) : 0;
};

// 已读列表滚动处理
const handleReadMove = (e: CustomEvent) => {
  if (!readListRef.value) return;
  const thumbPositionPercentage = e.detail[0];
  readListRef.value.scrollTop = (thumbPositionPercentage * readListRef.value.scrollHeight) / 100;
};

// 未读列表滚动处理
const handleUnreadMove = (e: CustomEvent) => {
  if (!unreadListRef.value) return;
  const thumbPositionPercentage = e.detail[0];
  unreadListRef.value.scrollTop = (thumbPositionPercentage * unreadListRef.value.scrollHeight) / 100;
};

// ResizeObserver 用于监听容器大小变化
let readResizeObserver: ResizeObserver | null = null;
let unreadResizeObserver: ResizeObserver | null = null;

const handleResize = () => {
  updateReadScrollbar();
  updateUnreadScrollbar();
};

// 初始化 ResizeObserver
const initResizeObservers = () => {
  if (readListRef.value && !readResizeObserver) {
    readResizeObserver = new ResizeObserver(() => {
      updateReadScrollbar();
    });
    readResizeObserver.observe(readListRef.value!);
  }
  if (unreadListRef.value && !unreadResizeObserver) {
    unreadResizeObserver = new ResizeObserver(() => {
      updateUnreadScrollbar();
    });
    unreadResizeObserver.observe(unreadListRef.value!);
  }
};

// 清理 ResizeObserver
const cleanupResizeObservers = () => {
  readResizeObserver?.disconnect();
  readResizeObserver = null;
  unreadResizeObserver?.disconnect();
  unreadResizeObserver = null;
};

// 监听 visible 和数据变化，更新滚动条
watch([() => props.visible, () => props.readUsers, () => props.unreadUsers], async ([visible]) => {
  if (visible) {
    await nextTick();
    initResizeObservers();
    updateReadScrollbar();
    updateUnreadScrollbar();
  } else {
    cleanupResizeObservers();
  }
}, { deep: true });

// 点击外部关闭弹窗
const handleClickOutside = (e: MouseEvent) => {
  if (!props.visible) return;

  const target = e.target as HTMLElement;
  const popover = target.closest('.read-receipt-popover');

  // 如果点击的元素不在弹窗内部，则关闭弹窗
  if (!popover) {
    emit('close');
  }
};

onMounted(() => {
  window.addEventListener('resize', handleResize);
  window.addEventListener('click', handleClickOutside);
  if (props.visible) {
    nextTick(() => {
      initResizeObservers();
    });
  }
});

onBeforeUnmount(() => {
  cleanupResizeObservers();
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', handleClickOutside);
});

// 计算弹窗位置
const popoverStyle = computed(() => {
  if (!props.position) {
    return { maxHeight: '420px' };
  }

  const anchor = props.position.anchor || 'top-right';
  let transform = '';
  if (anchor === 'top-right') {
    // 消息在顶部，弹窗右上角靠近状态图标
    // 定位点在状态图标左上角，需要向左移动 100% 到右上角
    transform = 'translateX(-100%)';
  } else if (anchor === 'bottom-right') {
    // 消息在底部，弹窗右下角靠近状态图标
    // 定位点在状态图标左下角，需要向左上移动到右下角
    transform = 'translate(-100%, -100%)';
  } else if (anchor === 'top-left') {
    // 消息在顶部，弹窗左上角靠近状态图标
    // 定位点在状态图标右上角，不需要 transform
    transform = '';
  } else if (anchor === 'top-center') {
    // 消息在顶部，弹窗水平居中
    // 定位点在容器中心，需要向左移动 50% 实现居中
    transform = 'translateX(-50%)';
  } else if (anchor === 'bottom-center') {
    // 消息在底部，弹窗水平居中
    // 定位点在容器中心，需要向左移动 50% 并向上移动 100% 实现居中
    transform = 'translate(-50%, -100%)';
  } else {
    // 消息在底部，弹窗左下角靠近状态图标
    // 定位点在状态图标右下角，需要向上移动 100%
    transform = 'translateY(-100%)';
  }

  return {
    top: `${props.position.top}px`,
    left: `${props.position.left}px`,
    maxHeight: `${props.position.maxHeight}px`,
    ...(transform ? { transform } : {}),
  };
});

const truncateName = (name: string, maxLength: number = 10): string => {
  if (name.length <= maxLength) return name;
  return `${name.substring(0, maxLength)}...`;
};

const timeController = (time: number) => {
  const { hour, minute } = formatTime(time)!;
  return `${hour}:${minute}`;
};

const handleScroll = (e: Event, type: 'read' | 'unread') => {
  if (!e || !e.target) {
    console.warn('[ReadReceiptModal] Invalid scroll event:', e);
    return;
  }

  const target = e.target as HTMLDivElement;
  const { scrollHeight, offsetHeight, scrollTop } = target;

  // 更新滚动条位置
  if (type === 'read' && readListRef.value) {
    readMoveY.value = ((scrollTop * 100) / offsetHeight) * readRatioY.value || 0;
  } else if (type === 'unread' && unreadListRef.value) {
    unreadMoveY.value = ((scrollTop * 100) / offsetHeight) * unreadRatioY.value || 0;
  }

  // 传递滚动信息给父组件：scrollHeight 是内容总高度，clientHeight 是可见区域高度
  emit('read-status-scroll', { scrollTop, scrollHeight, clientHeight: offsetHeight }, type);
};
</script>

<style>
.read-receipt-popover {
  position: absolute;
  overflow: hidden;
  background-color: #fff;
  border-radius: 6px;
  box-shadow: 0px 5px 16px 0px #00000014;
  width: 344px;
  z-index: 4;
}

.read-receipt-content {
  display: flex;
  flex-direction: row;
  max-height: inherit;
}

.read-receipt-column {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #E5E5E5;
}

.read-receipt-column:last-child {
  border-right: none;
}

.read-receipt-title {
  flex-shrink: 0;
  padding: 15px 12px 6px 12px;
  font-size: 14px;
  color: #0E1012;
}

.read-receipt-list-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.read-receipt-list {
  height: 100%;
  overflow-y: auto;
  padding: 0;
  scrollbar-width: none;
  padding-bottom: 10px;
}

.read-receipt-list::-webkit-scrollbar {
  display: none;
}

.read-receipt-ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

.read-receipt-item {
  display: flex;
  align-items: center;
  padding: 4px 12px;
}

.read-receipt-item:last-child {
  border-bottom: none;
}

.read-receipt-info {
  margin-left: 4px;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.read-receipt-name {
  font-size: 12px;
  color: #0E1012;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.read-receipt-time {
  color: #85909C;
  font-size: 11px;
  margin: 0;
  flex-shrink: 0;
}

.read-receipt-time img {
  width: 12px;
  height: 12px;
}
</style>
