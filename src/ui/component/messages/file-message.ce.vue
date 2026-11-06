<template>
  <div class="file-message" :class="{ 'is-quote': isQuote }">
    <div class="icon">
      <rc-file-transfer-ctrl-provider class="file-transfer" :message="message" :position="position">
        <img class="file-message-icon" :src="fileTypeIcon" :width="isQuote ? 24 : 44" :height="isQuote ? 24 : 44" alt="File Icon">
      </rc-file-transfer-ctrl-provider>
    </div>
    <div class="desc">
      <div class="name" :title="fileName">
        <span class="name-prefix">{{ fileNameParts.prefix }}</span><span class="name-tail">{{ fileNameParts.tail }}</span>
      </div>
      <span class="size">{{ formatFileSize(message.content.size) }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
/**
 * @description: 文件消息组件
 */
import { IRCKitMessageComponentProps, RCKitMessageComponentRenderPosition } from '@lib/ui/interface';
import { computed } from 'vue';
import { formatFileSize } from '../../../helper';
import { splitFileNameForDisplay } from '../../../helper/file-name';
import { getFileTypeIconByName } from '../../../assets';

const props = defineProps<IRCKitMessageComponentProps>();
const isQuote = props.position === RCKitMessageComponentRenderPosition.QUOTE_INFO;

const fileName = computed(() => props.message.content.name ?? '');
const fileNameParts = computed(() => splitFileNameForDisplay(fileName.value));
const fileTypeIcon = computed(() => getFileTypeIconByName(props.message.content.name));
</script>

<style lang="scss">
:host {
  display: block;
  width: max-content;
  min-width: 0;
  max-width: 100%;
}

.file-message {
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.file-message.is-quote {
  font-size: 12px;
  max-width: 100%;
}

.file-message.is-quote .icon {
  width: 24px;
  height: 24px;
}

.file-message.is-quote .file-message-icon {
  width: 24px;
  height: 24px;
}

.file-message.is-quote .desc {
  font-size: 12px;
  line-height: 1.2;
  min-width: 0;
  flex: 1 1 auto;
  max-width: 100%;
}

.file-message.is-quote .name {
  max-width: none;
}

.icon {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.file-transfer {
  display: block;
  width: 100%;
  height: 100%;
}

.file-message-icon {
  width: 44px;
  height: 44px;
  display: block;
  object-fit: contain;
}

.desc {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 372px;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 18px;
  padding: 0 6px;
}

.name {
  display: flex;
  max-width: 360px;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  white-space: nowrap;
  color: #020814;
}

.name-prefix {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-tail {
  flex: 0 0 auto;
}

@media (max-width: 768px) {
  .desc {
    max-width: 212px;
  }

  .name {
    max-width: 200px;
  }
}
.size {
  color: #7C838E;
}
</style>
