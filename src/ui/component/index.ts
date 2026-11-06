import Icon from './icon.ce.vue';
import IconNotification from './icon-notification.ce.vue';
import IconTop from './icon-top.ce.vue';
import ConversationLabel from './conversation-label.ce.vue';
import ConversationLatestMessage from './conversation-latest-message.ce.vue';
import ConversationUnread from './conversation-unread.ce.vue';
import ConversationListItem from './conversation-list-item.ce.vue';
import ConversationListMenuItem from './conversation-list-menu-item.ce.vue';
import ConversationTime from './conversation-time.ce.vue';
import ConversationLoading from './conversation-loading.ce.vue';
import MessageLocation from './message-location.ce.vue';
import MessageSentStatus from './message-sent-status.ce.vue';

import MessageBubble from './message-bubble.ce.vue';
import MessageListMenuItem from './message-list-menu-item.ce.vue';
import MessageTime from './message-time.ce.vue';
import MessageSelect from './message-select.ce.vue';
import TextMessage from './messages/text-message.ce.vue';
import ImageMessage from './messages/image-message.ce.vue';
import UnsupportedMessage from './messages/unsupported-message.ce.vue';
import SightMessage from './messages/sight-message.ce.vue';
import FileMessage from './messages/file-message.ce.vue';
// import ReferenceMessage from './messages/reference-message.ce.vue';
import CombineV2Message from './messages/combine-v2-message.ce.vue';
import GifMessage from './messages/gif-message.ce.vue';
import Reaction from './reaction.ce.vue';

import ModalDialog from './modal/modal-dialog.ce.vue';
import ReadReceiptModal from './read-receipt-modal.ce.vue';

import ConnectionStatus from './connection-status.ce.vue';

import ConversationEmpty from './conversation-empty.ce.vue';
import ConversationListEmpty from './conversation-list-empty.ce.vue';
import MultiChoiceMenu from './multi-choice-menu.ce.vue';

/**
 * Component 组件 Tag 定义
 */
export const InnerComponentTag = {
  ICON: 'rc-icon',
  ICON_NOTIFICATION: 'rc-icon-notification',
  ICON_TOP: 'rc-icon-top',
  CONVERSATION_LABEL: 'rc-conversation-label',
  CONVERSATION_LATEST_MESSAGE: 'rc-conversation-latest-message',
  CONVERSATION_UNREAD: 'rc-conversation-unread',
  CONVERSATION_LIST_ITEM: 'rc-conversation-list-item',
  CONVERSATION_TIME: 'rc-conversation-time',
  CONVERSATION_LOADING: 'rc-conversation-loading',
  CONVERSATION_LIST_MENU_ITEM: 'rc-conversation-list-menu-item',
  CONVERSATION_EMPTY: 'rc-conversation-empty',
  CONVERSATION_LIST_EMPTY: 'rc-conversation-list-empty',
  MESSAGE_BUBBLE: 'rc-message-bubble',
  MESSAGE_LIST_MENU_ITEM: 'rc-message-list-menu-item',
  MESSAGE_TIME: 'rc-message-time',
  MESSAGE_SELECT: 'rc-message-select',
  MODAL_DIALOG: 'rc-modal-dialog',
  TEXT_MESSAGE: 'rc-text-message',
  IMAGE_MESSAGE: 'rc-image-message',
  UNSUPPORTED_MESSAGE: 'rc-unsupported-message',
  SIGHT_MESSAGE: 'rc-sight-message',
  FILE_MESSAGE: 'rc-file-message',
  REFERENCE_MESSAGE: 'rc-reference-message',
  COMBINE_V2_MESSAGE: 'rc-combine-v2-message',
  GIF_MESSAGE: 'rc-gif-message',
  MULTI_CHOICE_MENU: 'rc-multi-choice-menu',
  MESSAGE_LOCATION: 'rc-message-location',
  MESSAGE_SENT_STATUS: 'rc-message-sent-status',
  CONNECTION_STATUS: 'rc-connection-status',
  READ_RECEIPT_MODAL: 'rc-read-receipt-modal',
  REACTION: 'rc-reaction',
};

export const components: { [key:string]: any } = {
  [InnerComponentTag.ICON]: Icon,
  [InnerComponentTag.ICON_NOTIFICATION]: IconNotification,
  [InnerComponentTag.ICON_TOP]: IconTop,
  [InnerComponentTag.CONVERSATION_LABEL]: ConversationLabel,
  [InnerComponentTag.CONVERSATION_LATEST_MESSAGE]: ConversationLatestMessage,
  [InnerComponentTag.CONVERSATION_UNREAD]: ConversationUnread,
  [InnerComponentTag.CONVERSATION_LIST_ITEM]: ConversationListItem,
  [InnerComponentTag.CONVERSATION_TIME]: ConversationTime,
  [InnerComponentTag.CONVERSATION_LOADING]: ConversationLoading,
  [InnerComponentTag.CONVERSATION_LIST_MENU_ITEM]: ConversationListMenuItem,
  [InnerComponentTag.CONVERSATION_EMPTY]: ConversationEmpty,
  [InnerComponentTag.CONVERSATION_LIST_EMPTY]: ConversationListEmpty,
  [InnerComponentTag.MESSAGE_BUBBLE]: MessageBubble,
  [InnerComponentTag.MESSAGE_LIST_MENU_ITEM]: MessageListMenuItem,
  [InnerComponentTag.MESSAGE_TIME]: MessageTime,
  [InnerComponentTag.MODAL_DIALOG]: ModalDialog,
  [InnerComponentTag.MESSAGE_SELECT]: MessageSelect,
  [InnerComponentTag.TEXT_MESSAGE]: TextMessage,
  [InnerComponentTag.IMAGE_MESSAGE]: ImageMessage,
  [InnerComponentTag.UNSUPPORTED_MESSAGE]: UnsupportedMessage,
  [InnerComponentTag.SIGHT_MESSAGE]: SightMessage,
  [InnerComponentTag.FILE_MESSAGE]: FileMessage,
  [InnerComponentTag.REFERENCE_MESSAGE]: TextMessage,
  [InnerComponentTag.COMBINE_V2_MESSAGE]: CombineV2Message,
  [InnerComponentTag.GIF_MESSAGE]: GifMessage,
  [InnerComponentTag.MULTI_CHOICE_MENU]: MultiChoiceMenu,
  [InnerComponentTag.MESSAGE_LOCATION]: MessageLocation,
  [InnerComponentTag.MESSAGE_SENT_STATUS]: MessageSentStatus,
  [InnerComponentTag.CONNECTION_STATUS]: ConnectionStatus,
  [InnerComponentTag.READ_RECEIPT_MODAL]: ReadReceiptModal,
  [InnerComponentTag.REACTION]: Reaction,
};
