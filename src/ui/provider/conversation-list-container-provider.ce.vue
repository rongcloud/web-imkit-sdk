<template>
  <div class="rc-kit-app-wrapper-left" :class="{ 'is-h5': isH5 }">
    <div class="rc-kit-app-conv-bar" v-if="isH5 && shouldShowBar">
      <div class="bar-content">
        <span class="bar-title">{{ conversationBarTitle || $tt('conversation.list.bar.title') }}</span>
      </div>
    </div>
    <div class="rc-kit-app-conv">
      <rc-conversation-list-provider></rc-conversation-list-provider>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref,
} from 'vue';
import { setEnvInfo, showConversationBar, conversationBarTitle } from './context';
import { isMobileDevice } from '../../helper';
import { $tt } from '../i18n-vue';

setEnvInfo();

const isH5 = ref(false);

const checkDevice = () => {
  isH5.value = isMobileDevice();
};

// 仅 H5 显示 bar，默认开启
const shouldShowBar = computed(() => showConversationBar.value);

onMounted(() => {
  checkDevice();
  window.addEventListener('resize', checkDevice);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice);
});
</script>

<style>
/* 让左侧会话容器宿主撑满父级，便于内部纵向布局计算 */
:host {
  display: block;
  height: 100%;
}

.rc-kit-app-wrapper-left {
  min-width: 312px;
  width: 312px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.rc-kit-app-wrapper-left.is-h5 {
  min-width: 0;
  width: 100%;
}

.bar-content {
  width: 100%;
  height: 68px;
  display: flex;
  flex-direction: row;
  align-items: center;
  position: relative;
  z-index: 2;
  background-color: #fff;
  border-bottom: 1px solid #efefef;
}

.bar-title {
  font-size: 16px;
  font-weight: 500;
  color: #000;
  margin: 0 20px;
}

.rc-kit-app-conv {
  flex: auto;
  overflow: hidden;
}
</style>
