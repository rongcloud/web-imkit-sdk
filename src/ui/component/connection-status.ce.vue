<template>
  <transition name="rc-status-fade">
    <div v-if="visible" class="rc-imkit-connection-status" :class="statusClass">
      <div class="rc-imkit-connection-status-content">
        <svg v-if="isConnecting" class="rc-connection-loading-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
          <path d="M512 1024c-282.7776 0-512-229.2224-512-512s229.2224-512 512-512 512 229.2224 512 512-229.2224 512-512 512z m0-921.6c-225.8944 0-409.6 183.7056-409.6 409.6s183.7056 409.6 409.6 409.6 409.6-183.7056 409.6-409.6-183.7056-409.6-409.6-409.6z" fill="#0047FF" opacity="0.3"></path>
          <path d="M512 1024C229.2224 1024 0 794.7776 0 512c0-28.2624 22.9376-51.2 51.2-51.2s51.2 22.9376 51.2 51.2c0 225.8944 183.7056 409.6 409.6 409.6s409.6-183.7056 409.6-409.6c0-225.8944-183.7056-409.6-409.6-409.6-28.2624 0-51.2-22.9376-51.2-51.2s22.9376-51.2 51.2-51.2c282.7776 0 512 229.2224 512 512s-229.2224 512-512 512z" fill="#0047FF"></path>
        </svg>
        <span class="rc-imkit-connection-status-text">{{ content }}</span>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RCConnectionStatus, ErrorCode } from '@rongcloud/imlib-next';
import { $tt } from '../i18n-vue';

const props = defineProps<{
  visible: boolean
  status: RCConnectionStatus
  code: ErrorCode | undefined
}>();

const isConnecting = computed(() => props.status === RCConnectionStatus.CONNECTING || props.status === RCConnectionStatus.SUSPENDED);

const content = computed(() => {
  if (props.status === RCConnectionStatus.DISCONNECTED) {
    return $tt('connection.status.disconnected');
  }
  if (isConnecting.value) {
    return $tt('connection.status.connecting');
  }
  return $tt('connection.status.suspended');
});

const statusClass = computed(() => {
  if (isConnecting.value) {
    return 'is-warning';
  }
  return 'is-error';
});
</script>

<style>
.rc-imkit-connection-status {
  position: absolute;
  top: 70px; /* 统一 Header 高度 */
  left: 0;
  right: 0;
  width: 100%;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); */
  box-sizing: border-box;
}

.rc-imkit-connection-status-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.rc-imkit-connection-status-text {
  font-size: 16px;
  color: #020814;
  line-height: 20px;
}

.rc-imkit-connection-status.is-error {
  background-color: #FFD5D5;
}

.rc-imkit-connection-status.is-warning {
  background-color: #E7EEFF;
}

.rc-connection-loading-icon {
  animation: rc-status-spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes rc-status-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 淡入淡出动画 */
.rc-status-fade-enter-active,
.rc-status-fade-leave-active {
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
}

.rc-status-fade-enter-from,
.rc-status-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.rc-status-fade-enter-to,
.rc-status-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
