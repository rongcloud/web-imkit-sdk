<template>
  <div class="rc-multi-choice-menu" :class="{ 'is-h5': isH5 }" style="height: 100px;">
    <div @click="_emit('cancel')" class="button cancel" @mouseenter="isCancelHover = true" @mouseleave="isCancelHover = false">
      <div class="icon-wrapper">
        <img :src="isCancelHover ? MULTI_CHOICE_MENU_CANCEL_BUTTON_HOVER_ICON : MULTI_CHOICE_MENU_CANCEL_ICON" alt="Cancel">
      </div>
    </div>
    <span v-if="!isH5" class="selected-count">{{ message }}</span>
    <!-- <div @click="emit('merge-forward')" class="button">{{ mergedLabel }}</div> -->
    <div @click="emit('forward')" class="button forward" :class="{ disabled: props.count === 0 }" @mouseenter="isForwardHover = true" @mouseleave="isForwardHover = false">
      <div class="icon-wrapper">
        <img :src="isForwardHover && props.count > 0 ? MSG_MENU_FORWARD_HOVER_ICON : MSG_MENU_FORWARD_ICON" alt="Forward" :style="{ opacity: props.count === 0 ? 0.4 : 1 }">
      </div>
      <span v-if="!isH5" class="button-label">{{ forwardLabel }}</span>
    </div>
    <div @click="emit('delete')" class="button delete" :class="{ disabled: props.count === 0 }" @mouseenter="isDeleteHover = true" @mouseleave="isDeleteHover = false">
      <div class="icon-wrapper">
        <img :src="isDeleteHover && props.count > 0 ? MSG_MENU_DELETE_HOVER_ICON : MSG_MENU_DEELTE_ICON" alt="Delete" :style="{ opacity: props.count === 0 ? 0.4 : 1 }">
      </div>
      <span v-if="!isH5" class="button-label">{{ deleteLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { $tt, $t } from '../i18n-vue';
import {
  MULTI_CHOICE_MENU_CANCEL_ICON,
  MULTI_CHOICE_MENU_CANCEL_BUTTON_HOVER_ICON,
  MSG_MENU_FORWARD_ICON,
  MSG_MENU_FORWARD_HOVER_ICON,
  MSG_MENU_DEELTE_ICON,
  MSG_MENU_DELETE_HOVER_ICON,
} from '../../assets';

const isCancelHover = ref(false);
const isForwardHover = ref(false);
const isDeleteHover = ref(false);

const props = defineProps({
  count: {
    type: Number,
    required: true,
  },
  isH5: {
    type: Boolean,
    default: false,
  },
});

const _emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const emit = (type: string) => {
  if (props.count === 0) {
    return;
  }
  _emit(type);
};

const message = computed(() => $tt('multi-choice.menu.selected-count', props.count.toString()));
// const mergedLabel = $t('multi-choice.menu.merge-forward');
const forwardLabel = $t('multi-choice.menu.forward-item-by-item');
const deleteLabel = $t('multi-choice.menu.delete');

</script>

<style>
.rc-multi-choice-menu {
  height: 50px;
  background-color: #fff;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #E4E7ED;
  font-size: 14px;
  color: #000000;
  padding: 0 16px;
}
.selected-count {
  flex: 1 auto;
  margin-left: 24px;
}
.button {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  margin-left: 32px;
}
.button.disabled {
  cursor: not-allowed;
}
.button.disabled .button-label {
  color: #c4c4c4;
}
.button:first-child {
  margin-left: 0;
}
.icon-wrapper {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background-color: transparent;
  transition: background-color 0.2s;
  background-color: #F3F5FA;
  margin-bottom: 4px;
}
.button img {
  width: 20px;
  height: 20px;
}

.cancel .icon-wrapper{
  background-color: #FFFFFF;
  width: 30px;
  height: 30px;
}
.button.forward:hover .icon-wrapper {
  background-color: #D0DDFF;
}
.button.delete:hover .icon-wrapper {
  background-color: #FFE5E5;
}
.button.cancel:hover .icon-wrapper {
  background-color: #D0DDFF;
}

.rc-multi-choice-menu.is-h5 .forward {
  margin-left: auto;
}

.rc-multi-choice-menu.is-h5 .icon-wrapper {
  margin-bottom: 0;
}

</style>
