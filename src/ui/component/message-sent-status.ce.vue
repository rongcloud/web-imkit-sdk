<template>
<div v-if="isSupportReadReceiptVersion"
  class="rc-kit-message-sent-status"
  :class="{ 'rc-kit-has-tooltip': shouldShowTooltip }"
  @click="onClick"
  :style="{ cursor: showCursor ? 'pointer' : 'default' }"
>
  <!-- V5 群聊饼图显示 -->
  <svg v-if="showPieChart" :width="size" :height="size" class="rc-kit-read-receipt-pie">
    <!-- 外层绿色圆环 -->
    <circle
      :cx="size / 2"
      :cy="size / 2"
      :r="outerRadius"
      fill="none"
      stroke="#46DB7A"
      :stroke-width="outerStrokeWidth"
    />
    <!-- 内层绿色饼图进度 -->
    <circle
      v-if="readPercentage > 0"
      :cx="size / 2"
      :cy="size / 2"
      :r="pieRadius"
      fill="none"
      stroke="#46DB7A"
      :stroke-width="pieStrokeWidth"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="strokeDashoffset"
      class="rc-kit-pie-inner"
      :transform="`rotate(-90 ${size / 2} ${size / 2})`"
    />
  </svg>
  <!-- 普通图标显示 -->
  <img v-else
    :src="handleMessageSentStatus()"
    :class="{ 'rc-kit-sending': effectiveSentStatus === 10 }"
    alt="status"
  >
  <!-- V5 群聊已读回执 Tooltip -->
  <div v-if="shouldShowTooltip && tooltipText" class="rc-kit-read-receipt-tooltip">
    <div class="rc-kit-tooltip-content">
      {{ tooltipText }}
    </div>
    <div class="rc-kit-tooltip-arrow"></div>
  </div>
</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { ConversationType, GroupReadReceiptVersion, SentStatus } from '@rongcloud/imlib-next';
import { IRCKitCachedMessage } from '@lib/modules/MessageDataModule';
import { ctx } from '../provider/context';
import {
  SENT_STATUS_FAILED_ICON,
  SENT_STATUS_READ_ICON,
  SENT_STATUS_UNREAD_ICON,
  SENT_STATUS_SENDING_ICON,
  SENT_STATUS_UNREAD_CHAT_ICON,
  SENT_STATUS_SENDING_CHAT_ICON,
} from '../../assets';
import { $tt } from '../i18n-vue';

const props = defineProps<{
  message: IRCKitCachedMessage,
  type?: number
}>();
const context = ctx();
const emit = defineEmits<{(e: 'sent-status-click',
  message: IRCKitCachedMessage,
  evt: MouseEvent
): void }>();
const isSupportReadReceiptVersion = computed(() => context.readReceiptVersion === GroupReadReceiptVersion.V5);

// 饼图尺寸配置
const size = 16;
// 外层圆环尺寸
const outerRadius = 7;
const outerStrokeWidth = 1.2;
// 内层饼图尺寸
const innerRadius = 5.2; // 内层饼图的实际半径
const pieRadius = innerRadius / 2; // 用于画饼图的辅助半径
const pieStrokeWidth = innerRadius; // 描边宽度等于实际半径
const circumference = 2 * Math.PI * pieRadius;

const isV5Group = computed(() => context.readReceiptVersion === GroupReadReceiptVersion.V5 && props.message.conversationType === ConversationType.GROUP);
/**
 * 发送失败支持点击重发，cursor: pointer
 * 群组支持点击查看已读回执，cursor: pointer
 */
const showCursor = computed(() => effectiveSentStatus.value === SentStatus.FAILED || isV5Group.value);

// 计算有效的发送状态（考虑 V5 已读回执逻辑）
const effectiveSentStatus = computed(() => {
  let status = props.message.sentStatus;

  if (context.readReceiptVersion === GroupReadReceiptVersion.V5) {
    if (props.message.conversationType === ConversationType.PRIVATE && props.message.kitReadReceiptInfo) {
      const readCount = props.message.kitReadReceiptInfo.readCount || 0;
      // 根据已读数量计算有效状态，不修改原始 message
      status = readCount > 0 ? SentStatus.READ : SentStatus.SENT;
    }
    // V5群聊特殊处理
    if (props.message.conversationType === ConversationType.GROUP && props.message.kitReadReceiptInfo) {
      const receiptInfo = props.message.kitReadReceiptInfo;
      // 有已读信息时判断
      if (receiptInfo) {
        const readCount = receiptInfo.readCount || 0;
        const unreadCount = receiptInfo.unreadCount || 0;

        // 没有一人读过：展示单聊未读的 icon
        if (readCount === 0) {
          status = SentStatus.SENT;
        }

        // 全部已读：展示单聊已读 icon
        if (readCount === readCount + unreadCount) {
          status = SentStatus.READ;
        }
      }
    }
  }

  return status;
});

const onClick = (evt: MouseEvent) => {
  evt.stopPropagation();
  const ifEmit = effectiveSentStatus.value === SentStatus.FAILED || isV5Group.value;
  if (ifEmit) {
    emit('sent-status-click', props.message, evt);
  }
};

