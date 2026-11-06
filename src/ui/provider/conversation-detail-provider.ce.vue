<template>
  <div class="rc-kit-app-wrapper-right" :class="{ 'is-h5': isH5 }">
    <div class="rc-kit-app-inner">
      <rc-connection-status :visible="connectionStatus !== RCConnectionStatus.CONNECTED && showConnectionStatus" :status="connectionStatus" :code="connectionCode"></rc-connection-status>
      <rc-conversation-empty style="width: 100%; height: 100%;" v-if="!opened" :desc="emptyDesc"></rc-conversation-empty>
      <template v-else>
        <rc-conversation-detail-bar-provider :conversation="opened" :show-back="showConversationDetailBackValue"></rc-conversation-detail-bar-provider>
        <rc-toast-provider></rc-toast-provider>
        <rc-message-list-provider class="rc-kit-msg-list" ref="messageListRef"
          @selection-change="handleSelectionChange"></rc-message-list-provider>
        <rc-input-provider :conversation="opened"
          v-show="!selection.active && !isSystem"></rc-input-provider>
        <rc-multi-choice-menu-provider v-if="selection.active" :messages="selection.messages" :is-h5="isH5"
          @cancel="messageListRef?.exitMultiChoiceMode()"></rc-multi-choice-menu-provider>
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref,
} from 'vue';
import { ConversationType, RCConnectionStatus, ErrorCode } from '@rongcloud/engine';
import { ConnectionStatusChangeEvent, InnerEvent } from '@lib/core/EventDefined';
import { RCKitCommand } from '@lib/enums/RCKitCommand';
import type { IRCKitCachedMessage } from '@lib/modules/MessageDataModule';
import {
  openedConversation as opened, ctx, setEnvInfo, showConversationDetailBack,
} from './context';
import { $t } from '../i18n-vue';
import { isMobileDevice } from '../../helper';

setEnvInfo();

const context = ctx();
const isH5 = ref(false);
const messageListRef = ref<HTMLElement & { exitMultiChoiceMode:() => void }>();
// 仅接收列表的展示快照；选择数据的修改和清理由消息列表负责。
const selection = ref<{ active: boolean; messages: IRCKitCachedMessage[] }>({ active: false, messages: [] });
const handleSelectionChange = (event: CustomEvent<[boolean, IRCKitCachedMessage[]]>) => {
  const [active, messages] = event.detail;
  selection.value = { active, messages };
};

// 从 store 中读取配置
const showConversationDetailBackValue = computed(() => showConversationDetailBack.value);

const checkDevice = () => {
  isH5.value = isMobileDevice();
};

const emptyDesc = $t('conversation.empty.desc');
const isSystem = computed(() => opened.value && opened.value.conversationType === ConversationType.SYSTEM);

const connectionStatus = ref<RCConnectionStatus>(0);
const connectionCode = ref<ErrorCode | undefined>(0);
const showConnectionStatus = context.store.getCommandSwitch(RCKitCommand.SHOW_CONNECTION_STATUS);

const _onConnectionStatusChange = (e: ConnectionStatusChangeEvent) => {
  const { status, code } = e.data;
  connectionStatus.value = status;
  connectionCode.value = code;
};

onMounted(() => {
  checkDevice();
  window.addEventListener('resize', checkDevice);
  context.addEventListener(InnerEvent.CONNECTION_STATUS_CHANGE, _onConnectionStatusChange, this);
});
onUnmounted(() => {
  window.removeEventListener('resize', checkDevice);
  context.removeEventListener(InnerEvent.CONNECTION_STATUS_CHANGE, _onConnectionStatusChange, this);
});

</script>

<style>
/* 让右侧详情区宿主参与高度链，内部列布局可稳定撑满 */
:host {
  display: block;
  height: 100%;
}

.rc-kit-app-wrapper-right {
  width: 100%;
  height: 100%;
  position: relative;
}

.rc-kit-app-inner {
  width: 100%;
  height: 100%;
  min-width: 600px;
  display: flex;
  flex-direction: column;
}

.rc-kit-app-wrapper-right.is-h5 .rc-kit-app-inner {
  min-width: 0;
}

.rc-kit-msg-list {
  flex: 1 1 auto;
  overflow: hidden;
  background-color: #FFFFFF;
  position: relative;
}

.rc-kit-app-inner {
  position: relative;
}

.camera-screen {
  flex: 1 auto;
}
</style>
