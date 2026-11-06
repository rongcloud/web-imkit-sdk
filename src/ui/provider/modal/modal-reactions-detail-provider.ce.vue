<template>
  <div class="modal-reactions-detail-provider">
    <rc-modal-provider @click="handleClose">
      <div class="reactions-detail-panel" @click.stop>
        <div class="reactions-detail-header">{{ $tt('reaction.detail.title') }}</div>
        <div class="reactions-detail-body">
          <div class="reactions-tab-list">
            <div
              v-for="reaction in reactionList"
              :key="reaction.reactionId"
              class="reactions-tab-item"
              :class="{ 'reactions-tab-item-active': selectedReactionId === reaction.reactionId }"
              @click="selectReaction(reaction.reactionId)">
              <span class="tab-emoji">{{ reaction.reactionId }}</span>
              <span class="tab-count">{{ reaction.totalCount > 99 ? '99+' : reaction.totalCount }}</span>
            </div>
          </div>
          <div class="reactions-user-list" ref="userListRef" @scroll="handleScroll">
            <div v-for="user in userList" :key="user.userId" class="reactions-user-item">
              <img class="user-avatar" :src="user.portraitUri" alt="" />
              <span class="user-name">{{ user.name }}</span>
            </div>
            <div v-if="loadingMore" class="reactions-user-loading">{{ $tt('reaction.detail.loading') }}</div>
          </div>
        </div>
      </div>
    </rc-modal-provider>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted,
} from 'vue';
import { IMessageReaction, getMessageReactionUsers, ConversationType } from '@rongcloud/imlib-next';
import { ctx, getSelectedGroupMember, openedConversation } from '../context';
import { createLifecycleGuard } from '../lifecycle-guard';
import { $tt } from '../../i18n-vue';

const props = defineProps<{
  reactions: string;
  messageUid: string;
  initialReactionId?: string;
}>();

const emit = defineEmits(['cancel']);

const context = ctx();
const userListRef = ref<HTMLElement>();
const reactionList = computed<IMessageReaction[]>(() => {
  try {
    return JSON.parse(props.reactions);
  } catch {
    return [];
  }
});
const selectedReactionId = ref(props.initialReactionId || reactionList.value[0]?.reactionId || '');
const loadingMore = ref(false);
const userList = ref<{ userId: string; name: string; portraitUri: string }[]>([]);
const pageToken = ref('');
const hasMore = computed(() => pageToken.value.length > 0);
const requestGuard = createLifecycleGuard();

const fetchReactionUsers = async (reactionId: string, isLoadMore = false) => {
  const conversation = openedConversation.value;
  if (!conversation) return;
  if (isLoadMore && loadingMore.value) return;

  // Reaction 可能在弱网请求返回前被反复切换；只有最后发起的请求可以更新弹窗状态。
  const requestToken = requestGuard.capture();
  const requestPageToken = isLoadMore ? pageToken.value : undefined;
  loadingMore.value = true;
  const [res] = await Promise.all([
    getMessageReactionUsers({
      conversationIdentifier: {
        conversationType: conversation.conversationType,
        targetId: conversation.targetId,
      },
      messageUId: props.messageUid,
      reactionId,
      count: 50,
      pageToken: requestPageToken,
    }),
    // 强制显示 200ms 避免加载中状态闪烁
    new Promise((resolve) => {
      setTimeout(resolve, 300);
    }),
  ]);

  if (!requestGuard.isCurrent(requestToken)) {
    return;
  }
  loadingMore.value = false;
  if (!res.isOk) {
    context.alert('alert.imlib.failed.generic', res.code);
    return;
  }

  const users = (res.data!.users || []).map((u) => {
    if (conversation.conversationType === ConversationType.GROUP) {
      const member = getSelectedGroupMember(u.userId);
      if (member) {
        return {
          userId: u.userId,
          name: member.nickname || member.name,
          portraitUri: member.portraitUri || '',
        };
      }
    }
    const profile = context.appData.getUserProfile(u.userId);
    return {
      userId: u.userId,
      name: profile.name || u.userId,
      portraitUri: profile.portraitUri || '',
    };
  });
  if (isLoadMore) {
    userList.value.push(...users);
  } else {
    userList.value = users;
  }
  pageToken.value = res.data!.pageToken;
};

const selectReaction = (reactionId: string) => {
  if (selectedReactionId.value === reactionId) return;
  selectedReactionId.value = reactionId;
  userList.value = [];
  pageToken.value = '';
  loadingMore.value = false;
  fetchReactionUsers(reactionId);
};

const handleScroll = () => {
  if (!hasMore.value || loadingMore.value) return;
  const el = userListRef.value;
  if (!el) return;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
    fetchReactionUsers(selectedReactionId.value, true);
  }
};

const handleClose = () => {
  // Custom Element 真正卸载可能晚于 DOM 移除，关闭时先立即阻止在途请求回写。
  requestGuard.invalidate();
  emit('cancel');
};

onMounted(() => {
  if (selectedReactionId.value) {
    fetchReactionUsers(selectedReactionId.value);
  }
});

onUnmounted(() => {
  // 弹窗关闭后丢弃所有在途响应，避免继续更新状态或弹出错误提示。
  requestGuard.invalidate();
});
</script>

<style>
.reactions-detail-panel {
  background: #FFFFFF;
  border-radius: 6px;
  width: 520px;
  height: 460px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.reactions-detail-header {
  padding: 16px 20px;
  font-size: 16px;
  font-weight: 500;
  color: #020814;
  text-align: center;
  border-bottom: 1px solid #E5E5E5;
  flex-shrink: 0;
}

.reactions-detail-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.reactions-tab-list {
  width: 120px;
  border-right: 1px solid #E5E5E5;
  overflow-y: auto;
  flex-shrink: 0;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reactions-tab-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  color: #41464F;
  background-color: #F3F5FA;
  white-space: nowrap;
}

.reactions-tab-item:hover {
  background-color: #E3E7EF;
}

.reactions-tab-item-active {
  background-color: #0047FF;
  color: #FFFFFF;
}

.tab-emoji {
  font-size: 16px;
}

.tab-count {
  font-size: 12px;
}

.reactions-user-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0;
}

.reactions-user-loading {
  padding: 20px;
  text-align: center;
  color: #7C838E;
  font-size: 14px;
}

.reactions-user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background-color: #E5E5E5;
}

.user-name {
  font-size: 14px;
  color: #41464F;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