// 判断是否显示饼图（V5群聊且存在已读信息）
const showPieChart = computed(() => {
  // 只对V5版本且是群聊显示饼图
  if (context.readReceiptVersion !== GroupReadReceiptVersion.V5) {
    return false;
  }

  if (props.message.conversationType !== ConversationType.GROUP) {
    return false;
  }

  // 发送中或发送失败的消息不显示饼图
  if (props.message.sentStatus === 10 || props.message.sentStatus === 20) {
    return false;
  }

  // 检查是否有已读信息
  const receiptInfo = props.message.kitReadReceiptInfo;

  if (!receiptInfo) {
    return false;
  }

  // 必须有总人数和已读人数信息
  const totalCount = receiptInfo.totalCount || 0;
  const readCount = receiptInfo.readCount || 0;
  const unreadCount = receiptInfo.unreadCount || 0;

  // 至少有一人已读才显示饼图（0人已读显示未读图标，全部已读显示已读图标）
  return totalCount > 0 && readCount > 0 && readCount < readCount + unreadCount;
});

// 计算已读百分比
const readPercentage = computed(() => {
  if (!showPieChart.value) {
    return 0;
  }

  const receiptInfo = props.message.kitReadReceiptInfo;

  if (!receiptInfo) {
    return 0;
  }

  const totalCount = receiptInfo.totalCount || 0;
  const readCount = receiptInfo.readCount || 0;

  if (totalCount === 0) {
    return 0;
  }

  return readCount / totalCount;
});

// 计算饼图stroke-dashoffset
const strokeDashoffset = computed(() => circumference * (1 - readPercentage.value));

// 判断是否显示 Tooltip（V5 群聊且有已读信息）
const shouldShowTooltip = computed(() => {
  // 只对V5版本且是群聊显示 tooltip
  if (context.readReceiptVersion !== GroupReadReceiptVersion.V5) {
    return false;
  }

  if (props.message.conversationType !== ConversationType.GROUP) {
    return false;
  }

  // 发送中或发送失败的消息不显示 tooltip
  if (props.message.sentStatus === 10 || props.message.sentStatus === 20) {
    return false;
  }

  return true;
});

// 计算 Tooltip 文本
const tooltipText = computed(() => {
  if (!shouldShowTooltip.value) {
    return '';
  }

  const receiptInfo = props.message.kitReadReceiptInfo;
  const parts: string[] = [];
  if (!receiptInfo) {
    parts.push($tt('message.list.read-receipt.tooltip.all-unread'));
    return parts.join(', ');
  }

  const readCount = receiptInfo.readCount || 0;
  const unreadCount = receiptInfo.unreadCount || 0;

  if (readCount === 0) {
    parts.push($tt('message.list.read-receipt.tooltip.all-unread'));
  } else if (readCount === readCount + unreadCount) {
    parts.push($tt('message.list.read-receipt.tooltip.all-read'));
  } else {
    parts.push($tt('message.list.read-receipt.tooltip.read-count', readCount));
    parts.push($tt('message.list.read-receipt.tooltip.unread-count', unreadCount));
  }
  return parts.join(', ');
});

/**
 * 处理消息发送状态图标
 * 1. V5群聊特殊处理，没有一人读过：展示单聊未读的 icon
 * 2. V5群聊特殊处理，全部已读：展示单聊已读 icon
 * 3. V5群聊特殊处理，图标返回默认的 SENT_STATUS_UNREAD_ICON，但不会展示，部分已读展示饼图
 * 3. V4逻辑或单聊逻辑（保持不变）
 * 使用 effectiveSentStatus computed 属性来获取有效状态
 */
const handleMessageSentStatus = () => {
  // V4逻辑或单聊逻辑（保持不变）
  let icon = SENT_STATUS_UNREAD_ICON;
  switch (effectiveSentStatus.value) {
    case 10:
      icon = props.type ? SENT_STATUS_SENDING_ICON : SENT_STATUS_SENDING_CHAT_ICON;
      break;
    case 20:
      icon = SENT_STATUS_FAILED_ICON;
      break;
    case 30:
      icon = props.type ? SENT_STATUS_UNREAD_ICON : SENT_STATUS_UNREAD_CHAT_ICON;
      break;
    case 50:
      icon = SENT_STATUS_READ_ICON;
      break;
    default:
      break;
  }
  return icon;
};

</script>
<style>
.rc-kit-message-sent-status {
  display: flex;
  align-items: center;
  font-size: 0;
  position: relative;
  margin-top: 4px;
  /* margin-right: 5px; */
}

.rc-kit-read-receipt-pie {
  width: 16px;
  height: 16px;
  display: block;
}

.rc-kit-pie-inner {
  transition: stroke-dashoffset 0.3s ease;
}

.rc-kit-message-sent-status img {
  display: inline-block;
  vertical-align: middle;
}

.rc-kit-message-sent-status img.rc-kit-sending {
  animation: rc-kit-rotate 1s linear infinite !important;
  transform-origin: center center;
  will-change: transform;
}

@keyframes rc-kit-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Tooltip 样式 */
.rc-kit-read-receipt-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.rc-kit-has-tooltip:hover .rc-kit-read-receipt-tooltip {
  opacity: 1;
  visibility: visible;
}

.rc-kit-tooltip-content {
  background-color: #fff;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  color: #333;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  line-height: 1.5;
}

.rc-kit-tooltip-arrow {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #fff;
}
</style>
