<template>
  <div>
    <div class="voice" :class="{ 'is-quote': isQuote }">
      <img :src="btnIcon" alt="Button Icon" class="control" @click="toggle()" />
      <div class="progress">
        <div class="line" v-for="(item, index) in processLines"
          :style="{height: item + 'px'}"
          :class="{active: runIndex >= index}">
        </div>
      </div>
      <div class="time">{{ duration }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { AUDIO_RUN_ICON, AUDIO_STOP_ICON } from '../../../assets';
import { IRCKitHQVoiceMessageComponentProps } from './IRCKitHQVoiceMessageComponentProps';

const props = defineProps<IRCKitHQVoiceMessageComponentProps>();
const isQuote = props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO;
/**
 * 获取时间长度, 单位 s
 */
const formatTimeLength = (time: number): string => `${Math.max(0, Math.floor(time))}s`;

const duration = computed(() => formatTimeLength(props.duration));

/**
 * 按钮图标
 */
const stopIcon = AUDIO_STOP_ICON;
const runIcon = AUDIO_RUN_ICON;
/**
 * 进度条颜色
 */
const lineColor = props.isOwner ? '#FFF' : '#0099FF';
/**
 * 进度条
 */
const processLines = new Array(20).fill(0).map((item) => (Math.floor(Math.random() * 9) + 3) * 2);

/**
 * 进度条运行索引
 */
const runIndex = computed(() => Math.floor(props.progress / 100 * 20) || -1);
const btnIcon = computed(() => (props.playing ? runIcon : stopIcon));

</script>
<style lang="scss">
.voice {
  display: flex;
  align-items: center;
  gap: 10px;

  &.is-quote {
    gap: 6px;
  }

  .control {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }

  &.is-quote .control {
    width: 16px;
    height: 16px;
  }

  .progress {
    height: 22px;
    display: flex;
    align-items: center;
    .line {
      margin-right: 4px;
      width: 3px;
      border-radius: 3px;
      animation: bounce-in 2s;
      background: #020814;

      &.active {
        transition: all 0.5s;
        background: #0047FF;
      }
    }
  }

  &.is-quote .progress {
    height: 16px;
    .line {
      margin-right: 2px;
      width: 2px;
    }
  }

  .time {
    font-size: 14px;
  }

  &.is-quote .time {
    font-size: 12px;
  }
}
</style>
