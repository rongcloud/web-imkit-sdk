<template>
  <div class="at-users-panel" @click="$event.stopPropagation()">
    <div class="div-item" v-if="atAll" @click="emit('at-all')">
      {{ atAllLabel }}
    </div>
    <div class="div-item" v-for="item in members" :key="item.userId" @click="emit('at-user', item.userId)">
      <img v-if="item.portraitUri" class="icon" :src="item.portraitUri" alt="User Portrait"/>
      <span>{{ item.nickname || item.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { $t } from '../i18n-vue';

const atAllLabel = $t('conv.mentioned.all.msg');
const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

type AtUser = {
  name: string
  nickname?: string,
  userId: string
  portraitUri: string
}

defineProps<{
  members: AtUser[],
  atAll: boolean
}>();
</script>

<style>
.at-users-panel {
  width: 100%;
  align-items: center;
  max-height: 124px;
  overflow: scroll;
  border-top: 1px solid #efefef;
}

.div-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 8px 20px;
  cursor: pointer;
  font-size: 12px;
}

.div-item:hover {
  background-color: #e9f0fb;
  border-radius: 8px;
}

.icon {
  margin-right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
</style>
