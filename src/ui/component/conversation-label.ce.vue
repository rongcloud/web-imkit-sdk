<template>
  <div class="rc-conversation-label">
    {{ props.name }}
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  name: string
}>();
</script>
<style>
.rc-conversation-label {
  color: #41464F;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
</style>
