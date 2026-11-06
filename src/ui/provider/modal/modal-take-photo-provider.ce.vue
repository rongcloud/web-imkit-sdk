<template>
  <div class="rc-take-photo-provider">
    <rc-modal-provider @click="handleCancel">
      <div class="take-photo-container" @click="(e: Event) => e.stopPropagation()">
        <div class="take-photo-header">
          <div class="btn-wrapper" @mouseenter="closeHover = true" @mouseleave="closeHover = false">
            <img class="btn" @click="handleCancel"
              :src="closeHover ? MODAL_CLOSE_HOVER_ICON : MODAL_CLOSE_ICON"
              alt="Close Icon">
          </div>
        </div>
        <div class="video-container" ref="videoContainer">
          <video v-show="!photo && stream" ref="videoDom" playsinline :srcObject="stream" autoplay></video>
          <img ref="imageDom" v-show="photo" :src="photo" alt="Photo">
          <span class="message" v-if="!stream">{{ message }}</span>
          <!-- 悬浮按钮区域 -->
          <div v-if="stream" class="floating-buttons">
            <div v-if="photo" class="floating-button retry-button" @click="handleRetry">
              <img :src="TAKE_PHOTO_RETRY_ICON" alt="Retry Icon">
              <span class="button-text">{{ $t('take-photo.retry-btn.label') }}</span>
            </div>
            <div class="floating-button action-button" @click="!photo ? takePhoto() : sendImage()">
              <img class="camera-icon" v-if="!photo" :src="TAKE_PHOTO_CAMERA_ICON" alt="Camera Icon">
              <img v-else :src="TAKE_PHOTO_SEND_ICON" alt="Send Icon">
              <span v-if="photo" class="button-text">{{ $t('take-photo.send-btn.label') }}</span>
            </div>
          </div>
        </div>
      </div>
    </rc-modal-provider>
  </div>
</template>

<script setup lang="ts">
import {
  onMounted, onUnmounted, ref, nextTick, computed,
} from 'vue';
import { RCKitEvents } from '@lib/core/EventDefined';
import { ctx, replyMessage } from '../context';
import {
  TAKE_PHOTO_CAMERA_ICON, TAKE_PHOTO_RETRY_ICON, MODAL_CLOSE_ICON, MODAL_CLOSE_HOVER_ICON, TAKE_PHOTO_SEND_ICON,
} from '../../../assets';
import { $t } from '../../i18n-vue';

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const context = ctx();
const videoDom = ref();
const videoContainer = ref();
const imageDom = ref();
const stream = ref<MediaStream | null>(null);
const photo = ref<string>('');
const closeHover = ref(false);
let blob: Blob | null = null;

let capturing: Promise<void> | null = null;
let isMounted = false;

const errormsg = ref('');
const message = computed(() => {
  if (errormsg.value) {
    return $t('take-photo.msg.camera-startup-failure', errormsg.value).value;
  }
  if (!stream.value) {
    return $t('take-photo.msg.camera-starting').value;
  }
  return '';
});

const handleCancel = () => {
  if (photo.value) {
    URL.revokeObjectURL(photo.value);
    photo.value = '';
  }
  blob = null;
  destroyStream();
  emit('cancel');
};

const handleRetry = async () => {
  URL.revokeObjectURL(photo.value);
  photo.value = '';
  blob = null;
  // 切换回video时重新调整尺寸
  await nextTick();
  // resize();
};

const takeStream = async () => {
  if (capturing) {
    return capturing;
  }
  errormsg.value = '';
  try {
    // 使用4:3宽高比
    const capturingTask: Promise<void> = navigator.mediaDevices.getUserMedia({
      video: {
        width: 960,
        height: 720,
        aspectRatio: 4 / 3,
      },
    }).then((mediaStream) => {
      // 组件关闭后请求才返回，不能再把摄像头流挂到已失效的实例上。
      if (capturing !== capturingTask) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.value = mediaStream;
    }, (error: unknown) => {
      // 让权限拒绝在当前任务内被消费，避免关闭时再次 await rejected promise。
      if (capturing === capturingTask) {
        errormsg.value = error instanceof Error ? error.message : String(error);
      }
    }).finally(() => {
      if (capturing === capturingTask) {
        capturing = null;
      }
    });
    capturing = capturingTask;
    return capturingTask;
  } catch (error: any) {
    errormsg.value = error instanceof Error ? error.message : String(error);
  }
};

