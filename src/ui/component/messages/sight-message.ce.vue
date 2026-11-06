<template>
  <div class="sight-message-container">
    <rc-file-transfer-ctrl-provider :message="message" :position="position">
      <div class="rc-kit-sight-message" :class="{ 'is-quote': isQuote }">
        <div class="wraper">
          <img :src="'data:image/png;base64,' + message.content.content" :alt="message.content.name"  :onerror="handleImageError" @load="handleImageLoad" />
          <div class="sight-mask" v-if="!isQuote && isSent">
            <img class="play-icon" :src="PLAY_ICON" />
          </div>
          <span class="time" v-if="!isQuote">{{ formatTimeLength(Math.floor(message.content.duration)) }}</span>
        </div>
      </div>
      <div slot="marked"></div>
    </rc-file-transfer-ctrl-provider>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SentStatus } from '@rongcloud/imlib-next';
import { IRCKitMessageComponentProps, RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { PLAY_ICON } from '@lib/assets/index';
import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { ctx } from '@lib/ui/provider/context';
import { formatTimeLength } from '../../../helper';

const props = defineProps<IRCKitMessageComponentProps>();
const isQuote = props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO;

const isSent = computed(() => props.message.sentStatus === SentStatus.SENT);

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

<style lang="scss">
:host {
  display: block;
  width: fit-content;
  max-width: 100%;
}

.sight-message-container {
  display: block;
  max-width: 100%;
}

.rc-kit-sight-message {
  text-align: left;
}

.rc-kit-sight-message.is-quote {
  .wraper {
    > img {
      max-width: 100%;
      max-height: 30px;
      border-radius: 4px;
    }
  }
}

.wraper {
  position: relative;
  display: block;
  // 固定上限也参与气泡的内容宽度计算，避免百分比尚未解析时被缩略图原始宽度撑开。
  max-width: 200px;
  .time {
    position: absolute;
    bottom: 8px;
    right: 6px;
    color: #fff;
    font-size: 14px;
    z-index: 2;
  }

  > img {
    display: block;
    max-width: 100%;
    height: auto;
    box-sizing: border-box;
    border-radius: 10px;
    border: 1px solid #E4E7ED;
  }

  .sight-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #00000080;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 10px;
    z-index: 1;

    .play-icon {
      width: 36px;
      height: 36px;
      border: none;
    }
  }
}
.marked {
  background-color: rgba(0, 0, 0, .6);
  height: 100%;
}
</style>
