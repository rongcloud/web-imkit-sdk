<template>
  <component
    :is="hqVoiceMessageTag"
    :duration="componentProps.duration"
    :is-owner="componentProps.isOwner"
    :playing="componentProps.playing"
    :position="componentProps.position"
    :progress="componentProps.progress"
    :toggle="componentProps.toggle">
  ></component>
</template>

<script setup lang="ts">
import {
  onMounted, onUnmounted, reactive, ref,
} from 'vue';
import { MessageDirection } from '@rongcloud/imlib-next';
import { ctx, getOverrideAbleComponentTag } from './context';
import { AudioPlayEvent, AudioPlayState, InnerEvent } from '../../core/EventDefined';
import { IRCKitHQVoiceMessageComponentProps, OverrideAbleComponentTagInner } from '../override-able';
import { IRCKitMessageComponentProps } from '../interface';

const context = ctx();
const hqVoiceMessageTag = getOverrideAbleComponentTag(OverrideAbleComponentTagInner.HQVoiceMessageComponent);
const props = defineProps<IRCKitMessageComponentProps>();

const { message } = props;
const msgContent = message.content;
const { duration } = msgContent;
const { remoteUrl } = msgContent;
const progress = ref(0);
const playing = ref(false);
const isOwner: boolean = message.messageDirection === MessageDirection.SEND;

const onAudioPlay = (evt: AudioPlayEvent) => {
  parseAudioState(evt.data);
};

const parseAudioState = (data: AudioPlayState) => {
  const {
    status, progress: p, messageUId, transactionId,
  } = data;
  const { messageUId: cUid, transactionId: cTid } = message;

  if ((cUid && cUid === messageUId) || (transactionId && transactionId === cTid)) {
    playing.value = status === 'playing';
    // 播放进度
    progress.value = p === 100 ? 0 : (p || 0);
    return;
  }

  // 清理非当前播放的音频消息状态
  progress.value = 0;
  playing.value = false;
};

const onToggle = () => {
  if (playing.value) {
    context.audioPlayer.pause();
  } else {
    context.audioPlayer.play(remoteUrl, props.message.messageUId, props.message.transactionId);
  }
};

const componentProps: IRCKitHQVoiceMessageComponentProps = reactive({
  duration,
  isOwner,
  playing,
  progress,
  position: props.position,
  toggle: onToggle,
});

onMounted(() => {
  context.addEventListener(InnerEvent.AUDIO_PLAY_EVENT, onAudioPlay);
  const data = context.audioPlayer.getCurrentState();
  parseAudioState(data);
});

onUnmounted(() => {
  context.removeEventListener(InnerEvent.AUDIO_PLAY_EVENT, onAudioPlay);
});

</script>
