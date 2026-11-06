import {
  MessageDirection, MessageType, SentStatus, getAppSettings, ConversationType, getServerTime,
} from '@rongcloud/imlib-next';
import {
  MSG_MENU_COPY_ICON, MSG_MENU_DEELTE_ICON, MSG_MENU_REPLY_ICON, MSG_MENU_SELECT_ICON, MSG_MENU_FORWARD_ICON,
  MSG_MENU_STT_ICON,
  MSG_MENU_CANCEL_STT_ICON,
  MSG_MENU_RECALL_ICON,
  MSG_MENU_REACTIONS_ICON,
  MSG_MENU_EDIT_ICON,
} from '../assets';
import { IRCKitCachedMessage } from './MessageDataModule';
import { RCKitModule } from './RCKitModule';
import { SpeechToTextStore } from './SpeechToTextStore';

/**
 * 消息菜单项 ID
 */
export enum RCKitMessageMenuID {
  EDIT = 'message.menu.item.edit',
  /** 回复/引用 */
  REPLY = 'message.menu.item.reply',
  /** 表情回复 */
  REACTIONS = 'message.menu.item.reactions',
  /** 多选 */
  MULTI_CHOICE = 'message.menu.item.multi.choice',
  /** 复制 */
  COPY = 'message.menu.item.copy',
  /** 转发 */
  FORWARD = 'message.menu.item.forward',
  /** 删除 */
  DELETE = 'message.menu.item.delete',
  /** 转文字 */
  SPEECH_TO_TEXT = 'message.menu.item.speech.to.text',
  /** 取消转文字 */
  CANCEL_SPEECH_TO_TEXT = 'message.menu.item.cancel.speech.to.text',
  /** 撤回 */
  RECALL = 'message.menu.item.recall',
}

export interface IRCKitMessageMenuItem {
  /**
   * 菜单 ID，SDK 在派发点击事件时包含此数据，同时也通过此 ID 查询多语言 UI 展示文案
   */
  id: RCKitMessageMenuID | string,
  /**
   * 菜单图标
   */
  icon: string,
  /**
   * 过滤器，返回 true 时显示菜单，返回 false 时不显示菜单
   * @param message
   */
  readonly filter?: (message: IRCKitCachedMessage) => boolean,
}

export const canReactToMessage = (message: IRCKitCachedMessage): boolean => message.sentStatus === SentStatus.SENT;

const defaultMenu: IRCKitMessageMenuItem[] = [
  { id: RCKitMessageMenuID.EDIT, icon: MSG_MENU_EDIT_ICON },
  {
    id: RCKitMessageMenuID.RECALL,
    icon: MSG_MENU_RECALL_ICON,
    filter: (message) => message.messageDirection === MessageDirection.SEND && message.sentStatus !== SentStatus.FAILED && message.sentStatus !== SentStatus.SENDING,
  },
  {
    id: RCKitMessageMenuID.REPLY,
    icon: MSG_MENU_REPLY_ICON,
    // 引用/回复 仅限文本消息、文件消息、图片消息、图文消息、引用消息，其他不显示
    filter: (message) => {
      const types: string[] = [MessageType.TEXT, MessageType.IMAGE, MessageType.FILE, MessageType.RICH_CONTENT, MessageType.REFERENCE];
      return types.includes(message.messageType) && message.sentStatus !== SentStatus.SENDING && message.sentStatus !== SentStatus.FAILED;
    },
  },
  {
    id: RCKitMessageMenuID.REACTIONS,
    icon: MSG_MENU_REACTIONS_ICON,
    filter: canReactToMessage,
  },
  {
    id: RCKitMessageMenuID.COPY,
    icon: MSG_MENU_COPY_ICON,
    filter: (message) => (message.messageType === MessageType.TEXT || message.messageType === MessageType.REFERENCE) && !!navigator.clipboard,
  },
  {
    id: RCKitMessageMenuID.FORWARD,
    icon: MSG_MENU_FORWARD_ICON,
    filter: (message) => {
      const types: string[] = [
        MessageType.TEXT, MessageType.IMAGE, MessageType.FILE,
        MessageType.RICH_CONTENT, MessageType.HQ_VOICE, MessageType.VOICE,
        MessageType.COMBINE, MessageType.COMBINE_V2, MessageType.GIF,
        MessageType.SIGHT, MessageType.FILE, MessageType.REFERENCE,
      ];
      return types.includes(message.messageType) && message.sentStatus !== SentStatus.SENDING && message.sentStatus !== SentStatus.FAILED;
    },
  },
  {
    id: RCKitMessageMenuID.MULTI_CHOICE,
    icon: MSG_MENU_SELECT_ICON,
  },
  {
    id: RCKitMessageMenuID.DELETE,
    icon: MSG_MENU_DEELTE_ICON,
    filter: (message) => message.sentStatus !== SentStatus.SENDING,
  },
];

