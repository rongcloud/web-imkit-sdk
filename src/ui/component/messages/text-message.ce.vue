<template>
  <p v-if="contentInfo.type === 0" :class="{ 'is-quote': isQuote }">{{ message.content.content || '' }}<span v-if="isEdited" class="edited"> ({{ $tt('message.edit.edited') }})</span></p>
  <p v-else :class="{ 'is-quote': isQuote }">
    <span v-for="(item, index) in contentInfo.content" :key="index">
      <span v-if="contentInfo.position.includes(index+1)">
        <a v-if="item.type === 'mail'" @click="emit('link',{ type: 'mail', address: item.content })" href="javascript:;">{{ item.content }}</a>
        <a v-else @click="emit('link',{ type: 'url', address: item.content })" href="javascript:;">{{ item.content }}</a>
      </span>
      <span v-else>{{ item.content }}</span>
    </span>
    <span v-if="isEdited" class="edited"> ({{ $tt('message.edit.edited') }})</span>
  </p>
</template>

<script setup lang="ts">
/**
 * @description: 文本消息组件
 */
import { computed } from 'vue';
import { getSuccessfulEditTimestamp } from '@lib/modules/message-editing';
import { IRCKitMessageComponentProps, RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { $tt } from '../../i18n-vue';
import { formatTxtMessageContent } from '../../../helper';

const props = defineProps<IRCKitMessageComponentProps>();
const isQuote = computed(() => props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO);
const isEdited = computed(() => !isQuote.value && !!getSuccessfulEditTimestamp(props.message));

const emit = defineEmits<{(e: string, ...item: any[]): void;
}>();

const contentInfo = computed(() => formatTxtMessageContent(props.message.content.content || ''));

</script>

<style>

.edited { color: #7C838E; font-size: 12px; user-select: none; -webkit-user-select: none; }

p {
  margin: 0;
  word-break: break-word;
  font-size: 14px;
  line-height: 22px;
  white-space: pre-wrap;
}

p.is-quote {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.2;
}

a {
  color: #020814;
}

a:hover {
  color: #0047FF;
}
</style>
