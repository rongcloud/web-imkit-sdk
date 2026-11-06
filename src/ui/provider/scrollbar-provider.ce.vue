<template>
  <div ref="scrollbarRef" class="rc-kit-scrollbar">
    <div ref="wrapRef" class="wrap" @scroll="handleScroll">
      <div ref="resizeRef" style="min-height: 100%;">
        <slot></slot>
      </div>
    </div>
    <rc-scrollbar-thumb-provider
      v-if="sizeHeight"
      @handlemove="handleMove"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      :height="sizeHeight"
      :move="moveY"
      :scrollheight="wrapRef?.scrollHeight"
      :ratio="ratioY"
      :style="{
        opacity: showScrollbar ? 1 : 0,
        transition: 'opacity 0.5s',
        pointerEvents: showScrollbar ? 'auto' : 'none'
      }"
    ></rc-scrollbar-thumb-provider>
  </div>
</template>
<script setup lang="ts">
import {
  ref, watch, onMounted, onBeforeUnmount,
} from 'vue';
import { InnerEvent } from '@lib/core/EventDefined';
import { ctx } from './context';
import { createScrollControl } from '../../helper';

const context = ctx();
const emit = defineEmits<{(e: string, ...item: any[]): void,
}>();

const scrollbarRef = ref<HTMLDivElement>();
const wrapRef = ref<HTMLDivElement>();
const resizeRef = ref<HTMLDivElement>();
const ratioY = ref(1);
const sizeHeight = ref(0);
const moveY = ref(0);
const showScrollbar = ref(false);
const isHovering = ref(false);

let timer: any = null;
let timerHide: any = null;

// 使用公共滚动控制工具
const scrollControl = createScrollControl(wrapRef);

const update = () => {
  if (!wrapRef.value) return;
  const { offsetHeight } = wrapRef.value;

  const originalHeight = offsetHeight ** 2 / wrapRef.value.scrollHeight;
  const height = Math.max(originalHeight, 20);
  // 滑块高度最小 20 px, 当 originalHeight 小于 20px, 需计算 20px 下滑块移动距离与内容滚动距离的比值
  ratioY.value = originalHeight / (offsetHeight - originalHeight) / (height / (offsetHeight - height));

  sizeHeight.value = originalHeight < offsetHeight ? Math.floor(height) : 0;
};

const setScrollTop = (value: number) => {
  if (typeof value !== 'number') {
    console.warn('value must be a number');
    return;
  }
  if (!wrapRef?.value) return;
  wrapRef.value.scrollTop = value;
};

const getViewportRect = () => wrapRef.value?.getBoundingClientRect();

const getViewportSize = () => {
  if (!wrapRef.value) {
    return { width: 0, height: 0 };
  }
  return {
    width: wrapRef.value.clientWidth,
    height: wrapRef.value.clientHeight,
  };
};

const getScrollPosition = () => {
  if (!wrapRef.value) {
    return { left: 0, top: 0 };
  }
  return {
    left: wrapRef.value.scrollLeft,
    top: wrapRef.value.scrollTop,
  };
};

const handleMouseEnter = () => {
  isHovering.value = true;
  showScrollbar.value = true;
  if (timerHide) clearTimeout(timerHide);
};

const handleMouseLeave = () => {
  isHovering.value = false;
  if (timerHide) clearTimeout(timerHide);
  timerHide = setTimeout(() => {
    showScrollbar.value = false;
  }, 1000);
};

const handleMove = (e: CustomEvent) => {
  if (scrollControl.isScrollDisabled) {
    return;
  }
  if (!wrapRef.value) return;
  const thumbPositionPercentage = e.detail[0];
  wrapRef.value.scrollTop = (thumbPositionPercentage * wrapRef.value.scrollHeight) / 100;
};

const handleScroll = () => {
  // 如果滚动被禁用，不处理滚动事件
  if (scrollControl.isScrollDisabled) {
    return;
  }

  showScrollbar.value = true;
  if (timerHide) clearTimeout(timerHide);
  if (!isHovering.value) {
    timerHide = setTimeout(() => {
      showScrollbar.value = false;
    }, 1000);
  }

  if (!wrapRef.value) return;
  const {
    offsetHeight, scrollHeight, scrollTop, clientHeight,
  } = wrapRef.value;
  emit('scroll', {
    scrollTop, scrollHeight, clientHeight, offsetHeight,
  });
  // 计算滚动距离的百分比
  moveY.value = Math.floor(((scrollTop * 100) / offsetHeight) * ratioY.value);

  let shouldTrigger = scrollHeight / (offsetHeight + scrollTop) <= 1.2;

  // 下拉到一定比例，触发加载
  if (shouldTrigger) {
    if (!timer) {
      timer = setTimeout(async () => {
        emit('loading');
        timer = null;
        clearTimeout(timer);
      }, 1000);
    }
  }
};

watch(() => ratioY.value, (data) => {
  if (!wrapRef.value) return;
  const { offsetHeight, scrollTop } = wrapRef.value;
  moveY.value = Math.floor(((scrollTop * 100) / offsetHeight) * ratioY.value);
});

// 监听容器高度变化，更新滑块
let resizeRefObserver: ResizeObserver | null = null;
let wrapRefObserver: ResizeObserver | null = null;
const useResizeObserver = (el: HTMLElement, callback: ConstructorParameters<typeof ResizeObserver>[0]) => {
  let observer: ResizeObserver | null = null;
  if (window && 'ResizeObserver' in window && el) {
    observer = new ResizeObserver(callback);
    observer.observe(el);
  }
  return observer;
};
// 切换用户登入，置顶滚动条
const _onDestroyUserCache = () => {
  setScrollTop(0);
};

// 暴露方法给父组件
defineExpose({
  disableScroll: scrollControl.disableScroll,
  enableScroll: scrollControl.enableScroll,
  setScrollTop,
  getViewportRect,
  getViewportSize,
  getScrollPosition,
});

onMounted(() => {
  window.addEventListener('resize', update);
  resizeRefObserver = useResizeObserver(resizeRef.value!, update);
  wrapRefObserver = useResizeObserver(wrapRef.value!, update);
  // 切换用户登入
  context.addEventListener(InnerEvent.DESTROY_USER_CACHE, _onDestroyUserCache);
});

onBeforeUnmount(() => {
  context.removeEventListener(InnerEvent.DESTROY_USER_CACHE, _onDestroyUserCache);
  window.removeEventListener('resize', update);
  resizeRefObserver?.unobserve(resizeRef.value!);
  wrapRefObserver?.unobserve(wrapRef.value!);
  // 清理滚动禁用事件监听
  scrollControl.enableScroll();
  if (timerHide) clearTimeout(timerHide);
});

</script>
<style>
/* 让自定义元素宿主参与高度链，内部滚动容器的 100% 高度才可计算 */
:host {
  display: block;
  height: 100%;
}

.rc-kit-scrollbar {
  overflow: hidden;
  position: relative;
  height: 100%;
}
.wrap {
  overflow-y: scroll;
  height: 100%;
  scrollbar-width: none;
}
.wrap::-webkit-scrollbar {
  display: none;
}
</style>
