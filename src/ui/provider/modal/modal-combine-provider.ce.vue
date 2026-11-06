<template>
  <div class="modal-combine-provider" @click="handleCancel">
    <div class="rc-imkit-combine-box" @click="(e: Event) => e.stopPropagation()">
      <div class="rc-imkit-combine-header">
          <div class="title">{{ title }}</div>
          <span class="close" @click="handleCancel" @mouseenter="closeHover = true" @mouseleave="closeHover = false">
            <img :src="closeHover ? MODAL_CLOSE_HOVER_ICON : MODAL_CLOSE_ICON" alt="MODAL_CLOSE_ICON">
          </span>
      </div>
      <div class="rc-imkit-combine-body">
        <div class="rc-imkit-combine-body-iframe" v-if="props.type === MessageType.COMBINE">
          <div v-if="loading" class="loading">{{ $tt('combine-msg.loading') }}</div>
          <iframe class="rc-imkit-iframe" :src="props.url" title="Iframe" @load="handleIframeOnload"></iframe>
        </div>
        <rc-scrollbar-provider v-else>
          <div v-if="remoteContentState === 'loading'" class="rc-imkit-combine-status">
            {{ $tt('combine-msg.loading') }}
          </div>
          <div v-else-if="remoteContentState === 'failed'" class="rc-imkit-combine-status rc-imkit-combine-status-failed">
            {{ $tt('combine-msg.load-failed') }}
          </div>
          <div v-else style="padding: 10px 20px;">
            <div v-for="item in messageRenderList">
              <rc-message-time style="margin-bottom: 10px;" v-if="typeof item === 'string'" :time="item"></rc-message-time>
              <div v-else class="rc-kit-msg-list-item" :style="{ 'flex-direction': 'row' }">
                <rc-icon
                  class="rc-kit-msg-avatar"
                  :url="handleUserProfiles(item).portraitUri"
                  :width="32" :height="32"
                  :radius="50" :online="false"></rc-icon>

                <div class="rc-kit-msg-bubble" @click="handleBubbleClick(item)">
                  <p class="name">{{ handleUserProfiles(item).name }}</p>
                  <div class="message-body-wrapper">
                    <component :is="getMessageComponentTag(item.objectName)"
                      @download="handleFileDownload(item)"
                      @link="handleLinkClick"
                      :userId="item.fromUserId"
                      :position="RCKitMessageComponentRenderPosition.MESSAGE_LIST"
                      :message="{
                        ...item, messageType: item.objectName,
                        messageDirection: MessageDirection.RECEIVE,
                        messageUId: `${item.timestamp}`
                      }">
                    </component>
                  </div>
                  <div class="footer">
                    <span class="time">{{ timeController(item.timestamp) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </rc-scrollbar-provider>
      </div>

    </div>
  </div>
</template>
<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted,
} from 'vue';
import {
  MessageType, ConversationType, CombineV2MessageContent, ICombinedMessage, MessageDirection,
} from '@rongcloud/imlib-next';
import { $t, $tt } from '@lib/ui/i18n-vue';
import { IRCKitLanguageEntries } from '@lib/languages';
import { RCKitEvents, MessagesDeletedEvent } from '@lib/core/EventDefined';
import { RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { IRCKitCachedMessage } from '@lib/modules/MessageDataModule';
import { ctx, getMessageComponentTag } from '../context';
import { MODAL_CLOSE_ICON, MODAL_CLOSE_HOVER_ICON } from '../../../assets';
import { ICacheUserProfile } from '../../../modules/appdata/UserCache';
import { formatTime } from '../../../helper';
import { RCKitEvent } from '../../../core/RCKitEvent';

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const props = defineProps<{
  url: string
  content: string
  type: string
  messageUid: string
}>();

const context = ctx();
const content = ref<CombineV2MessageContent>(JSON.parse(props.content));

const loading = ref<boolean>(true);
const closeHover = ref<boolean>(false);
type RemoteContentState = 'loading' | 'loaded' | 'failed';
const REMOTE_CONTENT_REQUEST_TIMEOUT = 30 * 1000;
const remoteContentState = ref<RemoteContentState>(content.value.remoteUrl ? 'loading' : 'loaded');
let remoteContentAbortController: AbortController | null = null;
let remoteContentRequestTimer: ReturnType<typeof setTimeout> | null = null;
let isUnmounted = false;

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
  const interval: number = (Date.now() - time) / 1000 / 60 / 60 / 24;
  let name = $tt('time.format.full', year, month, day);
  if (new Date().toDateString() === new Date(time).toDateString()) {
    name = $tt('time.format.today');
  }
  if ((new Date().toDateString() !== new Date(time).toDateString() && interval < 1) || interval >= 1 && interval < 2) {
    name = $tt('time.format.yesterday');
  }
  if (interval >= 2 && interval < 7) {
    name = $tt(weeklist[weekDay] as keyof IRCKitLanguageEntries);
  }
  return name;
};
const messageRenderList = computed(() => {
  const list = content.value.msgList;
  const result: (ICombinedMessage | string)[] = [];
  if (!list) return result;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    result.unshift(item);

    const before = list[i - 1];
    if (before) {
      // 与前一消息不属于同一天，向前插入时间数据
      if (new Date(item.timestamp).toDateString() !== new Date(before.timestamp).toDateString()) {
        result.unshift(handleTimeFilter(item.timestamp));
      }
    } else {
      // 当前消息为第一条消息，判断是否有更多可拉取的历史消息，没有则插入时间数据
      result.unshift(handleTimeFilter(item.timestamp));
    }
  }
  return result;
});

