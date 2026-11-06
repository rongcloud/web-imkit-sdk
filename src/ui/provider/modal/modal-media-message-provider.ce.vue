<template>
  <div class="modal-media-message-provider">
    <rc-modal-provider @click="handleCancel">
      <div class="media-message-container">
        <div class="media-message-header" @click="(e: Event) => e.stopPropagation()">
          <div class="menu">
            <div class="btn-wrapper" @mouseenter="upHover = true" @mouseleave="upHover = false">
              <img class="btn" @click="handleChangeHeight(+5, $event)"
                :src="upHover ? MODAL_UP_HOVER_ICON : MODAL_UP_ICON"
                alt="MODAL_UP_ICON">
            </div>
            <div class="btn-wrapper" @mouseenter="downHover = true" @mouseleave="downHover = false">
              <img class="btn" @click="handleChangeHeight(-5, $event)"
                :src="downHover ? MODAL_DOWN_HOVER_ICON : MODAL_DOWN_ICON"
                alt="MODAL_DOWN_ICON">
            </div>
            <div class="btn-wrapper" @mouseenter="downloadHover = true" @mouseleave="downloadHover = false">
              <img class="btn" @click="handleFileDownload"
                :src="downloadHover ? MODAL_DOWNLOAD_HOVER_ICON : MODAL_DOWNLOAD_ICON"
                alt="MODAL_DOWNLOAD_ICON">
            </div>
            <div class="btn-wrapper" @mouseenter="closeHover = true" @mouseleave="closeHover = false">
              <img class="btn" @click="handleCancel"
                :src="closeHover ? MODAL_CLOSE_HOVER_ICON : MODAL_CLOSE_ICON"
                alt="MODAL_CLOSE_ICON">
            </div>
          </div>
        </div>
        <div v-if="props.messageType === MessageType.IMAGE || props.messageType === MessageType.GIF"
          class="media-message-box"
          ref="boxRef"
          :class="{'self-start': selfStart}"
          :style="{ 'max-height': `calc(100% - 54px)` }">
          <div class="media-message" :style="{ 'width':`${widthSize}%` }">
            <svg v-show="isLoading" class="loading-spinner-svg" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
              <path d="M512 1024c-282.7776 0-512-229.2224-512-512s229.2224-512 512-512 512 229.2224 512 512-229.2224 512-512 512z m0-921.6c-225.8944 0-409.6 183.7056-409.6 409.6s183.7056 409.6 409.6 409.6 409.6-183.7056 409.6-409.6-183.7056-409.6-409.6-409.6z" fill="#ffffff" opacity="0.3"></path>
              <path d="M512 1024C229.2224 1024 0 794.7776 0 512c0-28.2624 22.9376-51.2 51.2-51.2s51.2 22.9376 51.2 51.2c0 225.8944 183.7056 409.6 409.6 409.6s409.6-183.7056 409.6-409.6c0-225.8944-183.7056-409.6-409.6-409.6-28.2624 0-51.2-22.9376-51.2-51.2s22.9376-51.2 51.2-51.2c282.7776 0 512 229.2224 512 512s-229.2224 512-512 512z" fill="#ffffff"></path>
            </svg>
            <img v-show="!isLoading" style="width: 100%;" ref="imgRef" @click="(e: Event) => e.stopPropagation()"
              :src="mediaUrl" @load="handleLoad" @error="handleError" alt="image">
          </div>
        </div>
        <div class="media-message-box" ref="boxRef" v-if="props.messageType === MessageType.SIGHT"
          :style="{ 'max-height': `calc(100% - 54px)` }">
          <div class="media-message" :style="{ 'height':`${heightSize}%` }">
            <video
              :poster="`data:image/png;base64,${props.content}`"
              style="height: 100%;" @click="(e: Event) => e.stopPropagation()"
              :src="mediaUrl" controls>
              <track kind="subtitles">
              <track kind="description">
            </video>
          </div>
        </div>
      </div>
    </rc-modal-provider>
  </div>
</template>
<script setup lang="ts">
import {
  nextTick, ref, onMounted, onUnmounted,
} from 'vue';
import { MessageType } from '@rongcloud/engine';
import { RCKitEvents, MessagesDeletedEvent } from '@lib/core/EventDefined';
import { IMAGE_FAILED } from '@lib/assets/index';
import { getAuthorizedDownloadUrl } from '@lib/helper/download';
import { isMobileDevice } from '@lib/helper';
import { ctx } from '../context';
import {
  MODAL_CLOSE_ICON, MODAL_DOWNLOAD_ICON, MODAL_UP_ICON, MODAL_UP_HOVER_ICON, MODAL_DOWN_ICON, MODAL_DOWN_HOVER_ICON, MODAL_DOWNLOAD_HOVER_ICON, MODAL_CLOSE_HOVER_ICON,
} from '../../../assets';

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const props = defineProps<{
  url: string
  userId: string
  sentTime: string
  messageType: string
  messageUid: string
  content: string
}>();

