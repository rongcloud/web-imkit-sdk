import { IPluginGenerator, VersionManage } from '@rongcloud/engine';
import { IRCKitInitOpts, RCKitApplication } from './core/RCKitApplication';
import { RCKIT_COMMIT_VERSION, RCKIT_VERSION } from './constants';
import { LogTag } from './enums/LogTag';

VersionManage.add('IMKit', RCKIT_VERSION);

export type { IPushConfig } from '@rongcloud/engine';

export const RCKitInstaller: IPluginGenerator<RCKitApplication, IRCKitInitOpts> = {
  tag: 'IMKit',
  verify(runtime) {
    return runtime.tag === 'browser' && typeof customElements !== 'undefined';
  },
  setup(context, _, options) {
    const logger = context.createLogger('IMKit', 'IM');

    if (options.logLevel) {
      logger.setOutputLevel(options.logLevel);
    }

    logger.warn(LogTag.A_INIT_O, `Commit: ${RCKIT_COMMIT_VERSION}, Version: ${RCKIT_VERSION}`);
    return new RCKitApplication(context, logger, options);
  },
};

export type { RCKitLanguageDirection, IRCKitLanguageEntries } from './languages';
export { RCKitEvent } from './core/RCKitEvent';
export type { IRCKitServiceHooks } from './modules/appdata/AppDataModule';
export type { IRCKitGroupProfile, IRCKitGroupMemberProfile } from './modules/appdata/GroupCache';
export type { IRCKitUserProfile, IRCKitUserOnlineStatus } from './modules/appdata/UserCache';
export type { IRCKitSystemProfile } from './modules/appdata/SystemCache';
export type { IRCKitCachedConversation } from './modules/conversation/IRCKitCachedConversation';
export { RCKitMentionedType } from './modules/conversation/RCKitMenthionedType';
export type { IRCKitCachedMessage, IRCKitMessageReaction, IRCKitQuoteInfo } from './modules/MessageDataModule';
export { RCKIT_COMMIT_VERSION, RCKIT_VERSION } from './constants';
export {
  type IRCKitRegisterMessageTypeOpts,
  type IRCKitCustomMessageComponentOpts,
  type IRCKitMessageComponentProps,
  RCKitMessageComponentRenderPosition,
} from './ui/interface';
export type {
  IRCKitComponentContext, IRCKitOverrideAbleComponentProps, IRCKitDefineCustomElementOptions,
  IRCKitHQVoiceMessageComponentProps,
  IRCKitReplyPreviewBarComponentProps,
} from './ui/override-able';
export { RCKitOverrideAbleComponent } from './ui/override-able';
export { RCKitApplication, type IRCKitInitOpts } from './core/RCKitApplication';
export { RCKitCommand } from './enums/RCKitCommand';
export { RCKitMessageEditStatus } from './enums/RCKitMessageEditStatus';
export { RCKitQuoteMessageStatus } from './enums/RCKitQuoteMessageStatus';
export { RCKitEvents, RCKitModalBtnType, RCKitModalForwardingType } from './core/EventDefined';
export type {
  DeleteMessageModalEvent, BeforeSystemConversationOpenEvent, IRCKitModalDeleteMessage, IRCKitModalDeleteMessageResult,
  IRCKitModalForwardingResult, IRCKitConversationExtensionClick, IRCKitConversationMenuItemClick,
  IRCKitInputMenuItemClick, IRCKitConversationIconClick, IRCKitDeleteMessageData, IRCKitMessageMenuItemClick, IRCKitMessageLinkClick,
  InputTextareaEventData, InputTextareaFocusEvent, InputTextareaBlurEvent, InputTextareaChangeEvent,
  BeforeSendMessageEventData, BeforeSendMessageEvent,
} from './core/EventDefined';
export type {
  IRCKitInputMenu, IRCKitInputMenuItem,
  IRCKitChatEmojiLibrary, IRCKitImageEmojiLibrary, IRCKitImageEmoji, IRCKitGifImageInfo,
} from './modules/InputModule';
export type { IRCKitMessageBubbleCfg } from './modules/BubbleModule';
export type { IRCKitConversationItemCfg } from './modules/conversation/ConversationItemModule';
export { RCKitBubbleLayout } from './modules/BubbleModule';
export { RCKitInputMenuPosition, RCKitInputMenuID, RCKitChatEmojiLibraryID } from './modules/InputModule';
export { RCKitConversationMenuID, type IRCKitConversationMenuItem } from './modules/ConversationMenu';
export { RCKitMessageMenuID, type IRCKitMessageMenuItem } from './modules/MessageMenu';
export type { IRCKitConversationExtension, IRCKitPushConfigHook } from './modules/RCKitStore';
export { isMobileDevice } from './helper';