/**
 * 处理用户详细信息
 */
const handleUserProfiles = (msg: ICombinedMessage): ICacheUserProfile => context.appData.getUserProfile(msg.fromUserId);

const title = computed(() => {
  if (!content.value || !content.value.conversationType || !content.value.nameList) return '';
  if (content.value.conversationType === ConversationType.PRIVATE) {
    return content.value.nameList.length === 2 ? $t('private.combine-msg.title', ...content.value.nameList).value : $t('private.combine-msg.signal.title', ...content.value.nameList).value;
  }
  return $t('group.combine-msg.title').value;
});

const timeController = (time: number) => {
  const { hour, minute } = formatTime(time)!;
  return `${hour}:${minute}`;
};
const handleBubbleClick = (item: ICombinedMessage) => {
  switch (item.objectName) {
    case MessageType.IMAGE:
    case MessageType.SIGHT: {
      // TODO：后续修复，看是否有必要补全缺失数据
      const msg: IRCKitCachedMessage = {
        senderUserId: item.fromUserId,
        sentTime: item.timestamp,
        messageType: item.objectName,
        content: item.content,
      } as any;
      context.emit(new RCKitEvent(RCKitEvents.MEDIA_MESSAGE_MODAL_EVENT, msg));
      break;
    }
    case MessageType.COMBINE:
    case MessageType.COMBINE_V2:
      context.emit(new RCKitEvent(RCKitEvents.COMBINE_MESSAGE_MODAL_EVENT, item as any));
      break;
    default:
      break;
  }
};

const handleFileDownload = (message: ICombinedMessage) => {
  // 需将合并转发的消息格式转换成 IRCKitCachedMessage
  const msg: IRCKitCachedMessage = {
    messageType: message.objectName,
    content: message.content,
    senderUserId: message.fromUserId,
    targetId: message.targetId,
    channelId: '',
    conversationType: 1,
    sentTime: 0,
    receivedTime: 0,
    messageUId: '',
    messageDirection: 1,
    isPersited: true,
    isCounted: true,
    isOffLineMessage: false,
    canIncludeExpansion: true,
    receivedStatus: 1,
    transactionId: NaN,
    progress: 100,
    reactions: [],
  };
  emit('download', msg);
};
const handleLinkClick = (data: CustomEvent) => {
  context.emit(new RCKitEvent(RCKitEvents.MESSAGE_LINK_CLICK, data.detail[0]));
};

const handleCancel = (e: MouseEvent) => {
  emit('cancel');
};
const handleIframeOnload = () => {
  loading.value = false;
};

const isCombinedMessageList = (data: unknown): data is ICombinedMessage[] => (
  Array.isArray(data)
  && data.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const message = item as Partial<ICombinedMessage>;
    return typeof message.fromUserId === 'string'
      && typeof message.objectName === 'string'
      && typeof message.timestamp === 'number';
  })
);

const clearRemoteContentRequestTimer = () => {
  if (remoteContentRequestTimer) {
    clearTimeout(remoteContentRequestTimer);
    remoteContentRequestTimer = null;
  }
};

