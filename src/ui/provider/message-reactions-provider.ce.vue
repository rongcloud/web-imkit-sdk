<template>
  <div class="rc-message-reactions" v-if="props.reactions.length">
    <rc-reaction
      v-for="reaction in props.reactions"
      :key="reaction.reactionId"
      :reaction="reaction"
      :showusers="showUsers"
      :names="reactUsers.get(reaction.reactionId)"
      :align="props.align"
      @reaction-click="handleReactionClick"
      @detail-click="handleDetailClick">
    </rc-reaction>
  </div>
</template>

<script setup lang="ts">
import { ConversationType, IMessageReaction } from '@rongcloud/engine';
import { onUnmounted, reactive, watch } from 'vue';
import { IRCKitCachedMessage, IRCKitMessageReaction } from '@lib/modules/MessageDataModule';
import { RCKitEvents } from '@lib/core/EventDefined';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { ctx, getSelectedGroupMember, selectedGroupMembersVersion } from './context';
import { resolveUserDisplayName } from '../../helper/user-display-name';

const props = defineProps<{
  reactions: IRCKitMessageReaction[];
  message: IRCKitCachedMessage;
  align?: boolean;
}>();

const context = ctx();
const showUsers = context.isShowMessageReactUsersEnabled;
const reactUsers: Map<string, string[]> = reactive(new Map());
let reactUsersRequestVersion = 0;

const getReactionUsersKey = () => {
  if (!showUsers || !props.reactions.length) {
    return '';
  }
  return props.reactions
    .map((reaction) => `${reaction.reactionId}:${reaction.users.join(',')}`)
    .join('|');
};

const updateReactUsers = async () => {
  const requestVersion = ++reactUsersRequestVersion;
  const { reactions } = props;
  if (!showUsers || !reactions.length) {
    reactUsers.clear();
    return;
  }

  const userIds: Set<string> = new Set();
  reactions.forEach((item) => {
    item.users.forEach((id) => userIds.add(id));
  });
  if (!userIds.size) {
    reactUsers.clear();
    return;
  }

  const groupId = props.message.conversationType === ConversationType.GROUP
    ? props.message.targetId
    : undefined;
  const profiles = await context.appData.requestUserProfiles(Array.from(userIds));
  if (requestVersion !== reactUsersRequestVersion) {
    return;
  }

  const profilesById = new Map(profiles.map((profile) => [profile.userId, profile]));
  reactUsers.clear();
  reactions.forEach((reaction) => {
    const usernames: string[] = reaction.users.map((id) => {
      const profile = profilesById.get(id);
      // 群成员在打开会话时统一加载，此处复用索引，避免每个 reaction 组件重复遍历或请求全量成员。
      return groupId && id !== context.userId
        ? resolveUserDisplayName(getSelectedGroupMember(id) || profile, id)
        : resolveUserDisplayName(profile, id);
    });
    reactUsers.set(reaction.reactionId, usernames);
  });
};

watch([getReactionUsersKey, selectedGroupMembersVersion], updateReactUsers, { immediate: true });

onUnmounted(() => {
  reactUsersRequestVersion += 1;
  reactUsers.clear();
});

const handleReactionClick = (e: CustomEvent) => {
  const reaction: IRCKitMessageReaction = e.detail[0];
  if (!reaction) return;
  context.message.updateMessageReaction(props.message, reaction.reactionId, reaction.hasCurrentUserReacted);
};

const handleDetailClick = (e: CustomEvent) => {
  const reaction: IMessageReaction = e.detail[0];
  if (!reaction) return;
  context.emit(new RCKitEvent(RCKitEvents.REACTIONS_DETAIL_EVENT, {
    message: props.message,
    reactionId: reaction.reactionId,
  }));
};
</script>

<style>
:host {
  display: block;
  min-width: 0;
  max-width: 100%;
}

.rc-message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 100%;
}
</style>
