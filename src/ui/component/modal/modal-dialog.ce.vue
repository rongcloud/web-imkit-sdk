<template>
  <div
    @click="(e: Event) => e.stopPropagation()"
    :style="dialogStyle"
    class="rc-kit-modal-dialog"
  >
    <slot name="header"></slot>
  <slot name="content"> </slot>
  <slot name="footer"></slot>
</div>
</template>
<script setup lang="ts">
import {
  ref, onMounted, onUnmounted, computed,
} from 'vue';
import { isMobileDevice } from '../../../helper';

const props = defineProps({
  width: {
    type: Number,
  },
  height: {
    type: Number,
    default: -1,
  },
  mobileFullWidth: {
    type: Boolean,
    default: false,
  },
});

const isH5 = ref(false);

const dialogStyle = computed(() => {
  let width = `${props.width}px`;
  if (isH5.value) {
    width = props.mobileFullWidth ? '100%' : '80%';
  }

  const style: any = {
    width,
    margin: isH5.value ? '0 auto' : '',
  };

  if (props.height !== -1) {
    style.height = `${props.height}px`;
  }

  return style;
});

const checkDevice = () => { isH5.value = isMobileDevice(); };

onMounted(() => {
  checkDevice();
  window.addEventListener('resize', checkDevice);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkDevice);
});
</script>
<style>
.rc-kit-modal-dialog {
  background-color: #fff;
  border-radius: 5px;
}

@media (max-width: 768px) {
  :host([mobile-full-width]) {
    display: block;
    width: 100%;
  }
}
</style>
