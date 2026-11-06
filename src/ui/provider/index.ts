import ConversationListProvider from './conversation-list-provider.ce.vue';
import ModalProvider from './modal/modal-provider.ce.vue';
import ModalConfirmProvider from './modal/modal-confirm-provider.ce.vue';
import ModalAlertProvider from './modal/modal-alert-provider.ce.vue';
import ModalForwardingProvider from './modal/modal-forwarding-provider.ce.vue';
import ModalDeleteMessageProvider from './modal/modal-delete-message-provider.ce.vue';
import ModalMediaMessageProvider from './modal/modal-media-message-provider.ce.vue';
import ModalTakePhotoProvider from './modal/modal-take-photo-provider.ce.vue';
import ModalCombineMessageProvider from './modal/modal-combine-provider.ce.vue';
import ScrollbarProvider from './scrollbar-provider.ce.vue';
import ScrollbarThumbProvider from './scrollbar-thumb-provider.ce.vue';

import InputProvider from './input-provider.ce.vue';
import ConversationDetailBarProvider from './conversation-detail-bar-provider.ce.vue';
import MessageListProvider from './message-list-provider.ce.vue';
import MessageEditProvider from './message-edit-provider.ce.vue';
import CharacterEmojiPanelProvider from './character-emoji-panel-provider.ce.vue';
import EmojiPanelProvider from './emoji-panel-provider.ce.vue';
import MultiChoiceMenuProvider from './multi-choice-menu-provider.ce.vue';
import AT_USERS_PANEL_PROVIDER from './at-users-panel-provider.ce.vue';
import HQVoiceMessageProvider from './hq-voice-message-provider.ce.vue';
import GreyMessageProvider from './grey-message-provider.ce.vue';
import FileTransferCtrlProvider from './file-transfer-ctrl-provider.ce.vue';
import ToastProvider from './toast-provider.ce.vue';
import QuoteInfoViewProvider from './quote-info-view-provider.ce.vue';
import MessageReactionsProvider from './message-reactions-provider.ce.vue';
import ModalReactionsDetailProvider from './modal/modal-reactions-detail-provider.ce.vue';

// *************************** 可被业务层直接引用的组件 Start ***************************
import ConversationDetailProvider from './conversation-detail-provider.ce.vue';
import ConversationListContainerProvider from './conversation-list-container-provider.ce.vue';
import RCKitAppProvider from './rc-imkit-app.ce.vue';
// *************************** 可被业务层直接引用的组件 End ***************************

/**
 * Provider 组件 Tag 定义
 */
export const InnerProviderTag = {
  MESSAGE_EDIT_PROVIDER: 'rc-message-edit-provider',
  CHARACTER_EMOJI_PANEL_PROVIDER: 'rc-character-emoji-panel-provider',
  GREY_MESSAGE_PROVIDER: 'rc-grey-message-provider',
  SCROLLBAR_PROVIDER: 'rc-scrollbar-provider',
  SCROLLBAR_THUMB_PROVIDER: 'rc-scrollbar-thumb-provider',
  MODAL_PROVIDER: 'rc-modal-provider',
  MODAL_CONFIRM_PROVIDER: 'rc-modal-confirm-provider',
  MODAL_ALERT_PROVIDER: 'rc-modal-alert-provider',
  MODAL_FORWARDING_PROVIDER: 'rc-modal-forwarding-provider',
  MODAL_DELETE_MESSAGE_PROVIDER: 'rc-modal-delete-message-provider',
  MODAL_MEDIA_MESSAGE_PROVIDER: 'rc-modal-media-message-provider',
  MODAL_COMBINE_MESSAGE_PROVIDER: 'rc-modal-combine-message-provider',
  MODAL_TAKE_PHOTO_PROVIDER: 'rc-modal-take-photo-provider',
  CONVERSATION_LIST_CONTAINER_PROVIDER: 'rc-conversation-list-container-provider',
  CONVERSATION_LIST_PROVIDER: 'rc-conversation-list-provider',
  CONVERSATION_DETAIL_PROVIDER: 'rc-conversation-detail-provider',
  InputProvider: 'rc-input-provider',
  MESSAGLISTPROVIDER: 'rc-message-list-provider',
  CONVERSATION_DETAIL_BAR_PROVIDER: 'rc-conversation-detail-bar-provider',
  EMOJI_PANEL_PROVIDER: 'rc-emoji-panel-provider',
  MULTI_CHOICE_MENU_PROVIDER: 'rc-multi-choice-menu-provider',
  AT_USERS_PANEL_PROVIDER: 'rc-at-users-panel-provider',
  HQ_VOICE_MESSAGE_PROVIDER: 'rc-hq-voice-message-privider',
  FileTransferCtrlProvider: 'rc-file-transfer-ctrl-provider',
  APP_PROVIDER: 'rc-imkit-app-provider',
  TOAST_PROVIDER: 'rc-toast-provider',
  QUOTE_INFO_VIEW_PROVIDER: 'rc-quote-info-view-provider',
  MESSAGE_REACTIONS_PROVIDER: 'rc-message-reactions-provider',
  MODAL_REACTIONS_DETAIL_PROVIDER: 'rc-modal-reactions-detail-provider',
};

