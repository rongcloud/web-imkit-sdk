<template>
  <div class="rc-conversation-latest-message">
      <span class="content content-webkit-display content-moz-display">{{ props.message }}</span>
  </div>
</template>

<script setup lang="ts">

const props = defineProps({
  message: {
    type: String,
    required: true,
  },
});
</script>
<style>
.rc-conversation-latest-message{
  color: #7C838E;
  font-weight: 400;
  font-size: 12px;
  display: flex;
}
.content-moz-display {
  display: -moz-box;
  -moz-line-clamp: 1 !important;
  -moz-box-orient: vertical;
}
.content-webkit-display {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}
.content {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  line-height: 18px;
  word-break: break-all;
  word-wrap: break-word;

}
</style>
