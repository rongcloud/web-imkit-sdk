<template>
  <div class="rc-kit-location" :class="{
    'top': props.direction === 0,
    'bottom': props.direction === 1,
    }">
    <div v-if="props.direction === 0" class="forward-icon" @click="emit('location')">
      <img style="transform: rotate(180deg);" :src="TRIANGLE_ICON" alt="TRIANGLE_ICON">
    </div>
    <div class="count">{{ props.count }}</div>
    <div v-if="props.direction === 1" class="forward-icon" @click="emit('location')">
      <img :src="TRIANGLE_ICON" alt="TRIANGLE_ICON">
    </div>
  </div>
</template>

<script setup lang="ts">
import { TRIANGLE_ICON } from '../../assets';

const props = defineProps({
  count: {
    type: Number,
    require: true,
  },
  direction: {
    type: Number,
    require: true,
  },
});
const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();
</script>

<style>
.rc-kit-location {
  position: absolute;

  right: 16px;
  background-color: #FFFFFF;
  /* padding: 3px; */
  border-radius: 20px;
}
.rc-kit-location.top {
  top: 30px;
}
.rc-kit-location.bottom{
  bottom: 30px;
}
.rc-kit-location div {
  font-size: 16px;
  line-height: 33px;
  text-align: center;
  width: 33px;
  height: 33px;
  border-radius: 50%;
  box-sizing: border-box;
  margin: 3px;
  overflow: hidden;
}
.rc-kit-location .count {
  color: #FFFFFF;
  background-color: #0099FF;
}
.rc-kit-location .forward-icon {
  border: 1px solid #0099FF;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
