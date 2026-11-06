<template>
  <div class="rc-conversation-loading">
   <span class="content">{{ msg }}</span>
  </div>
</template>

<script setup lang="ts">
import { $t } from '../i18n-vue';

const msg = $t('conv.loading.msg');
</script>

<style>
.rc-conversation-loading {
  height: 30px;
}
.rc-conversation-loading .content {
  display: block;
  text-align: center;
  line-height: 30px;
}
</style>
