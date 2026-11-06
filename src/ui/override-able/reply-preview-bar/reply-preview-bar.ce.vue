<template>
  <div class="replay-bar">
    <div class="content">
      <div class="cancel-btn" @click="props.cancel()" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
        <img :src="isHovered ? MULTI_CHOICE_MENU_CANCEL_HOVER_ICON : MULTI_CHOICE_MENU_CANCEL_ICON" alt="Cancel">
      </div>
      <div class="message-desc">
        <div class="desc">
          <span class="reply-prefix">{{ reply }}:</span>
          <span class="desc-text">{{ props.previewText }}</span>
          <span v-if="isEdited" class="edited">({{ $tt('message.edit.edited') }})</span>
          <img class="thumbnail" v-if="props.thumbnail" :src="props.thumbnail">
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { getSuccessfulEditTimestamp } from '@lib/modules/message-editing';
import { $t, $tt } from '../../i18n-vue';
import { MULTI_CHOICE_MENU_CANCEL_ICON, MULTI_CHOICE_MENU_CANCEL_HOVER_ICON } from '../../../assets';
import { IRCKitReplyPreviewBarComponentProps } from './IRCKitReplyPreviewBarComponentProps';

const props = defineProps<IRCKitReplyPreviewBarComponentProps>();
const isHovered = ref(false);

const reply = computed(() => $t('input.reply.prefix').value + props.username);
const isEdited = computed(() => !!getSuccessfulEditTimestamp(props.message));

</script>
<style>
.replay-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 8px;
  height: 36px;
  padding-top: 8px;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.content {
  min-width: 0;
  margin-left: 8px;
  box-sizing: border-box;
  width: calc(100% - 50px - 16px);
  flex: 1;
  display: flex;
  height: 100%;
  background-color: #F3F5FA;
  border-radius: 10px;
  font-size: 14px;
  color: #020814;
}

.message-desc {
  min-width: 0;
  flex: 1;
  display: flex;
  box-sizing: border-box;
  flex-direction: column;
  justify-content: center;
  width: calc(100% - 120px);
  padding-right: 10px;
  margin-left: 4px;
  overflow: hidden;
}

.username {
  color: #0099ff;
  margin-bottom: 2px;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.desc {
  color: #020814;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
}

.reply-prefix {
  flex-shrink: 0;
}

.desc-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edited {
  flex-shrink: 0;
  color: #7C838E;
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
}

.thumbnail {
  flex-shrink: 0;
  height: 24px;
  width: auto;
  max-width: 100px;
  border: none;
  padding: 0;
  box-sizing: border-box;
  object-fit: contain;
  vertical-align: middle;
}

.cancel-btn {
  display: flex;
  width: 24px;
  margin-left: 10px;
  flex-direction: column;
  justify-content: center;
  vertical-align: middle;
  cursor: pointer;
}

.cancel-btn img {
  border-radius: 8px;
}

.cancel-btn svg path {
    fill: #0E1012;
    stroke: #0E1012;
}
</style>
