<template>
  <div class="gif-message-container">
    <rc-file-transfer-ctrl-provider :message="props.message" :position="position">
      <div class="gif-message-box" :class="{ 'is-quote': isQuote }">
        <img :src="imageUrl" :onerror="handleError" @load="handleLoad" alt="Git Image"/>
      </div>
    </rc-file-transfer-ctrl-provider>
  </div>
</template>
<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { IMAGE_FAILED } from '@lib/assets/index';
import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { getAuthorizedDownloadUrl } from '@lib/helper/download';
import { IRCKitMessageComponentProps, RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { ctx } from '@lib/ui/provider/context';

const props = defineProps<IRCKitMessageComponentProps>();
const imageUrl = ref<string>();
const isQuote = props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO;

const adjustMessageListScroll = () => {
  // GIF 首帧解码和最终布局也可能晚于消息插入完成，这里在媒体状态变化后补一次滚动校正。
  ctx().dispatch(new RCKitEvent(InnerEvent.ADJUST_MESSAGE_LIST_SCROLL));
};

const handleLoad = () => {
  adjustMessageListScroll();
};

const handleError = () => {
  imageUrl.value = IMAGE_FAILED;
  adjustMessageListScroll();
};

let requestId = 0;
watch(() => props.message.content.remoteUrl, async (url) => {
  const currentRequestId = ++requestId;
  const authorizedUrl = await getAuthorizedDownloadUrl(url);
  if (currentRequestId !== requestId) {
    return;
  }
  if (!authorizedUrl) {
    handleError();
    return;
  }
  imageUrl.value = authorizedUrl;
}, { immediate: true });

onUnmounted(() => {
  requestId += 1;
});

</script>
<style lang="scss">
:host {
  display: block;
  max-width: 100%;
}

.gif-message-container {
  display: block;
  max-width: 100%;
}

.gif-message-box {
  width: 247px;
  max-width: 100%;
  height: auto;
  /* 宽度被窄屏压缩时高度同步收缩，避免出现非方形的留白/变形 */
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  border: 1px solid #E4E7ED;
  overflow: hidden;
}

.gif-message-box > img {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  object-fit: contain;
}

.gif-message-box.is-quote {
  width: auto;
  height: 30px;
  aspect-ratio: auto;
  max-width: 100%;
  border-radius: 4px;

  > img {
    display: block;
    width: auto;
    height: 100%;
    object-fit: contain;
  }
}
</style>
