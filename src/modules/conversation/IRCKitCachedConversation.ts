import { ConversationType, NotificationLevel } from '@rongcloud/imlib-next';
import { IRCKitCachedMessage } from '../MessageDataModule';
import { RCKitMentionedType } from './RCKitMenthionedType';

/**
 * 会话缓存数据结构
 */
export interface IRCKitCachedConversation {
  /** 根据 targetId、conversationType、channelId 生成的唯一标识 */
  key: string
  /** 会话 ID */
  targetId: string;
  /** 会话类型 */
  conversationType: ConversationType;
  /** Channel ID */
  channelId: string;
  /** 名称 */
  name: string;
  /** 头像 */
  portraitUri: string;
  /** 草稿数据 */
  draft: string;
  /** 会话内唯一可见编辑框的消息 UID，不代表修改请求锁。 */
  updatingMessageUId?: string;
  /** 最后一条消息 */
  latestMessage: null | IRCKitCachedMessage;
  /** 是否置顶 */
  isTop: boolean;
  /** 免打扰配置等级 */
  notificationLevel: NotificationLevel;
  /** 未读消息数 */
  unreadCount: number;
  /** 最后一条消息时间 */
  updateTime: number;
  /** 在线状态，未开启在线状态显示或未配置查询钩子的情况下，值均为 `false`; 非单聊会话均为 false */
  online: boolean
  /** 群成员数量，单聊会话中始终为 0 */
  memberCount: number;
  /** 群组会话中的汇总 @ 信息类型 */
  mentionedType: RCKitMentionedType;
  /** 是否处于被标记已读状态 */
  markReaded: boolean;
  /** 是否处于被标记未读状态 */
  markUnread: boolean;
}
