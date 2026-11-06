<template>
  <div class="content">
    <!-- 内容填充区域 -->
    <slot></slot>
    <!-- 遮罩 -->
    <div class="marked" v-if="downloadVisible || retryVisible || processVisible">
      <slot name="marked"></slot>
    </div>
    <!-- 下载按钮 -->
    <div v-if="downloadVisible" class="btn" @click.stop="handleDownload">
      <svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle opacity="0.5" cx="11.5437" cy="10.7852" r="7" fill="black" />
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M14.4617 9.54688L11.5749 14.5469L8.68817 9.54687L11.0749 9.54687L11.0749 6.66123L12.0749 6.66123L12.0749 9.54687L14.4617 9.54688Z"
          fill="white" />
        <mask id="path-3-outside-1_2560_1087" maskUnits="userSpaceOnUse" x="1.74341" y="0.96875" width="20" height="20"
          fill="white">
          <rect fill="white" x="1.74341" y="0.96875" width="20" height="20" />
          <path
            d="M20.344 10.7691C20.344 15.6293 16.404 19.5694 11.5437 19.5694C6.68344 19.5694 2.74341 15.6293 2.74341 10.7691C2.74341 5.90878 6.68344 1.96875 11.5437 1.96875C16.404 1.96875 20.344 5.90878 20.344 10.7691ZM4.33424 10.7691C4.33424 14.7507 7.56203 17.9785 11.5437 17.9785C15.5254 17.9785 18.7532 14.7507 18.7532 10.7691C18.7532 6.78737 15.5254 3.55958 11.5437 3.55958C7.56203 3.55958 4.33424 6.78737 4.33424 10.7691Z" />
        </mask>
        <path
          d="M20.344 10.7691C20.344 15.6293 16.404 19.5694 11.5437 19.5694C6.68344 19.5694 2.74341 15.6293 2.74341 10.7691C2.74341 5.90878 6.68344 1.96875 11.5437 1.96875C16.404 1.96875 20.344 5.90878 20.344 10.7691ZM4.33424 10.7691C4.33424 14.7507 7.56203 17.9785 11.5437 17.9785C15.5254 17.9785 18.7532 14.7507 18.7532 10.7691C18.7532 6.78737 15.5254 3.55958 11.5437 3.55958C7.56203 3.55958 4.33424 6.78737 4.33424 10.7691Z"
          fill="white" fill-opacity="0.6" />
        <path
          d="M20.344 10.7691C20.344 15.6293 16.404 19.5694 11.5437 19.5694C6.68344 19.5694 2.74341 15.6293 2.74341 10.7691C2.74341 5.90878 6.68344 1.96875 11.5437 1.96875C16.404 1.96875 20.344 5.90878 20.344 10.7691ZM4.33424 10.7691C4.33424 14.7507 7.56203 17.9785 11.5437 17.9785C15.5254 17.9785 18.7532 14.7507 18.7532 10.7691C18.7532 6.78737 15.5254 3.55958 11.5437 3.55958C7.56203 3.55958 4.33424 6.78737 4.33424 10.7691Z"
          stroke="white" stroke-opacity="0.2" stroke-width="1.04019" mask="url(#path-3-outside-1_2560_1087)" />
      </svg>
    </div>
    <!-- 上传重试按钮，仅上传失败时显示，点击后重新上传 -->
    <div v-if="retryVisible" class="btn" @click.stop="handleRetry">
      <svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle opacity="0.5" cx="11.6465" cy="10.7852" r="10.7383" transform="rotate(-180 11.6465 10.7852)"
          fill="black" />
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M8.72876 12.0234L11.6155 7.02344L14.5023 12.0234L12.1155 12.0234L12.1155 14.9091L11.1155 14.9091L11.1155 12.0234L8.72876 12.0234Z"
          fill="white" />
        <mask id="path-3-outside-1_2560_1183" maskUnits="userSpaceOnUse" x="1.44678" y="0.601561" width="20" height="20"
          fill="black">
          <rect fill="white" x="1.44678" y="0.601561" width="20" height="20" />
          <path
            d="M2.84616 10.8013C2.84616 5.94098 6.78619 2.00094 11.6465 2.00094C16.5067 2.00094 20.4468 5.94098 20.4468 10.8013C20.4468 15.6615 16.5067 19.6016 11.6465 19.6016C6.78619 19.6016 2.84616 15.6615 2.84616 10.8013ZM18.8559 10.8013C18.8559 6.81957 15.6282 3.59177 11.6465 3.59177C7.66478 3.59177 4.43699 6.81957 4.43699 10.8013C4.43699 14.7829 7.66478 18.0107 11.6465 18.0107C15.6282 18.0107 18.8559 14.7829 18.8559 10.8013Z" />
        </mask>
        <path
          d="M2.84616 10.8013C2.84616 5.94098 6.78619 2.00094 11.6465 2.00094C16.5067 2.00094 20.4468 5.94098 20.4468 10.8013C20.4468 15.6615 16.5067 19.6016 11.6465 19.6016C6.78619 19.6016 2.84616 15.6615 2.84616 10.8013ZM18.8559 10.8013C18.8559 6.81957 15.6282 3.59177 11.6465 3.59177C7.66478 3.59177 4.43699 6.81957 4.43699 10.8013C4.43699 14.7829 7.66478 18.0107 11.6465 18.0107C15.6282 18.0107 18.8559 14.7829 18.8559 10.8013Z"
          fill="black" fill-opacity="0.6" />
        <path
          d="M2.84616 10.8013C2.84616 5.94098 6.78619 2.00094 11.6465 2.00094C16.5067 2.00094 20.4468 5.94098 20.4468 10.8013C20.4468 15.6615 16.5067 19.6016 11.6465 19.6016C6.78619 19.6016 2.84616 15.6615 2.84616 10.8013ZM18.8559 10.8013C18.8559 6.81957 15.6282 3.59177 11.6465 3.59177C7.66478 3.59177 4.43699 6.81957 4.43699 10.8013C4.43699 14.7829 7.66478 18.0107 11.6465 18.0107C15.6282 18.0107 18.8559 14.7829 18.8559 10.8013Z"
          stroke="white" stroke-opacity="0.2" stroke-width="1.04019" mask="url(#path-3-outside-1_2560_1183)" />
      </svg>
    </div>
    <!-- 上传进度条 & 上传取消按钮 -->
    <div class="btn" v-if="processVisible" @click.stop="handleCancel">
      <svg width="23" height="23" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle opacity="0.5" cx="11.605" cy="11.7227" r="10.7383" fill="black" />
        <mask id="path-2-outside-1_2560_1174" maskUnits="userSpaceOnUse" x="1.80469" y="1.90625" width="20" height="20"
          fill="black">
          <rect fill="white" x="1.80469" y="1.90625" width="20" height="20" />
          <path
            d="M20.4053 11.7066C20.4053 16.5668 16.4653 20.5069 11.605 20.5069C6.74472 20.5069 2.80469 16.5668 2.80469 11.7066C2.80469 6.84628 6.74472 2.90625 11.605 2.90625C16.4653 2.90625 20.4053 6.84628 20.4053 11.7066ZM4.39552 11.7066C4.39552 15.6882 7.62331 18.916 11.605 18.916C15.5867 18.916 18.8145 15.6882 18.8145 11.7066C18.8145 7.72487 15.5867 4.49708 11.605 4.49708C7.62331 4.49708 4.39552 7.72487 4.39552 11.7066Z" />
        </mask>
        <path
          d="M20.4053 11.7066C20.4053 16.5668 16.4653 20.5069 11.605 20.5069C6.74472 20.5069 2.80469 16.5668 2.80469 11.7066C2.80469 6.84628 6.74472 2.90625 11.605 2.90625C16.4653 2.90625 20.4053 6.84628 20.4053 11.7066ZM4.39552 11.7066C4.39552 15.6882 7.62331 18.916 11.605 18.916C15.5867 18.916 18.8145 15.6882 18.8145 11.7066C18.8145 7.72487 15.5867 4.49708 11.605 4.49708C7.62331 4.49708 4.39552 7.72487 4.39552 11.7066Z"
          fill="black" fill-opacity="0.6" />
        <path
          d="M20.4053 11.7066C20.4053 16.5668 16.4653 20.5069 11.605 20.5069C6.74472 20.5069 2.80469 16.5668 2.80469 11.7066C2.80469 6.84628 6.74472 2.90625 11.605 2.90625C16.4653 2.90625 20.4053 6.84628 20.4053 11.7066ZM4.39552 11.7066C4.39552 15.6882 7.62331 18.916 11.605 18.916C15.5867 18.916 18.8145 15.6882 18.8145 11.7066C18.8145 7.72487 15.5867 4.49708 11.605 4.49708C7.62331 4.49708 4.39552 7.72487 4.39552 11.7066Z"
          stroke="white" stroke-opacity="0.2" stroke-width="1.04019" mask="url(#path-2-outside-1_2560_1174)" />
        <!-- 进度条 -->
        <circle class="progress-bar" cx="11.605" cy="11.7227" :r="radius" fill="none" stroke="white" stroke-width="1.9"
          :stroke-dasharray="circleLen" :stroke-dashoffset="dashoffset" transform="rotate(-90, 11.605, 11.7227)"/>
        <rect x="13.905" y="8.1875" width="1.74414" height="8.24933" transform="rotate(45 13.905 8.1875)" fill="white" />
        <rect x="8.07178" y="9.42188" width="1.74414" height="8.24933" transform="rotate(-45 8.07178 9.42188)"
          fill="white" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SentStatus } from '@rongcloud/engine';
