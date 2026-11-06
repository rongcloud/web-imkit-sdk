<template>
  <div class="rc-kit-app" :class="{ 'is-h5': isH5 }">
    <rc-conversation-list-container-provider
      v-if="!isH5 || !opened"
      class="list"
    ></rc-conversation-list-container-provider>
    <rc-conversation-detail-provider
      v-if="!isH5 || opened"
      class="detail"
    ></rc-conversation-detail-provider>
  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref,
} from 'vue';
import { openedConversation } from './context';
import { isMobileDevice } from '../../helper';

const isH5 = ref(false);
const opened = computed(() => openedConversation.value !== null);

const checkDevice = () => {
  isH5.value = isMobileDevice();
};

onMounted(() => {
  checkDevice();
  window.addEventListener('resize', checkDevice);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice);
});
</script>

<style>
/* 让根 custom element 宿主成为可计算高度的布局容器 */
:host {
  display: block;
  height: 100%;
}

.rc-kit-app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  position: relative;
}

.rc-kit-app.is-h5 {
  flex-direction: column;
}

.detail {
  flex: 1 auto;
  overflow: hidden;
}

.list {
  border-right: 1px solid #E4E7ED;
}

.rc-kit-app.is-h5 .list {
  border-right: none;
  border-bottom: 1px solid #E4E7ED;
  height: 100%;
}
</style>