const cloneMsgMenu = (menu: IRCKitMessageMenuItem[]): IRCKitMessageMenuItem[] => menu.map((item) => ({ ...item }));

export class MessageMenu extends RCKitModule {
  private _menu: IRCKitMessageMenuItem[] = cloneMsgMenu(defaultMenu);

  private _speechToTextStore?: SpeechToTextStore;

  protected _onInit(): void {
    // 无需实现
  }

  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    // 无需实现
  }

  public destroy(): void {
    this._menu = cloneMsgMenu(defaultMenu);
  }

  public setSpeechToTextStore(store: SpeechToTextStore) {
    this._speechToTextStore = store;
  }

  getMenu(message: IRCKitCachedMessage): IRCKitMessageMenuItem[] {
    const isSTTEnabled = getAppSettings()?.isSpeechToTextEnabled || false;
    const isMessageInSendingOrFailed = [SentStatus.SENDING, SentStatus.FAILED].includes(message.sentStatus!);
    const isHQVoice = message.messageType === MessageType.HQ_VOICE;
    const hasConverted = this._speechToTextStore?.hasConverted(message.messageUId || '') || false;
    // 构建基础菜单
    let menu = this._menu.filter((item) => {
      if (item.id === RCKitMessageMenuID.EDIT && !this.ctx.message.canEdit(message, true)) {
        return false;
      }
      if (item.id === RCKitMessageMenuID.REACTIONS && !this.ctx.isMessageReactionEnabled) {
        return false;
      }

      // 增加撤回时间判断
      if (item.id === RCKitMessageMenuID.RECALL) {
        const now = getServerTime();
        const duration = now - message.sentTime;
        if (duration > this.ctx.allowedToRecallTime * 1000) {
          return false;
        }
      }

      // 系统会话仅支持复制和删除
      if (message.conversationType === ConversationType.SYSTEM) {
        if (item.id !== RCKitMessageMenuID.COPY && item.id !== RCKitMessageMenuID.DELETE) {
          return false;
        }
      }

      return !item.filter || item.filter(message);
    });

    // 处理转文字菜单
    if (isSTTEnabled && isHQVoice && !isMessageInSendingOrFailed) {
      if (hasConverted) {
        // 显示取消转文字按钮
        menu.push({
          id: RCKitMessageMenuID.CANCEL_SPEECH_TO_TEXT,
          icon: MSG_MENU_CANCEL_STT_ICON,
        });
      } else {
        // 未转换过，显示转文字
        menu.push({
          id: RCKitMessageMenuID.SPEECH_TO_TEXT,
          icon: MSG_MENU_STT_ICON,
        });
      }
    }
    return menu;
  }

  public cloneMessageMenu(): IRCKitMessageMenuItem[] {
    return cloneMsgMenu(this._menu);
  }

  public setMessageMenu(menu: IRCKitMessageMenuItem[]) {
    this._menu = cloneMsgMenu(menu);
  }
}
