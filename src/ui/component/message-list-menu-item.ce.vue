<template>
  <div class="rc-message-list-menu-item">
    <img :src="props.icon" alt="icon">
    <div class="content">
      <span>{{ label }}</span>
    </div>

  </div>
</template>
<script setup lang="ts">
const props = defineProps<{
  id: string
  icon: string,
  label: string,
}>();
</script>

<style>
.rc-message-list-menu-item {
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 6px;
  border-radius: 5px;
  cursor: pointer;
}
.rc-message-list-menu-item:hover {
  background-color: #D2E1FE;
}
.content{
  flex: auto;
  padding-left: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