const context = ctx();

const handleCancel = (e: MouseEvent) => {
  emit('cancel');
};

let isMobileViewport = isMobileDevice();
const widthSize = ref<number>(isMobileViewport ? 100 : 50);
const heightSize = ref<number>(80);
const upHover = ref(false);
const downHover = ref(false);
const downloadHover = ref(false);
const closeHover = ref(false);
const imgRef = ref();
const boxRef = ref();
const selfStart = ref(false);

const updateSelfStart = () => {
  nextTick(() => {
    if (imgRef.value && boxRef.value) {
      selfStart.value = imgRef.value.clientHeight > boxRef.value.clientHeight;
    }
  });
};

const syncWidthSizeForViewport = () => {
  const isMobile = isMobileDevice();
  if (isMobile === isMobileViewport) return;

  isMobileViewport = isMobile;
  widthSize.value = isMobile ? 100 : 50;
};

const handleViewportResize = () => {
  syncWidthSizeForViewport();
  updateSelfStart();
};

const handleChangeHeight = (num: number, e: Event) => {
  e.stopPropagation();
  if (props.messageType === MessageType.SIGHT) {
    if ((heightSize.value + num) > 100 || (heightSize.value + num) < 50) return;
    heightSize.value += num;
  } else {
    syncWidthSizeForViewport();
    const maxWidthSize = isMobileDevice() ? 100 : 70;
    const currentWidthSize = Math.min(maxWidthSize, Math.max(10, widthSize.value));
    widthSize.value = Math.min(maxWidthSize, Math.max(10, currentWidthSize + num));
    updateSelfStart();
  }
};

const handleFileDownload = () => {
  emit('download');
};

const isLoading = ref(true);
const mediaUrl = ref<string>();

const _onDeleteMessages = (e: MessagesDeletedEvent) => {
  e.data.forEach((item) => {
    const { recallMsg } = item;
    if (recallMsg && recallMsg.content.messageUId === props.messageUid) {
      context.alert('alert.message-deleted');
      emit('cancel');
    }
  });
};

const handleError = () => {
  isLoading.value = false;
  mediaUrl.value = IMAGE_FAILED;
  if (imgRef.value) {
    imgRef.value.style.width = '100px';
    imgRef.value.style.height = '100px';
  }
};

const handleLoad = () => {
  isLoading.value = false;
  updateSelfStart();
};

let destroyed = false;

onMounted(async () => {
  window.addEventListener('resize', handleViewportResize);
  ctx().addEventListener(RCKitEvents.MESSAGES_DELETED, _onDeleteMessages);
  const url = await getAuthorizedDownloadUrl(props.url);
  if (destroyed) {
    return;
  }
  if (!url) {
    if (props.messageType === MessageType.IMAGE || props.messageType === MessageType.GIF) {
      handleError();
    }
    return;
  }
  mediaUrl.value = url;
});

onUnmounted(() => {
  destroyed = true;
  window.removeEventListener('resize', handleViewportResize);
  ctx().removeEventListener(RCKitEvents.MESSAGES_DELETED, _onDeleteMessages);
});

</script>
<style>
p {
  margin: 0;
  padding: 0;
}
.modal-media-message-provider :deep(.rc-kit-modal-provider) {
  background-color: #00000080;
}

.media-message-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.media-message-box {
  width: 100%;
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
}
.media-message-box.self-start{
  align-items: self-start;
}
.media-message-header{
  width: 100%;
  height: 54px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0 25px;
  background-color: #FFFFFF;
  box-sizing: border-box;
  z-index: 2;
  flex-shrink: 0;
}

.media-message {
  width: 50%;
  font-size: 0;
  display: flex;
  justify-content: center;
  z-index: 1;
  max-width: 100%;
}

.loading-spinner-svg {
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.menu {
  display: flex;
  align-items: center;
  gap: 24px;
  z-index: 2;
}

.btn-wrapper {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.btn-wrapper:hover {
  background-color: #D0DDFF;
}

.btn {
  width: 30px;
  height: 30px;
  cursor: pointer;
  display: block;
}

video, img {
  max-width: 100%;
  max-height: 100%;
}
</style>
