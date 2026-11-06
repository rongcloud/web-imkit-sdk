<template>
  <div class="panel" @mousedown.prevent>
    <button v-for="emoji in emojis" :key="emoji" type="button" @click.stop="emit('select', emoji)">{{ emoji }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ctx } from './context';

const context = ctx();
const emojis = computed(() => context.input.chatEmojis.chats);
const emit = defineEmits<{(event: 'select', emoji: string): void}>();
</script>

<style>
:host {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.panel {
  display: grid;
  grid-template-columns: repeat(auto-fill, 32px);
  grid-auto-rows: 32px;
  justify-content: center;
  align-content: start;
  gap: 4px;
  padding: 8px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  background: #fff;
  border-radius: 9px;
  box-shadow: 0 5px 16px #00000014;
}
button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 20px;
  border-radius: 6px;
  cursor: pointer;
}
button:hover { background: #F2F3F5; }
</style>
