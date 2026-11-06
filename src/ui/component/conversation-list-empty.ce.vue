<!-- 会话列表未选中时，左侧的展示组件 -->
<template>
  <div class="empty">
    <img :src="CONVERSATION_EMPTY_ICON" alt="Conversation Empty">
    <span>{{ desc }}</span>
  </div>
</template>

<script setup lang="ts">
import { CONVERSATION_EMPTY_ICON } from '../../assets';

defineProps({
  desc: {
    type: String,
    required: true,
  },
});
</script>

<style>
.empty {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  line-height: 24px;
  background: #FFFFFF;
  color: #b3b3b3;
  font-size: 16px;
}
.empty img {
  margin-bottom: 10px;
  width: 60px;
  height: 60px;
}
</style>