import { MessageType } from '@rongcloud/imlib-next';

import { RCKitEvent } from '@lib/core/RCKitEvent';
import { RCKitEvents } from '@lib/core/EventDefined';
import { createAuthorizedDownloadMessage } from '@lib/helper/download';
import { IRCKitMessageComponentProps, RCKitMessageComponentRenderPosition } from '../interface';
import { ctx } from './context';

// 使用解构赋值从 defineProps 中提取属性并进行解构赋值操作时，会导致失去响应式。影响 computed 进行计算
const props = defineProps<IRCKitMessageComponentProps>();

const downloadVisible = computed(() => {
  // 如果是引用状态，不显示下载按钮
  if (props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO) {
    return false;
  }
  return props.message.messageType === MessageType.FILE
    && props.message.sentStatus !== SentStatus.SENDING && props.message.sentStatus !== SentStatus.FAILED;
});

const retryVisible = computed(() => props.message.file && props.message.progress === -1);

const processVisible = computed(() => props.message.file && typeof props.message.progress === 'number' && props.message.progress >= 0 && props.message.progress < 100);

const radius = 8;
const circleLen = Math.floor(2 * Math.PI * radius);

const dashoffset = computed(() => {
  const value = props.message.progress || 0;
  return (100 - value) * circleLen / 100;
});

const handleDownload = async () => {
  // TODO: 使用浏览器下载，后续需考虑 Electron 平台拓展性
  const message = await createAuthorizedDownloadMessage(props.message);
  if (message) {
    ctx().emit(new RCKitEvent(RCKitEvents.DOWNLOAD_LINK_EVENT, message));
  }
};

const handleCancel = () => ctx().message.cancelMessageSent(props.message);
const handleRetry = () => ctx().message.resendMessage(props.message);
</script>

<style>
:host {
  display: inline-block;
  vertical-align: bottom;
  /* 宽度必须逐层确定：任何一层是 auto 宽度的 inline-block，后代的 max-width: 100% 都会失效，
     固定尺寸的图片/GIF 就会溢出气泡并盖住头像。 */
  width: 100%;
  max-width: 100%;
}

.content {
  position: relative;
  display: inline-block;
  width: auto;
  height: auto;
  line-height: 0;
  max-width: 100%;
}
.marked {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  height: 22px;
  cursor: pointer;
}
</style>
