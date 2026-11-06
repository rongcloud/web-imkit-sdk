<template>
  <div class="editor" @click.stop @contextmenu.stop>
    <textarea ref="input" rows="2" :value="draft" :style="{ height: `${height}px` }" @input="handleInput"
      @select="rememberSelection" @blur="rememberSelection" @keydown="handleKeyDown" @keydown.esc.stop="emit('cancel')"></textarea>
    <div ref="measure" class="measure" aria-hidden="true"></div>
    <div class="actions">
      <div class="emoji-action">
        <button type="button" class="emoji-button" :aria-label="$tt('message.edit.emoji')" @mousedown.prevent @click.stop="emit('emoji-toggle', $event)">
          <img class="emoji-regular" :src="INPUT_ICON_EMOJI_ICON" alt="">
          <img class="emoji-hover" :src="INPUT_ICON_EMOJI_EDIT_HOVER_ICON" alt="">
        </button>
      </div>
      <button type="button" @click="emit('cancel')">{{ $tt('message.edit.cancel') }}</button>
      <button type="button" class="confirm" :disabled="!draft.trim()" @click="emit('confirm')">{{ $tt('message.edit.confirm') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  nextTick, onMounted, onBeforeUnmount, ref, watch,
} from 'vue';
import { $tt } from '../i18n-vue';
import { INPUT_ICON_EMOJI_ICON, INPUT_ICON_EMOJI_EDIT_HOVER_ICON } from '../../assets';

const props = defineProps<{ draft: string; selectedEmoji?: { value: string; sequence: number } }>();
const emit = defineEmits<{(event: 'draft', value: string): void;
  (event: 'emoji-toggle', value: MouseEvent): void;
  (event: 'cancel' | 'confirm' | 'before-resize' | 'resize'): void;
}>();
const input = ref<HTMLTextAreaElement>();
const measure = ref<HTMLDivElement>();
const height = ref(44);
let selectionStart = 0;
let selectionEnd = 0;
let widthObserver: ResizeObserver | undefined;
let alive = true;

const rememberSelection = () => {
  selectionStart = input.value?.selectionStart || 0;
  selectionEnd = input.value?.selectionEnd || 0;
};
const measureHeight = () => {
  if (!alive || !input.value || !measure.value) return;
  // Measure outside layout without temporarily shrinking the visible textarea.
  measure.value.style.width = `${input.value.clientWidth}px`;
  measure.value.textContent = `${props.draft}\n`;
  const nextHeight = Math.min(220, Math.max(44, measure.value.scrollHeight));
  if (height.value === nextHeight) return;
  emit('before-resize');
  height.value = nextHeight;
  nextTick(() => { if (alive) emit('resize'); });
};
const handleInput = () => {
  rememberSelection();
  emit('draft', input.value?.value || '');
};
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  if (props.draft.trim()) emit('confirm');
};
const insertEmoji = async (emoji: string) => {
  const start = selectionStart;
  const draft = props.draft.slice(0, start) + emoji + props.draft.slice(selectionEnd);
  // Custom-element props may update on a later Vue tick. Set the current value
  // first so placing the cursor cannot clamp it to the previous draft length.
  if (input.value) input.value.value = draft;
  emit('draft', draft);
  await nextTick();
  if (!alive) return;
  input.value?.focus({ preventScroll: true });
  input.value?.setSelectionRange(start + emoji.length, start + emoji.length);
  rememberSelection();
};
watch(() => props.draft, () => nextTick(measureHeight));
watch(() => props.selectedEmoji, (emoji) => { if (emoji) insertEmoji(emoji.value); });
onMounted(() => {
  measureHeight();
  // Wait for the draft and measured height to render before revealing its end.
  nextTick(() => {
    if (!alive || !input.value) return;
    input.value.focus({ preventScroll: true });
    const end = input.value.value.length;
    input.value.setSelectionRange(end, end);
    input.value.scrollTop = input.value.scrollHeight;
    rememberSelection();
    // Report initial layout even when a restored two-line draft keeps the default height.
    emit('resize');
  });
  widthObserver = new ResizeObserver(measureHeight);
  if (input.value) widthObserver.observe(input.value);
});
onBeforeUnmount(() => { alive = false; widthObserver?.disconnect(); });
</script>

<style>
:host {
  display: block;
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
.editor {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 108px;
  min-width: 0;
  max-width: 100%;
  padding: 16px 18px 14px;
  border: 1px solid #E4E7ED;
  border-radius: 20px;
  background: #fff;
}
textarea, .measure {
  font-family: inherit;
  font-size: 14px;
  line-height: 22px;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-word;
  box-sizing: border-box;
  padding: 0;
  border: 0;
}
textarea {
  display: block;
  width: 100%;
  min-height: 36px;
  max-height: 220px;
  resize: none;
  outline: none;
  overflow-y: auto;
  color: #020814;
  background: transparent;
}
.measure { position: fixed; top: -10000px; left: -10000px; visibility: hidden; pointer-events: none; }
.actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 10px; }
button {
  box-sizing: border-box;
  display: flex;
  flex: 0 0 64px;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 30px;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  line-height: 30px;
  padding: 0;
  background: #F3F5FA;
  color: #020814;
}
.emoji-action { position: relative; flex: 0 0 30px; width: 30px; height: 30px; }
.emoji-button { flex: 0 0 30px; width: 30px; height: 30px; font-size: 16px; border-radius: 8px; background: transparent; }
.emoji-button img { display: block; width: 30px; height: 30px; }
.emoji-button .emoji-hover { display: none; }
.emoji-button:hover .emoji-regular { display: none; }
.emoji-button:hover .emoji-hover { display: block; }
.confirm { background: #0047FF; color: #fff; }
button:disabled { cursor: default; opacity: .5; }
</style>