const destroyStream = () => {
  // 先使在途请求失效；迟到的流会在 takeStream 的回调中自行停止。
  capturing = null;

  // 如果流已经存在，直接停止所有 tracks
  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop());
  }

  // 清理 video 元素的 srcObject
  if (videoDom.value) {
    videoDom.value.srcObject = null;
  }

  stream.value = null;
};

const takePhotoHandle = (): Promise<Blob> => new Promise((resolve) => {
  const canvas = document.createElement('canvas');
  const video = videoDom.value;
  const { width, height } = video;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, width, height);
  canvas.toBlob((blob) => resolve(blob!), 'image/jpg', 1);
});

const takePhoto = async () => {
  blob = await takePhotoHandle();
  photo.value = URL.createObjectURL(blob);
  // 确保预览图片和video使用相同的尺寸
  await nextTick();
  resize();
};

const sendImage = () => {
  // 发送照片
  context.message.sendFiles(
    context.conversation.getOpenedConversation()!,
    [new File([blob!], `screenshot-${Date.now()}.jpg`, { type: 'image/jpg' })],
  );
  // 清理资源
  handleCancel();
  emit('cancel');
};

const resize = () => {
  const video = videoDom.value;
  const container = videoContainer.value;
  const image = imageDom.value;
  if (!container) return;

  const { scrollWidth: width, scrollHeight: height } = container;
  const aspectRatio = 4 / 3;
  let videoWidth = width;
  let videoHeight = width / aspectRatio;

  // 如果高度超出容器，则按高度计算
  if (videoHeight > height) {
    videoHeight = height;
    videoWidth = height * aspectRatio;
  }

  if (video) {
    video.width = videoWidth;
    video.height = videoHeight;
  }
  if (image) {
    image.width = videoWidth;
    image.height = videoHeight;
  }
  console.log('resize', videoWidth, videoHeight, videoDom.value, videoContainer.value);
};

onMounted(async () => {
  isMounted = true;
  context.addEventListener(RCKitEvents.CONVERSATION_SELECTED, handleCancel);
  window.addEventListener('resize', resize);
  await takeStream();
  if (!isMounted || !stream.value) return;
  // 等待 DOM 尺寸计算完成
  await nextTick();
  if (!isMounted || !stream.value) return;
  // 等待video加载完成后再调整尺寸
  if (videoDom.value) {
    videoDom.value.addEventListener('loadedmetadata', resize);
  }
  resize();
});

onUnmounted(() => {
  isMounted = false;
  context.removeEventListener(RCKitEvents.CONVERSATION_SELECTED, handleCancel);
  window.removeEventListener('resize', resize);
  if (videoDom.value) {
    videoDom.value.removeEventListener('loadedmetadata', resize);
  }
  // 组件卸载时确保清理摄像头流
  destroyStream();
});
</script>

<style>
.rc-take-photo-provider :deep(.rc-kit-modal-provider) {
  background-color: #00000080;
}

.take-photo-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #00000080;
}

.take-photo-header {
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

.video-container {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
  position: relative;
  flex: 1;
  overflow: hidden;
}

.message {
  color: #a1a1a1;
  font-size: 14px;
  margin: 0 auto;
  position: absolute;
  z-index: 1;
}

.video-container video,
.video-container img {
  object-fit: contain;
  width: auto;
  height: auto;
  max-width: 80%;
  max-height: 80%;
}

.floating-buttons {
  position: absolute;
  bottom: 12%;
  display: flex;
  align-items: center;
  gap: 20px;
  z-index: 3;
}

.floating-button {
  width: 78px;
  height: 34px;
  border-radius: 30px;
  background-color: #0047FF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #fff;
  font-size: 14px;
}

.floating-button img {
  width: 14px;
  height: 14px;
  display: block;
}

.retry-button img {
  width: 14px;
  height: 14px;
}
.floating-button .camera-icon {
  width: 20px;
  height: 20px;
}
.button-text {
  margin-left: 4px;
}
</style>
