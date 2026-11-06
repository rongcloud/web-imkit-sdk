<template>
  <transition name="toast-fade">
    <div v-if="visible" class="rc-kit-toast">
      <div class="rc-kit-toast-content">
        <svg v-if="showIcon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="12" fill="#46DB7A"/>
          <path d="M7.24951 13.2507L10.2495 16.2507L17.2495 9.25073" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        <span class="rc-kit-toast-text">{{ message }}</span>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { RCKitEvents } from '@lib/core/EventDefined';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { ctx } from './context';

export interface ToastEventData {
  message: string;
  showIcon?: boolean;
}

const context = ctx();
const visible = ref<boolean>(false);
const message = ref<string>('');
const showIcon = ref<boolean>(true);
let timer: ReturnType<typeof setTimeout> | null = null;

const showToast = (data: ToastEventData) => {
  // 清除之前的定时器
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  message.value = data.message;
  showIcon.value = data.showIcon !== false;
  visible.value = true;

  // 3秒后自动消失
  timer = setTimeout(() => {
    visible.value = false;
    timer = null;
  }, 3000);
};

const onToastEvent = (e: RCKitEvent<'TOAST_EVENT', ToastEventData>) => {
  showToast(e.data);
};

onMounted(() => {
  context.addEventListener(RCKitEvents.TOAST_EVENT, onToastEvent);
});

onUnmounted(() => {
  if (timer) {
    clearTimeout(timer);
  }
  context.removeEventListener(RCKitEvents.TOAST_EVENT, onToastEvent);
});
</script>

<style scoped>
.rc-kit-toast {
  position: absolute;
  top: 70px; /* Header高度 */
  left: 0;
  right: 0;
  width: 100%;
  height: 46px;
  background-color: #C9F5D8;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); */
}

.rc-kit-toast-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.rc-kit-toast-text {
  font-size: 16px;
  color: #020814;
  line-height: 20px;
}

/* 淡入淡出动画 */
.toast-fade-enter-active {
  transition: opacity 0.3s ease-in, transform 0.3s ease-in;
}

.toast-fade-leave-active {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

.toast-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-fade-enter-to,
.toast-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
