<template>
  <div class="rc-reaction" :class="{ 'rc-reaction-active': props.reaction.hasCurrentUserReacted }">
    <span class="rc-reaction-emoji" @click.stop="handleEmojiClick">{{ props.reaction.reactionId }}</span>
    <span v-if="!showusers" class="rc-reaction-count" @click.stop="handleCountClick">{{ totalCount }}</span>
    <div class="rc-reaction-users" v-else-if="names && names.length > 0" ref="usersRef">
      <div class="rc-reaction-users-text" ref="usersTextRef">
        <template v-for="(name, idx) in names">
          <span class="rc-react-user">{{ name }}</span>{{ idx < names.length - 1 ? ',' : '' }}
        </template>
      </div>
      <span v-if="isOverflow" @click.stop="handleCountClick" class="rc-reaction-users-count">{{ $t('reaction.total.users', totalCount) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, watch, onMounted, onUnmounted, nextTick, computed,
} from 'vue';
import { IRCKitMessageReaction } from '@lib/modules/MessageDataModule';
import { $t } from '../i18n-vue';

const props = defineProps<{
  reaction: IRCKitMessageReaction;
  showusers: boolean;
  names?: string[];
  align?: boolean;
}>();

const totalCount = computed(() => (props.reaction.totalCount > 99 ? '99+' : props.reaction.totalCount));

const emit = defineEmits(['reaction-click', 'detail-click']);

const usersRef = ref<HTMLElement | null>(null);
const usersTextRef = ref<HTMLElement | null>(null);
const isOverflow = ref(false);

let resizeObserver: ResizeObserver | null = null;
let overflowFrame = 0;

const checkOverflow = () => {
  const el = usersTextRef.value;
  if (!el) {
    isOverflow.value = false;
    return;
  }
  isOverflow.value = el.scrollWidth > el.clientWidth;
};

const scheduleCheckOverflow = () => {
  if (overflowFrame) {
    return;
  }
  overflowFrame = requestAnimationFrame(() => {
    overflowFrame = 0;
    checkOverflow();
  });
};

const stopObserver = () => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (overflowFrame) {
    cancelAnimationFrame(overflowFrame);
    overflowFrame = 0;
  }
  isOverflow.value = false;
};

const shouldObserveUsers = computed(() => props.showusers && !!props.names?.length);

const initObserver = () => {
  stopObserver();
  if (!shouldObserveUsers.value) {
    return;
  }
  const el = usersRef.value;
  if (!el) return;
  resizeObserver = new ResizeObserver(scheduleCheckOverflow);
  resizeObserver.observe(el);
  scheduleCheckOverflow();
};

watch(() => props.names, async () => {
  if (!shouldObserveUsers.value) {
    stopObserver();
    return;
  }
  await nextTick();
  if (!resizeObserver) {
    initObserver();
  } else {
    scheduleCheckOverflow();
  }
});

watch(() => props.showusers, async (val) => {
  if (val) {
    await nextTick();
    initObserver();
  } else {
    stopObserver();
  }
});

onMounted(() => {
  if (shouldObserveUsers.value) {
    initObserver();
  }
});

onUnmounted(() => {
  stopObserver();
});

const handleEmojiClick = () => {
  emit('reaction-click', props.reaction);
};

const handleCountClick = () => {
  emit('detail-click', props.reaction);
};
</script>

<style>
:host {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
}

.rc-reaction {
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding: 2px 8px;
  box-sizing: border-box;
  border-radius: 20px;
  background-color: #F0F0F0;
  font-size: 10px;
  color: #565960;
  cursor: pointer;
  line-height: 20px;
  user-select: none;
  overflow: hidden;
}

.rc-reaction-active {
  border: 1px solid #0047FFCC;;
  background-color: #BED4FF;
}

.rc-reaction-emoji {
  border-right: 1px solid #A6A6A6;
  padding-right: 6px;
  margin-right: 6px;
  font-size: 14px;
  line-height: 14px;
  flex-shrink: 0;
}

.rc-reaction-count {
  font-size: 12px;
  color: #565960;
}
.rc-reaction-count:hover {
  color: #0047FF;
}

.rc-reaction-users {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.rc-reaction-users-text {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.rc-reaction-users-count {
  flex-shrink: 0;
  white-space: nowrap;
}
.rc-react-user {
  padding: 0;
  margin: 0;
  white-space: nowrap;
}
.rc-react-user:hover {
  color: #0047FF;
}
</style>
