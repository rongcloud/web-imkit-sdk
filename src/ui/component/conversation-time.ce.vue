<template>
  <div class="rc-conversation-time">
    <span>{{ props.time}}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  time: string
}>();
</script>
<style>
.rc-conversation-time {
  color: #A1A1A1;
  font-weight: 400;
  font-size: 12px;
  line-height: 19px;
  flex: 1;
  text-align: right;
}
</style>
