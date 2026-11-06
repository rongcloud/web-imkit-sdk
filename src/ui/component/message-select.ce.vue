<template>
  <div class="rc-kit-select" >
    <span class="line"></span>
    <span class="btn" @click="emit('select')">{{ msg }}</span>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue';
import { $tt } from '../i18n-vue';

const props = defineProps<{
  selected: boolean | null
}>();

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const msg = computed(() => (props.selected ? $tt('message.list.select') : $tt('message.list.unselect')));

</script>

<style>
.rc-kit-select .line {
  display: block;
  width: 100%;
  border: 1px dashed #E4E7ED;
}
.rc-kit-select .btn {
  position: absolute;
  padding: 0 12px;
  line-height: 34px;
  color: #41464F;
  background-color: #E3E7EF;
  border-radius: 10px;
  font-size: 14px;
  display: inline-block;
  margin-left: 68px;
  z-index: 2;
  top: -16px;
  cursor: pointer;
}

</style>
