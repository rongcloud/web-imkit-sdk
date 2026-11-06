<template>
  <div class="combine-message">
    <div class="title">{{ title }}</div>
    <pre class="summary-content">{{ summaryText }}</pre>
    <div class="separator">
      <div>聊天记录</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { CombineV2MessageContent, ConversationType } from '@rongcloud/imlib-next';
import { IRCKitMessageComponentProps } from '@lib/ui/interface';
import { $t } from '@lib/ui/i18n-vue';
import { computed } from 'vue';

const { message } = defineProps<IRCKitMessageComponentProps>();

const content: CombineV2MessageContent = message.content as CombineV2MessageContent;
const { summaryList, conversationType, nameList } = content;

const title = computed(() => {
  if (!conversationType || !nameList) return '';
  if (conversationType === ConversationType.PRIVATE) {
    return nameList.length === 2 ? $t('private.combine-msg.title', ...nameList).value : $t('private.combine-msg.signal.title', ...nameList).value;
  }
  return $t('group.combine-msg.title').value;
});

const summaryText = computed(() => (summaryList || [])
  .map((summary) => summary.replace(/\n/g, ' '))
  .slice(0, 4)
  .join('\n'));
</script>
<style lang="scss">
.combine-message {
  display: block;
}
.title {
  font-size: 16px;
  padding-bottom: 12px;
  max-width: 350px;
  word-wrap: break-word;
  word-break: break-all;
  text-overflow: ellipsis;
  color: #020814;
}
.summary-content {
  font-family: inherit;
  font-size: 14px;
  line-height: 20px;
  overflow: hidden;
  color: #41464F;
  max-width: 350px;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}
.separator {
  border-top: 1px solid #E4E7ED;
  padding-top: 20px;
  margin-top: 10px;
  font-size: 14px;
  color: #41464F;
}
</style>
