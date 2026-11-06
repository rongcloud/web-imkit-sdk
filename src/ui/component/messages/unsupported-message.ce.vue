<template>
  <p>{{ msg }}</p>
</template>

<script setup lang="ts">
import { $tt } from '@lib/ui/i18n-vue';
import { IRCKitMessageComponentProps } from '@lib/ui/interface';
/**
 * @description: 不支持的消息类型
 */
const props = defineProps<IRCKitMessageComponentProps>();
const msg = $tt('message-type.unknown');
</script>

<style>

p {
  margin: 0;
  padding: 0;
  word-break: break-word;
}
</style>
