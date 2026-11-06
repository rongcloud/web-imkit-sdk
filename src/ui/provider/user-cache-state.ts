export interface IRCKitUserCacheState {
  openedConversation: { value: unknown };
  conversationList: { value: unknown[] };
  messageList: { value: unknown[] };
  textarea: { value: { value: string } | null | undefined };
  unreadCountBottom: { value: number };
  selectedGroupMembers: { value: unknown[] };
  currentUserProfile: { value: unknown };
  replyMessage: { value: unknown };
}

export const resetUserCacheState = (state: IRCKitUserCacheState): void => {
  state.openedConversation.value = null;
  state.conversationList.value.length = 0;
  state.messageList.value.length = 0;
  if (state.textarea.value) {
    state.textarea.value.value = '';
  }
  state.unreadCountBottom.value = 0;
  state.selectedGroupMembers.value = [];
  state.currentUserProfile.value = undefined;
  state.replyMessage.value = null;
};
