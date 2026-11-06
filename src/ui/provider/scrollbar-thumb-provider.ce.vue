<template>
  <div ref="instance" class="rc-kit-scrollbar-bar" @mousedown="clickTrackHandler">
    <div ref="thumb" :style="thumbStyle" @mousedown="clickThumbHandler" class="rc-kit-scrollbar-thumb"></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue';

const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const props = defineProps({
  height: {
    type: Number,
    require: true,
    default: 0,
  },
  move: {
    type: Number,
    require: true,
    default: 0,
  },
  scrollheight: {
    type: Number,
    require: true,
    default: 0,
  },
  ratio: {
    type: Number,
    require: true,
    default: 1,
  },
});
const thumbStyle = computed(() => ({
  height: `${props.height}px`,
  transform: `translateY(${props.move}%)`,
}));

// 动态计算偏移比率
const offsetRatio = computed(
  () => instance.value!.offsetHeight ** 2
    / props.scrollheight
    / props.ratio
    / thumb.value!.offsetHeight,
);

const thumb = ref<HTMLDivElement>();
const instance = ref<HTMLDivElement>();
let cursorDown = false;
let originalOnSelectStart: any;

const thumbState = ref<Partial<Record<'Y', number>>>({});

const clickThumbHandler = (e: MouseEvent) => {
  e.stopPropagation();
  if (e.ctrlKey || [1, 2].includes(e.button)) return;
  window.getSelection()?.removeAllRanges();

  startDrag(e);
  const el = e.currentTarget as HTMLDivElement;
  if (!el) return;
  // 记录点击滑块的位置
  thumbState.value.Y = e.clientY - el.getBoundingClientRect().top;
};

const clickTrackHandler = (e: MouseEvent) => {
  if (!thumb.value || !instance.value) return;
  const offset = Math.abs(
    (e.target as HTMLElement).getBoundingClientRect().top
    - e.clientY,
  );
  const thumbHalf = thumb.value.offsetHeight / 2;
  const thumbPositionPercentage = ((offset - thumbHalf) * 100 * offsetRatio.value)
    / instance.value.offsetHeight;

  emit('handlemove', thumbPositionPercentage);
};

const restoreOnselectstart = () => {
  if (document.onselectstart !== originalOnSelectStart) document.onselectstart = originalOnSelectStart;
};
const startDrag = (e: MouseEvent) => {
  e.stopImmediatePropagation();
  cursorDown = true;
  document.addEventListener('mousemove', mouseMoveDocumentHandler);
  document.addEventListener('mouseup', mouseUpDocumentHandler);
  originalOnSelectStart = document.onselectstart;
  document.onselectstart = () => false;
};

const mouseMoveDocumentHandler = (e: MouseEvent) => {
  if (!instance.value || !thumb.value) return;
  if (cursorDown === false) return;
  const prevPage = thumbState.value.Y;
  if (!prevPage) return;
  const offset = (instance.value.getBoundingClientRect().top - e.clientY) * -1;
  const thumbClickPosition = thumb.value.offsetHeight - prevPage;
  const thumbPositionPercentage = ((offset - thumbClickPosition) * 100 * offsetRatio.value)
    / instance.value.offsetHeight;

  emit('handlemove', thumbPositionPercentage);
};

const mouseUpDocumentHandler = () => {
  cursorDown = false;
  thumbState.value.Y = 0;
  document.removeEventListener('mousemove', mouseMoveDocumentHandler);
  document.removeEventListener('mouseup', mouseUpDocumentHandler);
  restoreOnselectstart();
};

onBeforeUnmount(() => {
  restoreOnselectstart();
  document.removeEventListener('mouseup', mouseUpDocumentHandler);
});

</script>
<style>
.rc-kit-scrollbar-bar {
  position: absolute;
  right: 2px;
  bottom: 0px;
  z-index: 1;
  border-radius: 4px;
  width: 6px;
  top: 0px;
}

.rc-kit-scrollbar-thumb {
  width: 100%;
  position: relative;
  cursor: pointer;
  border-radius: inherit;
  background-color: #909399;
  opacity: .3;
}

.rc-kit-scrollbar-thumb:hover {
  background-color: #909399;
  opacity: .5;
}
</style>
