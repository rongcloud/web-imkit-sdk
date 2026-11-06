<template>
  <div class="rc-msg-time">
    <span class="date">{{ time }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  time: string
}>();

</script>

<style>
.rc-msg-time {
  text-align: center;
}
.date {
  display: inline-block;
  font-size: 12px;
  line-height: 20px;
  padding: 0 12px;
  color: #7C838E;
  border-radius: 20px;
}
</style>
