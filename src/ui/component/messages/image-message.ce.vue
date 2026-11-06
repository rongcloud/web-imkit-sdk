<template>
  <div class="image-message-wrapper">
    <rc-file-transfer-ctrl-provider :message="message" :position="position">
      <img class="thumbnail" :class="{ 'is-quote': isQuote }" :src="formatBase64Image(message.content.content)" alt="Image" @load="handleImageLoad" @error="handleImageError"/>
      <div slot="marked" class="marked"></div>
    </rc-file-transfer-ctrl-provider>
  </div>
</template>

<script setup lang="ts">
import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { IRCKitMessageComponentProps, RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { ctx } from '@lib/ui/provider/context';
import { formatBase64Image } from '../../../helper';

const props = defineProps<IRCKitMessageComponentProps>();
const isQuote = props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO;

const adjustMessageListScroll = () => {
  // Safari 上图片实际高度可能晚于消息插入完成，图片就绪后通知列表重新校正一次底部位置。
  ctx().dispatch(new RCKitEvent(InnerEvent.ADJUST_MESSAGE_LIST_SCROLL));
};

const handleImageLoad = () => {
  adjustMessageListScroll();
};

const handleImageError = () => {
  adjustMessageListScroll();
};
</script>

<style>
:host {
  /* 用 block 让内部容器拿到确定的包含块宽度，百分比 max-width 才能生效 */
  display: block;
  max-width: 100%;
}

.image-message-wrapper {
  display: block;
  max-width: 100%;
}

.thumbnail, .marked {
  width: 247px;
  max-width: 100%;
  max-height: 400px;
  height: auto;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid #E4E7ED
}

.thumbnail.is-quote {
  width: auto;
  max-width: 100%;
  max-height: 30px;
  border-radius: 4px;
}

.marked {
  background-color: rgba(0, 0, 0, .6);
  height: 100%;
}
</style>