export const providers: { [key:string]: any } = {
  [InnerProviderTag.MESSAGE_EDIT_PROVIDER]: MessageEditProvider,
  [InnerProviderTag.CHARACTER_EMOJI_PANEL_PROVIDER]: CharacterEmojiPanelProvider,
  [InnerProviderTag.GREY_MESSAGE_PROVIDER]: GreyMessageProvider,
  [InnerProviderTag.SCROLLBAR_PROVIDER]: ScrollbarProvider,
  [InnerProviderTag.SCROLLBAR_THUMB_PROVIDER]: ScrollbarThumbProvider,
  [InnerProviderTag.MODAL_PROVIDER]: ModalProvider,
  [InnerProviderTag.MODAL_CONFIRM_PROVIDER]: ModalConfirmProvider,
  [InnerProviderTag.MODAL_ALERT_PROVIDER]: ModalAlertProvider,
  [InnerProviderTag.MODAL_FORWARDING_PROVIDER]: ModalForwardingProvider,
  [InnerProviderTag.MODAL_DELETE_MESSAGE_PROVIDER]: ModalDeleteMessageProvider,
  [InnerProviderTag.MODAL_MEDIA_MESSAGE_PROVIDER]: ModalMediaMessageProvider,
  [InnerProviderTag.MODAL_TAKE_PHOTO_PROVIDER]: ModalTakePhotoProvider,
  [InnerProviderTag.MODAL_COMBINE_MESSAGE_PROVIDER]: ModalCombineMessageProvider,
  [InnerProviderTag.CONVERSATION_LIST_PROVIDER]: ConversationListProvider,
  [InnerProviderTag.CONVERSATION_DETAIL_PROVIDER]: ConversationDetailProvider,
  [InnerProviderTag.CONVERSATION_LIST_CONTAINER_PROVIDER]: ConversationListContainerProvider,
  [InnerProviderTag.InputProvider]: InputProvider,
  [InnerProviderTag.MESSAGLISTPROVIDER]: MessageListProvider,
  [InnerProviderTag.CONVERSATION_DETAIL_BAR_PROVIDER]: ConversationDetailBarProvider,
  [InnerProviderTag.EMOJI_PANEL_PROVIDER]: EmojiPanelProvider,
  [InnerProviderTag.MULTI_CHOICE_MENU_PROVIDER]: MultiChoiceMenuProvider,
  [InnerProviderTag.AT_USERS_PANEL_PROVIDER]: AT_USERS_PANEL_PROVIDER,
  [InnerProviderTag.HQ_VOICE_MESSAGE_PROVIDER]: HQVoiceMessageProvider,
  [InnerProviderTag.FileTransferCtrlProvider]: FileTransferCtrlProvider,
  [InnerProviderTag.APP_PROVIDER]: RCKitAppProvider,
  [InnerProviderTag.TOAST_PROVIDER]: ToastProvider,
  [InnerProviderTag.QUOTE_INFO_VIEW_PROVIDER]: QuoteInfoViewProvider,
  [InnerProviderTag.MESSAGE_REACTIONS_PROVIDER]: MessageReactionsProvider,
  [InnerProviderTag.MODAL_REACTIONS_DETAIL_PROVIDER]: ModalReactionsDetailProvider,
};
