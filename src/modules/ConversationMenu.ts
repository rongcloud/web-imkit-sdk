import { NotificationLevel } from '@rongcloud/engine';
import { ConversationMenuItemClickEvent, RCKitEvents } from '@lib/core/EventDefined';
import { IRCKitCachedConversation } from './conversation/IRCKitCachedConversation';
import { RCKitModule } from './RCKitModule';
import {
  CONV_MENU_DELETE_ICON,
  // CONV_MENU_MARK_READED_ICON,
  // CONV_MENU_MARK_UNREAD_ICON,
  CONV_MENU_MUTE_ICON,
  CONV_MENU_TOP_ICON,
  CONV_MENU_UNMUTE_ICON,
  CONV_MENU_UNTOP_ICON,
} from '../assets';

/**
 * 会话菜单项 ID
 */
export enum RCKitConversationMenuID {
  /** 会话置顶 */
  ADD_TOP = 'conversation.menu.item.add_top',
  /** 取消置顶 */
  REMOVE_TOP = 'conversation.menu.item.remove_top',
  /** 会话免打扰 */
  MUTE = 'conversation.menu.item.mute',
  /** 取消免打扰 */
  UNMUTE = 'conversation.menu.item.unmute',
  /** 标记已读 */
  MARK_READ = 'conversation.menu.item.mark_read',
  /** 标记未读 */
  MARK_UNREAD = 'conversation.menu.item.mark_unread',
  /** 删除会话 */
  REMOVE = 'conversation.menu.item.remove',
}

export interface IRCKitConversationMenuItem {
  /**
   * 菜单 ID，SDK 在派发点击事件时包含此数据，同时也通过此 ID 查询多语言 UI 展示文案
   */
  id: RCKitConversationMenuID | string,
  /**
   * 菜单图标
   */
  icon: string,
  /**
   * 过滤器，返回 true 时显示菜单，返回 false 时不显示菜单
   * @param conversation
   */
  filter?: (conversation: IRCKitCachedConversation) => boolean,
}

const defaultMenu: IRCKitConversationMenuItem[] = [
  {
    id: RCKitConversationMenuID.ADD_TOP,
    icon: CONV_MENU_TOP_ICON,
    filter: (conversation: IRCKitCachedConversation) => !conversation.isTop,
  },
  {
    id: RCKitConversationMenuID.REMOVE_TOP,
    icon: CONV_MENU_UNTOP_ICON,
    filter: (conversation: IRCKitCachedConversation) => conversation.isTop,
  },
  {
    id: RCKitConversationMenuID.MUTE,
    icon: CONV_MENU_MUTE_ICON,
    filter: (conversation: IRCKitCachedConversation) => conversation.notificationLevel !== NotificationLevel.NOT_MESSAGE_NOTIFICATION,
  },
  {
    id: RCKitConversationMenuID.UNMUTE,
    icon: CONV_MENU_UNMUTE_ICON,
    filter(conversation) {
      return conversation.notificationLevel === NotificationLevel.NOT_MESSAGE_NOTIFICATION;
    },
  },
  // 应产品要求暂时隐藏“标记已读 / 标记未读”菜单，保留注释便于后续恢复。
  // {
  //   id: RCKitConversationMenuID.MARK_READ,
  //   icon: CONV_MENU_MARK_READED_ICON,
  //   // 会话未读数大于 0 或者会话被标记为未读时显示
  //   filter: (conversation: IRCKitCachedConversation) => (conversation.unreadCount > 0 || conversation.markUnread) && !conversation.markReaded,
  // },
  // {
  //   id: RCKitConversationMenuID.MARK_UNREAD,
  //   icon: CONV_MENU_MARK_UNREAD_ICON,
  //   // 会话未读数等于 0 或者会话被标记为已读时显示
  //   filter: (conversation: IRCKitCachedConversation) => (conversation.unreadCount === 0 || conversation.markReaded) && !conversation.markUnread,
  // },
  {
    id: RCKitConversationMenuID.REMOVE,
    icon: CONV_MENU_DELETE_ICON,
  },
];

const cloneConversationMenu = (menu: IRCKitConversationMenuItem[]): IRCKitConversationMenuItem[] => menu.map((item) => ({
  ...item,
}));

export class ConversationMenu extends RCKitModule {
  private _menu: IRCKitConversationMenuItem[] = cloneConversationMenu(defaultMenu);

  protected _onInit(): void {
    this.ctx.addEventListener(RCKitEvents.CONVERSATION_MENU_ITEM_CLICK, this._onMenuItemClick, this);
  }

  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    // 无需实现
  }

  public destroy(): void {
    this.ctx.removeEventListener(RCKitEvents.CONVERSATION_MENU_ITEM_CLICK, this._onMenuItemClick, this);
    this._menu = cloneConversationMenu(defaultMenu);
  }

  /**
   * 处理会话菜单项点击事件
   * @param event
   */
  private _onMenuItemClick(event: ConversationMenuItemClickEvent): void {
    const { id, conversation } = event.data;
    switch (id) {
      case RCKitConversationMenuID.ADD_TOP:
        this.ctx.conversation.setConversationToTop(conversation, true);
        break;
      case RCKitConversationMenuID.REMOVE_TOP:
        this.ctx.conversation.setConversationToTop(conversation, false);
        break;
      case RCKitConversationMenuID.MUTE:
        this.ctx.conversation.setConversationNotificationLevel(conversation, NotificationLevel.NOT_MESSAGE_NOTIFICATION);
        break;
      case RCKitConversationMenuID.UNMUTE:
        this.ctx.conversation.setConversationNotificationLevel(conversation, NotificationLevel.ALL_MESSAGE);
        break;
      case RCKitConversationMenuID.MARK_READ:
        this.ctx.conversation.markConversationReaded(conversation);
        break;
      case RCKitConversationMenuID.MARK_UNREAD:
        this.ctx.conversation.markConversationUnread(conversation);
        break;
      case RCKitConversationMenuID.REMOVE:
        this.ctx.conversation.removeConversation(conversation);
        break;
      default:
        // 业务自定义菜单项点击事件，不处理
        break;
    }
  }

  /**
   * 获取会话菜单，返回的菜单项会根据 filter 过滤
   * @param conversation
   */
  getMenum(conversation: IRCKitCachedConversation): IRCKitConversationMenuItem[] {
    return this._menu.filter((item) => !item.filter || item.filter(conversation));
  }

  cloneConversationMenu(): IRCKitConversationMenuItem[] {
    return cloneConversationMenu(this._menu);
  }

  setConversationMenu(menu: IRCKitConversationMenuItem[]): void {
    this._menu = cloneConversationMenu(menu);
  }
}
