<template>
  <div class="emoji-pannel-root" @click="$event.stopPropagation()">
    <div class="menu-list">
      <div v-for="item in menu" :key="item.index" @click="selected = item.index"
        :class="item.index === selected ? 'menu-button menu-button-selected' : 'menu-button'">
        <img :src="item.icon" alt="Emoji"/>
      </div>
    </div>
    <div class="emoji-list">
      <!-- Emoji 表情 -->
      <div v-show="selected === 0" class="chat-emoji-item" v-for="item in chats.chats" @click="emit('insert-chat', item);">
        <span>{{ item }}</span>
      </div>
      <div v-if="selected > 0" class="image-emoji-item" v-for="(item, index) in images"
        @click="emit('send-image', item)"
        :key="index"
        :style="`width: ${item.width}px; height: ${item.height}px;`">
        <img :src="item.thumbnail" :width="item.width" :height="item.height" alt="Emoji"/>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref,
} from 'vue';
import { ctx } from './context';
import { IRCKitImageEmojiLibrary, IRCKitImageEmoji } from '../../modules/InputModule';

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const context = ctx();
const libraries = ref<IRCKitImageEmojiLibrary[]>([]);
const chats = context.input.cloneChatEmojiLibrary();

const selected = ref(0);
const menu = computed(() => [{ icon: chats.icon, index: 0 }].concat(...libraries.value.map((item, index) => ({ icon: item.icon, index: index + 1 }))));

const images = computed<Array<IRCKitImageEmoji & { width: number, height: number }>>(() => {
  if (selected.value === 0) {
    return [];
  }
  const library = libraries.value[selected.value - 1];
  const { itemWidth, itemHeight, items } = library;
  return items.map((item) => ({
    width: itemWidth,
    height: itemHeight,
    thumbnail: item.thumbnail,
    url: item.url,
    gif: item.gif,
  }));
});

onMounted(() => {
  libraries.value = context.input.cloneImageEmojiLibraries();
});
onUnmounted(() => {

});
</script>

<style>
.emoji-pannel-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.menu-list {
  height: 48px;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0 8px;
}
.menu-button {
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 5px;
  margin-left: 10px;
}
.menu-button-selected {
  background-color: #e9f0fb;
}
.menu-button img {
  width: 28px;
  height: 28px;
  margin: 2px;
}
.emoji-list {
  flex: 1;
  overflow: auto;
  padding: 4px 8px;
}
.chat-emoji-item {
  display: inline-block;
  font-size: 22px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  text-align: center;
  line-height: 30px;
  border-radius: 4px;
}
.chat-emoji-item:hover, .image-emoji-item:hover {
  background-color: #e9f0fb;
}

.image-emoji-item {
  display: inline-block;
  padding: 6px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