const loadRemoteContent = async () => {
  const { remoteUrl } = content.value;
  if (!remoteUrl) return;

  const controller = new AbortController();
  remoteContentAbortController = controller;
  remoteContentRequestTimer = setTimeout(() => controller.abort(), REMOTE_CONTENT_REQUEST_TIMEOUT);
  const isCurrentRequest = () => !isUnmounted && remoteContentAbortController === controller;

  try {
    const response = await fetch(remoteUrl, { signal: controller.signal });
    if (!isCurrentRequest()) return;
    if (!response.ok) {
      throw new Error(`Failed to load combined messages: ${response.status}`);
    }
    const data: unknown = await response.json();
    if (!isCurrentRequest()) return;
    if (controller.signal.aborted) {
      throw new Error('Combined message request aborted');
    }
    if (!isCombinedMessageList(data)) {
      throw new TypeError('Invalid combined message list');
    }
    content.value.msgList = data;
    remoteContentState.value = 'loaded';
  } catch {
    if (isCurrentRequest()) {
      remoteContentState.value = 'failed';
    }
  } finally {
    if (remoteContentAbortController === controller) {
      remoteContentAbortController = null;
      clearRemoteContentRequestTimer();
    }
  }
};

const _onDeleteMessages = (e: MessagesDeletedEvent) => {
  e.data.forEach((item) => {
    const { recallMsg } = item;
    if (recallMsg && recallMsg.content.messageUId === props.messageUid) {
      context.alert('alert.message-deleted');
      emit('cancel');
    }
  });
};

onMounted(() => {
  // 请求远端地址获取 json 数据
  if (content.value.remoteUrl) {
    loadRemoteContent();
  }
  context.addEventListener(RCKitEvents.MESSAGES_DELETED, _onDeleteMessages);
});

onUnmounted(() => {
  isUnmounted = true;
  remoteContentAbortController?.abort();
  remoteContentAbortController = null;
  clearRemoteContentRequestTimer();
  context.removeEventListener(RCKitEvents.MESSAGES_DELETED, _onDeleteMessages);
});

</script>
<style>
.modal-combine-provider {
  flex-direction: column;
  position: absolute;
  inset: 0px;
  z-index: 2;
  background-color: rgba(0, 0, 0, .5);
}
.rc-imkit-combine-body-iframe {
  height: 100%;
  background-color: #fff;
}
.rc-imkit-combine-box {
  background-color: #E6ECF3;
  height: 70%;
  width: 50%;
  box-shadow: 0px 10px 16px 0px #00000033;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 8px;
  overflow: hidden;
}
/* H5 下 50% 宽度过窄（弹窗挂载在 body、以视口为基准），铺满全屏，靠头部关闭按钮退出 */
@media (max-width: 768px) {
  .rc-imkit-combine-box {
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    transform: none;
    border-radius: 0;
    box-shadow: none;
  }
}
.rc-imkit-combine-header {
  background-color: #FFFFFF;
  position: relative;
}
.title {
  text-align: center;
  line-height: 19px;
  font-size: 12px;
  padding: 11px 0;
}
.close {
  position: absolute;
  top: 50%;
  right: 15px;
  padding: 0 5px;
  transform: translate(0, -50%);
  cursor: pointer;
}
.close img {
  display: block;
  width: 30px;
  height: 30px;
}
.rc-imkit-combine-body {
  flex: 1;
  overflow: hidden;
}

.loading {
  font-size: 18px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.rc-imkit-combine-status {
  min-height: 100%;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7B87A5;
  font-size: 14px;
  text-align: center;
}
.rc-imkit-combine-status-failed {
  color: #41464F;
}
.rc-imkit-iframe {
  height: 100%;
  width: 100%;
  overflow: scroll;
  border: 0;
}
.rc-kit-msg-list-item {
  display: flex;
  width: 100%;
  font-size: 12px;
  margin-bottom: 20px;
}
.rc-kit-msg-avatar {
  padding: 0 8px;
}

.rc-kit-msg-bubble {
  padding: 0 10px 8px 12px;
  border-radius: 0px 8px 8px;
  font-size: 12px;
  line-height: 16px;
  background-color: #fff;
}
p {
  margin: 0 0 5px 0;
  line-height: 16px;
  padding: 0;
  word-break: break-word;
  font-size: 12px;
}

.name {
  font-weight: 500;
  font-size: 12px;
}
.footer {
  text-align: right;
  margin-top: 5px;
  font-size: 10px;
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
}

.time {
  display: inline-block;
  margin-left: 7px;
  font-size: 12px;
  color: #7B87A5;
}

</style>
