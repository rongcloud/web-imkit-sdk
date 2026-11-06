<template>
  <div class="rc-kit-conversation-unread">
    <div v-if="props.count || props.markunread"
      :class="{ 'active': props.notification == 5 }" class="unread-box">
      <span
        :class="{'active':  props.count > 99}"
        class="message-count">
          {{ getDisplayCount() }}
      </span>
    </div>
  </div>

</template>

<script setup lang="ts">
const props = defineProps({
  count: {
    type: Number,
    require: true,
    default: 0,
  },
  notification: {
    type: Number,
    require: true,
    default: -1,
  },
  markunread: {
    type: Boolean,
    require: true,
    default: false,
  },
});

const getDisplayCount = () => {
  if (props.count > 99) {
    return '99+';
  }
  if (props.count > 0) {
    return props.count;
  }
  // Manually marked unread conversations should still show a visible unread badge.
  return 1;
};
</script>
<style>
.rc-kit-conversation-unread {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}
.unread-box {
  background-color: #FF5A50;
  font-size: 10px;
  color: #fff;
  border-radius: 12px;
  text-align: center;
}
.unread-box.active {
  background-color: #E4E8EF;
  color: #41464F;
}
.message-count{
  display: block;
  line-height: 16px;
  min-width: 16px;
  height: 16px;
}
.message-count.active {
  padding: 0 5px;
}

</style>
