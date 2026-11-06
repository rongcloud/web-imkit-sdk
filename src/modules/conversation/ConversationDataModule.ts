import {
  ConversationType, ErrorCode, Events,
  removeConversation, IConversationEvent,
  NotificationLevel, SentStatus,
  IAReceivedConversation, clearMessagesUnreadStatus,
  IConversationOption,
  setConversationToTop,
  setConversationNotificationLevel,
  MentionedType,
  getServerTime,
  electronExtension,
  clearUnreadCountByTimestamp,
  getUnreadCount,
  clearHistoryMessages,
  addEventListener, removeEventListener,
  IConversationState,
  getConversation, saveTextMessageDraft,
  clearTextMessageDraft, getTextMessageDraft,
  sendSyncReadStatusMessage, sendTypingStatusMessage, MessageType,
  getFirstUnreadMessage, IAReceivedMessage,
  ISyncReadStatusData,
  IUpdateItem,
  ReadReceiptResponseV5,
  GroupReadReceiptVersion,
  IMessageIdentifier,
  getMessageReadReceiptInfoV5ByIdentifiers,
  ReadReceiptInfoV5,
  RCResult,
  MessageDirection,
  getAppSettings,
  getConversationListByTimestamp,
} from '@rongcloud/imlib-next';

import {
  MessagesDeletedEvent, GroupProfilesUpdateEvent, IRCKitDeleteMessageData, InnerEvent, InsertNewMessagesEvent, MessageStateChangeEvent, RCKitEvents, RecvNewMessagesEvent, SystemProfilesUpdateEvent, UserProfilesUpdateEvent,
} from '@lib/core/EventDefined';
import { RCKitModule } from '../RCKitModule';
import { RCKitCommand } from '../../enums/RCKitCommand';
import { RCKitEvent } from '../../core/RCKitEvent';
import { LogTag } from '../../enums/LogTag';
import {
  isInvalidConversation, isSameConversation, trans2ConversationKey, createRCKitCacheMessage,
} from '../../helper';
import { IRCKitCachedMessage } from '../MessageDataModule';
import { InnerErrorCode } from '../../enums/RCKitCode';
import { RCKitMentionedType } from './RCKitMenthionedType';
import { IRCKitCachedConversation } from './IRCKitCachedConversation';
import type { IRCKitLanguageEntries } from '../../languages';
import type { IRCKitUserCacheSession } from '../../core/RCKitContext';

/** IMLib 返回该码时提示用户检查网络（与 SDK 文档约定一致） */
const IMLIB_ALERT_CHECK_NETWORK_CODE = 30002;

interface IConversationUnreadState {
  key: string;
  cached: IRCKitCachedConversation;
  userId: string;
  generation: number;
  revision: number;
  queue: Promise<void>;
  refresh?: Promise<void>;
  waitingForEvents: boolean;
  retryCount: number;
  retryTimer?: ReturnType<typeof setTimeout>;
}

/**
 * 会话列表数据模块
 * @description
 * 会话列表拉取与更新逻辑：
 * 1. 初始化即拉取全量会话列表，期间接收到的消息（仅 Electron）、会话事件均缓存，待会话列表拉取完成后，再处理；
 * 2. 会话列表拉取完成后，先处理消息（仅 Electron 会监听消息），再处理会话事件；
 */
export class ConversationDataModule extends RCKitModule {
  private _destroyed = false;

  /** 全量会话列表，列表排序顺序与 UI 显示顺序一致 */
  private _list: IRCKitCachedConversation[] = [];

  // 等待处理的消息队列
  private _messageQueue: IAReceivedMessage[] = [];

  /** 等待处理的会话通知队列 */
  private _converNtfQueue: IConversationState[] = [];

  /**
   * 会话缓存数据对象池，避免置顶列表与会话列表中存在相同会话的不同实例
   */
  private _pool: Map<string, IRCKitCachedConversation> = new Map();

  /** 按会话串行清理、合并刷新，防止异步查询覆盖较新的未读状态。 */
  private _unreadStates: Map<string, IConversationUnreadState> = new Map();

  /** 远端会话列表拉取失败时的延迟重试计时器 */
  private _getRemoteConversationTimer: any = null;

  /** 离线消息拉取完成 */
  private _pullOfflineMessageFinished: boolean = false;

  // 全局缓存：key=type|targetId|channelId|messageUId -> ReadReceiptInfoV5
  #_rrV5Map: Map<string, ReadReceiptInfoV5> = new Map();

  /** 是否开启会话包含超级群开关 */
  #_enableSuperGroup: boolean = false;

  /** 会话是否同步完成 */
  #_conversationSynced: boolean = false;

  /**
   * 已打开的会话
   */
  private _openedConversation: IRCKitCachedConversation | null = null;

  public getOpenedConversation(): IRCKitCachedConversation | null {
    return this._openedConversation;
  }

  public setOpenedConversation(conversation: IRCKitCachedConversation | null, focusInput: boolean = true): void {
    this._setOpenedConversation(conversation, focusInput);
  }

  /**
   * 创建会话缓存数据对象，若已存在则直接返回
   */
  private _createCachedConversation(conversation: IConversationOption): IRCKitCachedConversation {
    const key = trans2ConversationKey(conversation);
    if (this._pool.has(key)) {
      return this._pool.get(key)!;
    }

    const cached: IRCKitCachedConversation = {
      key,
      targetId: conversation.targetId,
      conversationType: conversation.conversationType,
      channelId: conversation.channelId || '',
      name: '',
      portraitUri: '',
      draft: '',
      latestMessage: null,
      isTop: false,
      notificationLevel: NotificationLevel.ALL_MESSAGE, // 默认所有会话接收通知
      unreadCount: 0,
      updateTime: 0,
      online: false,
      memberCount: 0,
      mentionedType: 0,
      markReaded: false,
      markUnread: false,
    };
    this._pool.set(key, cached);
    return cached;
  }

  protected _onInit(): void {
    this.ctx.addEventListener(InnerEvent.USER_PROFILES_UPDATE, this._onUserProfilesUpdate, this);
    this.ctx.addEventListener(InnerEvent.GROUP_PROFILES_UPDATE, this._onGroupProfilesUpdate, this);
    this.ctx.addEventListener(InnerEvent.SYSTEM_PROFILES_UPDATE, this._onSystemProfilesUpdate, this);

    this.ctx.addEventListener(InnerEvent.INSERT_NEW_MESSAGES, this._onInsertNewMessages, this);
    this.ctx.addEventListener(RCKitEvents.MESSAGES_DELETED, this._onDeleteMessages, this);
    this.ctx.addEventListener(InnerEvent.MESSAGE_STATE_CHANGE, this._onMessageStateChange, this);

    addEventListener(Events.SYNC_READ_STATUS, this._onSyncReadStatus, this);
    // 监听会话变更事件
    addEventListener(Events.CONVERSATION, this._onRecvConversationNtf, this);
    // 监听离线消息拉取完成通知
    addEventListener(Events.PULL_OFFLINE_MESSAGE_FINISHED, this._onPullOfflineMessageFinished, this);
    // 监听 V5 已读回执响应，刷新会话 latestMessage 的 readReceiptInfo
    addEventListener(Events.MESSAGE_RECEIPT_RESPONSE_V5, this._onV5ReceiptResponse, this);
    // 连接状态变更事件
    addEventListener(Events.CONNECTED, this._onConnected, this);
    // 监听会话同步完成事件（仅在开启超级群开关时使用）
    addEventListener(Events.CONVERSATIONS_SYNCED, this._onConversationsSynced, this);

    if (electronExtension.enable()) {
      this.ctx.addEventListener(InnerEvent.RECV_NEW_MESSAGES, this._onRecvNewMessages, this);
    }
  }

  protected _onInitUserCache(): void {
    if (!this.#_enableSuperGroup) {
      // 未开启超级群开关，直接请求会话列表数据，开启后需要等待会话列表同步完成后再请求
      this._getMoreRemoteConversation(true);
    }
  }

  protected _onDestroyUserCache(): void {
    this._unreadStates.forEach((state) => clearTimeout(state.retryTimer));
    this._unreadStates.clear();
    // 登录用户发生变更，需要清空原用户内存数据
    this._list.length = 0;
    this._pool.clear();
    this.#_rrV5Map.clear();
    this._messageQueue.length = 0;
    this._converNtfQueue.length = 0;
    this._openedConversation = null;
    this._getRemoteConversationFinished = false;
    this._pullOfflineMessageFinished = false;

    if (this._getRemoteConversationTimer) {
      clearTimeout(this._getRemoteConversationTimer);
      this._getRemoteConversationTimer = null;
    }
    if (this._handleQueueTimer) {
      clearTimeout(this._handleQueueTimer);
      this._handleQueueTimer = null;
    }

    this._clearTypingStatus();

    this.#_enableSuperGroup = false;
    this.#_conversationSynced = false;
  }

  public destroy(): void {
    this._destroyed = true;
    this._onDestroyUserCache();
    this.ctx.removeEventListener(InnerEvent.USER_PROFILES_UPDATE, this._onUserProfilesUpdate, this);
    this.ctx.removeEventListener(InnerEvent.GROUP_PROFILES_UPDATE, this._onGroupProfilesUpdate, this);
    this.ctx.removeEventListener(InnerEvent.SYSTEM_PROFILES_UPDATE, this._onSystemProfilesUpdate, this);

    this.ctx.removeEventListener(InnerEvent.INSERT_NEW_MESSAGES, this._onInsertNewMessages, this);
    this.ctx.removeEventListener(RCKitEvents.MESSAGES_DELETED, this._onDeleteMessages, this);
    this.ctx.removeEventListener(InnerEvent.MESSAGE_STATE_CHANGE, this._onMessageStateChange, this);

    removeEventListener(Events.SYNC_READ_STATUS, this._onSyncReadStatus, this);

    removeEventListener(Events.PULL_OFFLINE_MESSAGE_FINISHED, this._onPullOfflineMessageFinished, this);
    removeEventListener(Events.CONVERSATION, this._onRecvConversationNtf, this);
    removeEventListener(Events.MESSAGE_RECEIPT_RESPONSE_V5, this._onV5ReceiptResponse, this);
    removeEventListener(Events.CONNECTED, this._onConnected, this);
    removeEventListener(Events.CONVERSATIONS_SYNCED, this._onConversationsSynced, this);

    this.ctx.removeEventListener(InnerEvent.RECV_NEW_MESSAGES, this._onRecvNewMessages, this);
  }

  private _getUserCacheSession(): IRCKitUserCacheSession {
    return { userId: this.ctx.userId, generation: this.ctx.userCacheGeneration };
  }

  private _isCurrentUserCache(session: IRCKitUserCacheSession): boolean {
    return !this._destroyed
      && session.userId === this.ctx.userId
      && session.generation === this.ctx.userCacheGeneration;
  }

  private async _onDeleteMessages(evt: MessagesDeletedEvent) {
    const list: IRCKitDeleteMessageData[] = evt.data;

    // 所有被同一批次删除或撤销的消息，必定属于为同一会话，且为时间正序排列，取最后一条消息即可
    const { target, recallMsg } = list[list.length - 1]!;
    const cached = this._pool.get(trans2ConversationKey(target));
    if (!cached) {
      return;
    }

    // Electron 撤回消息不会作为消息通知给 UI，所以在 DeleteMessage 更新会话状态
    if (electronExtension.enable() && recallMsg) {
      const state = this._getUnreadState(cached)!;
      this._invalidateUnreadState(cached);
      const { conversationType, targetId, channelId } = recallMsg;
      const { data } = await getConversation({ conversationType, targetId, channelId });
      if (!data || !this._isCurrentUnreadState(state)) return;
      this._paddingData(cached, data!);
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
      await this._refreshUnreadState(cached);
      return;
    }

    const { latestMessage } = cached;
    if (!latestMessage
      || (latestMessage.transactionId !== target.transactionId && latestMessage.messageUId !== target.messageUId)
    ) {
      return;
    }

    // 更新会话最后一条消息, TODO: 可以考虑缓存的最后一条消息赋值给 latestMessage，防止出现为 null 的情况
    cached.latestMessage = recallMsg || this.ctx.message.getConversationLatestMessage(cached);
    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
  }

  /**
   * 处理本地插入消息时间，时间会导致会话列表顺序变更；
   * 若会话不存在，需要新建会话；
   * 若会话存在，需要更新会话列表顺序及最后一条消息;
   * 插入会话，一般所有消息均属于同一会话，可做优化处理
   * @param evt
   */
  private async _onInsertNewMessages(evt: InsertNewMessagesEvent) {
    // 更新会话列表
    const messages = evt.data;
    // 不能使用 pop，因为 UI 等模块也会监听同一事件进行 UI 处理
    const message = messages[messages.length - 1];
    const key = trans2ConversationKey(message);
    let conversation = this._pool.get(key);

    if (!conversation) {
      // 一般不会存在插入会话时，回话不存在的情况，除非业务层调插入接口时传入了不存在的会话参数
      const res = this._parseConversationList([{
        latestMessage: message,
        conversationType: message.conversationType,
        targetId: message.targetId,
        channelId: message.channelId,
        lastUnreadTime: 0,
      }]);
      conversation = res[0]!;
    }
    conversation.latestMessage = message;
    conversation.updateTime = message.sentTime;
    conversation.markReaded = true;
    conversation.markUnread = false;

    this._recalculatePosition(new Set([conversation]));
  }

  /**
   * 发送状态变更事件，一般为发送状态变更，或文件上传进度变更等。状态变更不影响列表排序
   * @param evt
   */
  private _onMessageStateChange(evt: MessageStateChangeEvent): void {
    const messages = evt.data;
    const changed: IRCKitCachedConversation[] = [];
    messages.forEach((item) => {
      const key = trans2ConversationKey(item);
      const conversation = this._pool.get(key);
      if (!conversation) {
        // 本地缓存中不存在的会话，该情况可能是由于消息发送完成之前用户删除了会话，此时不做处理
        return;
      }

      // 查看是否为回话的最后一条消息，否则不做处理
      if (conversation.latestMessage && (conversation.latestMessage.transactionId === item.transactionId || conversation.latestMessage.messageUId === item.messageUId)) {
        conversation.latestMessage = item;
        changed.push(conversation);
      }
    });

    if (changed.length) {
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, changed));
    }
  }

  protected _getMentionedType(userId: string, mentionedInfo?: { userIdList: string[], type: MentionedType }) {
    if (!mentionedInfo) {
      return RCKitMentionedType.NONE;
    }
    const { type, userIdList } = mentionedInfo;
    if (type === MentionedType.ALL) {
      return RCKitMentionedType.AT_ALL;
    }

    if (!userIdList || !Array.isArray(userIdList)) {
      return RCKitMentionedType.NONE;
    }

    return userIdList.includes(userId) ? RCKitMentionedType.AT_ME : RCKitMentionedType.NONE;
  }

  private _getConversationMentionedType(
    conversation?: Pick<IAReceivedConversation, 'conversationType' | 'hasMentioned' | 'mentionedInfo'>,
  ): RCKitMentionedType {
    if (!conversation || conversation.conversationType !== ConversationType.GROUP || !conversation.hasMentioned) {
      return RCKitMentionedType.NONE;
    }

    // Electron 平台返回的会话数据不包含 mentionedInfo，hasMentioned 为 true 时统一兜底为 @我。
    return conversation.mentionedInfo?.type === MentionedType.ALL
      ? RCKitMentionedType.AT_ALL
      : RCKitMentionedType.AT_ME;
  }

  private _onUserProfilesUpdate(e: UserProfilesUpdateEvent): void {
    const changed: IRCKitCachedConversation[] = [];
    e.data.forEach((item) => {
      const conversation = this._pool.get(trans2ConversationKey({
        conversationType: ConversationType.PRIVATE,
        targetId: item.userId,
      }));
      if (!conversation) {
        return;
      }
      if (conversation.name !== item.name || conversation.portraitUri !== item.portraitUri || conversation.online !== item.online) {
        conversation.name = item.name;
        conversation.portraitUri = item.portraitUri;
        conversation.online = item.online;
        changed.push(conversation);
      }
    });

    if (changed.length) {
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, changed));
    }
  }

  private _onSystemProfilesUpdate(evt: SystemProfilesUpdateEvent): void {
    const changed: IRCKitCachedConversation[] = [];
    evt.data.forEach((item) => {
      const conversation = this._pool.get(trans2ConversationKey({
        conversationType: ConversationType.SYSTEM,
        targetId: item.systemId,
      }));
      if (!conversation) {
        return;
      }
      if (conversation.name !== item.name || conversation.portraitUri !== item.portraitUri) {
        conversation.name = item.name;
        conversation.portraitUri = item.portraitUri;
        changed.push(conversation);
      }
    });

    if (changed.length) {
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, changed));
    }
  }

  private _onGroupProfilesUpdate(e: GroupProfilesUpdateEvent): void {
    const profiles = e.data;
    const changed: IRCKitCachedConversation[] = [];
    profiles.forEach((item) => {
      const opt: IConversationOption = {
        conversationType: ConversationType.GROUP,
        targetId: item.groupId,
      };

      const conversation = this._pool.get(trans2ConversationKey(opt));
      if (!conversation) {
        return;
      }

      // 会话数据仅关心群名称、头像、群成员数量
      if (conversation.name !== item.name || conversation.portraitUri !== item.portraitUri || conversation.memberCount !== item.memberCount) {
        conversation.name = item.name;
        conversation.portraitUri = item.portraitUri;
        conversation.memberCount = item.memberCount;
        changed.push(conversation);
      }
    });

    if (changed.length) {
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, changed));
    }
  }

  /**
   * 更新群组会话latestMessage的发送状态
   */
  updateLatesMessageStatus(list: IRCKitCachedConversation[]): void {
    if (!list || list.length <= 0) return;
    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      // V5 逻辑：已读信息通过 kitReadReceiptInfo 处理
      const privateList = list.filter((item) => item.conversationType === ConversationType.PRIVATE && item.latestMessage && item.latestMessage.senderUserId === this.ctx.userId);
      this._handleLatestReadReceiptInfoV5(privateList);
    }
  }

  /**
   * 处理多端未读数同步
   */
  private async _onSyncReadStatus(e: ISyncReadStatusData): Promise<void> {
    const conversation = {
      conversationType: e.conversationType,
      channelId: e.channelId || '',
      targetId: e.targetId,
    };
    await this._refreshUnreadState(conversation);
  }

  private _onRecvConversationNtf(e: IConversationEvent): void {
    e.conversationList.forEach(({ conversation, updatedItems }) => {
      if (updatedItems?.latestMessage || updatedItems?.unreadMessageCount || updatedItems?.hasMentioned || updatedItems?.mentionedInfo) {
        this._invalidateUnreadState(conversation);
      }
    });
    this._converNtfQueue.push(...e.conversationList);
  }

  /**
   * 处理会话通知，并将处理后的缓存会话返回
   * @returns - 返回的 changeType 变更类型，0：无变更，1：状态变更，位置不变，2：会话位置变更
   */
  private _handleConversationNtf(item: IConversationState): { changeType: number, conversation?: IRCKitCachedConversation } {
    const { conversation, updatedItems } = item;
    const key = trans2ConversationKey(conversation);
    let changeType = 0;

    // 获取缓存会话
    let cached = this._pool.get(key);
    if (cached && updatedItems) {
      return this._handleUpdatedItems(cached, updatedItems, conversation);
    }

    if (!cached && updatedItems?.latestMessage) {
      if (conversation.conversationType === ConversationType.PRIVATE) {
        cached = this._transPriConversation(conversation);
      } else if (conversation.conversationType === ConversationType.GROUP) {
        cached = this._transGroupConversation(conversation);
      } else {
        cached = this._transSystemConversation(conversation);
      }
      return { changeType: 2, conversation: cached };
    }
    return { changeType };
  }

  private _handleUpdatedItems(cached: IRCKitCachedConversation, updatedItems: IUpdateItem, conversation: IAReceivedConversation) {
    let changeType = 0;
    const isElectron = electronExtension.enable();
    const unreadChanged = !!(updatedItems.latestMessage?.val || updatedItems.unreadMessageCount
      || updatedItems.hasMentioned || updatedItems.mentionedInfo);
    // 处理会话置顶状态
    if (updatedItems.isTop) {
      cached.isTop = updatedItems.isTop.val;
      changeType = Math.max(2, changeType);
    }
    // 处理会话免打扰状态
    if (updatedItems.notificationLevel) {
      cached.notificationLevel = updatedItems.notificationLevel.val;
      changeType = Math.max(1, changeType);
    }
    // 处理最后一条消息更新
    if (updatedItems.latestMessage?.val) {
      this._paddingData(cached, conversation);
      // 会话未读数累加需重置 markReaded 和 markUnread，防止菜单按钮展示错误
      if (cached.markReaded && conversation.unreadMessageCount) {
        cached.markReaded = false;
      }
      changeType = Math.max(2, changeType);
    }

    // 处理未读数更新 (独立于最新消息更新的情况)
    if (updatedItems.unreadMessageCount && !updatedItems.latestMessage?.val) {
      cached.unreadCount = conversation.unreadMessageCount || 0;
      if (cached.markReaded && cached.unreadCount > 0) {
        cached.markReaded = false;
      }
      changeType = Math.max(1, changeType);
    }

    // Web 会话快照包含 @ 信息；类型变化时 hasMentioned 可能仍为 true。
    if (!isElectron && unreadChanged) {
      cached.mentionedType = cached.unreadCount === 0
        ? RCKitMentionedType.NONE
        : this._getConversationMentionedType(conversation);
      changeType = Math.max(1, changeType);
    }

    if (unreadChanged && (isElectron || this._unreadStates.has(cached.key))) {
      this._refreshUnreadState(conversation);
    }

    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      // 回填最新消息回执（若缓存有）
      try {
        const key = `${cached.conversationType}|${cached.targetId}|${cached.channelId || ''}|${cached.latestMessage?.messageUId || ''}`;
        const info = this.#_rrV5Map.get(key);
        if (info) {
          cached.latestMessage!.kitReadReceiptInfo = info;
          changeType = Math.max(1, changeType);
        }
      } catch (e) {
        this.logger.warn(LogTag.L_HANDLE_READ_RECEIPT_V5_E, `handle Updated Items error: ${e}`);
      }
    }
    return { changeType, conversation: cached };
  }

  private _paddingData(cached: IRCKitCachedConversation, data: IAReceivedConversation): void {
    cached.latestMessage = data.latestMessage ? createRCKitCacheMessage(data.latestMessage) : null;
    cached.unreadCount = data.unreadMessageCount || 0;
    cached.isTop = !!data.isTop;
    if (electronExtension.enable()) {
      cached.draft = data.draft || '';
      // Electron 平台下会话列表数据使用操作时间作为 updateTime
      cached.updateTime = data.operationTime! || (data.latestMessage ? data.latestMessage.sentTime : 0);
    } else {
      cached.updateTime = data.latestMessage ? data.latestMessage.sentTime : 0;
    }
    if (data.notificationLevel) {
      cached.notificationLevel = data.notificationLevel;
    }
  }

  protected _transPriConversation(item: IAReceivedConversation): IRCKitCachedConversation {
    const profile = this.ctx.appData.getUserProfiles([item.targetId])[0];
    const cached = this._createCachedConversation(item);
    cached.name = profile.name;
    cached.portraitUri = profile.portraitUri;
    cached.online = profile.online;
    this._paddingData(cached, item);
    return cached;
  }

  protected _transSystemConversation(item: IAReceivedConversation): IRCKitCachedConversation {
    const profile = this.ctx.appData.getSystemProfiles([item.targetId])[0];
    const cached = this._createCachedConversation(item);
    cached.name = profile.name;
    cached.portraitUri = profile.portraitUri;
    this._paddingData(cached, item);
    return cached;
  }

  protected _transGroupConversation(item: IAReceivedConversation): IRCKitCachedConversation {
    const profile = this.ctx.appData.getGroupProfiles([item.targetId])[0];
    const cached = this._createCachedConversation(item);
    cached.name = profile.name;
    cached.portraitUri = profile.portraitUri;
    cached.memberCount = profile.memberCount;
    cached.mentionedType = this._getConversationMentionedType(item);
    this._paddingData(cached, item);
    return cached;
  }

  /**
   * 解析会话列表数据
   */
  private _parseConversationList(list: IAReceivedConversation[]): IRCKitCachedConversation[] {
    const result: IRCKitCachedConversation[] = [];

    list.forEach((item) => {
      const { targetId, conversationType, latestMessage } = item;

      if (latestMessage) {
        if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
          // V5 逻辑：使用 readReceiptInfo 判断（v5中已读信息通过readReceiptInfo传递）
          if (latestMessage.readReceiptInfo && latestMessage.senderUserId === this.ctx.userId) {
            latestMessage.sentStatus = SentStatus.READ;
          }
        }
      }
      switch (conversationType) {
        case ConversationType.PRIVATE:
          result.push(this._transPriConversation(item));
          return;
        case ConversationType.GROUP:
          result.push(this._transGroupConversation(item));
          return;
        case ConversationType.SYSTEM:
          result.push(this._transSystemConversation(item));
          return;
        default:
          // 无法解析的数据类型，打印提示
          this.logger.warn(LogTag.L_PARSE_CONVERSATION_E, `unsupport conversation type: ${conversationType}`);
      }
    });

    return result;
  }

  /**
   * 获取既有的会话列表缓存
   * @returns
   */
  getCachedConversationList(): IRCKitCachedConversation[] {
    return this._list.slice();
  }

  /**
   * 将会话添加到会话列表，根据会话 `updateTime` 与 `isTop` 值排序，并返回其当前所处的索引位置
   * @param item
   * @param sort - 若列表已存在该会话，是否重新计算其位置，若为 false，则终止插入
   * @returns - 返回会话在列表中的原始位置与当前位置
   */
  private _addToConversationList(item: IRCKitCachedConversation, sort: boolean = true): {
    /**
     * 原始位置
     */
    origin: number,
    /**
     * 当前位置
     */
    current: number
  } {
    // 如果会话列表中有重复数据，说明会话列表数据的过程中远端列表发生过变更
    let origin = this._list.findIndex((conv) => isSameConversation(conv, item));
    if (origin > -1) {
      if (!sort) {
        return { origin, current: origin };
      }

      // 从原位置删除元素，以便于重新计算位置
      this._list.splice(origin, 1);
    }

    const { isTop, updateTime } = item;

    // 查找新的插入位置：排序规则为 isTop 降序、updateTime 降序；
    // 当 isTop 与 updateTime 完全一致时，需保持稳定排序（不能把“原本就在列表中的 item”全部挤到末尾），
    // 否则对于一批排序键完全相同的会话（例如 isTop=true 且 latestMessage 为 null 时 updateTime=0），
    // 重排会导致每条 item 返回的 current 都等于 list.length-1，与实际位置不符。
    let current = this._list.findIndex((conv, idx) => {
      if (isTop !== conv.isTop) {
        return isTop;
      }
      if (updateTime !== conv.updateTime) {
        return updateTime > conv.updateTime;
      }
      // 排序键相等：已在列表中的 item 保留 origin 位置；splice 后原 origin 及其之后的 item 索引前移，
      // 因此遇到 idx >= origin 的同键元素时，将 item 插到该元素之前即可还原原位置
      return origin > -1 && idx >= origin;
    });

    if (current === -1) {
      current = this._list.length;
    }
    this._list.splice(current, 0, item);
    return { origin, current };
  }

  /** 处理从消息模块接收到的数据，仅 Electron 需要 */
  private _onRecvNewMessages(evt: RecvNewMessagesEvent) {
    evt.data.forEach((message) => this._invalidateUnreadState(message));
    this._messageQueue.push(...evt.data);
  }

  /**
   * 处理消息数据，并将处理后的缓存会话返回
   * @returns - 返回的 changeType 变更类型，0：无变更，1：状态变更，位置不变，2：会话位置变更
   */
  private _handleMessage(message: IRCKitCachedMessage): { changeType: number, conversation: IRCKitCachedConversation } {
    const currentUserId = this.ctx.userId;
    // 0：无变更，1：状态变更，位置不变，2：会话位置变更
    let changeType = 0;
    // 根据消息批量更新会话列表
    const key = trans2ConversationKey(message);
    const {
      content, conversationType, targetId, channelId, sentTime, isCounted, senderUserId,
    } = message;

    // 获取缓存会话
    let conversation = this._pool.get(key);
    if (!conversation) { // 无会话记录，需要新增会话
      const item: IAReceivedConversation = {
        latestMessage: message,
        conversationType,
        targetId,
        channelId,
        lastUnreadTime: 0,
      };

      // 非法数据在消息模块已处理，如非法会话类型消息、非存储的消息等
      if (conversationType === ConversationType.PRIVATE) {
        conversation = this._transPriConversation(item);
      } else if (conversationType === ConversationType.GROUP) {
        conversation = this._transGroupConversation(item);
      } else {
        conversation = this._transSystemConversation(item);
      }

      changeType = 2;
    }

    // 计算 @ 信息，根据显示规则，如果已经是 @我，是最高显示优先级，无需继续计算
    if (conversationType === ConversationType.GROUP && conversation.mentionedType !== RCKitMentionedType.AT_ME && senderUserId !== currentUserId) {
      conversation.mentionedType = Math.max(this._getMentionedType(currentUserId, content.mentionedInfo), conversation.mentionedType);
      changeType = Math.max(changeType, 1);
    }

    // 消息的发送时间若大于会话的 updateTime 操作时间，更新会话的 updateTime 与 latestMessage
    if (sentTime >= conversation.updateTime) {
      conversation.latestMessage = message;
      conversation.updateTime = sentTime;
      changeType = 2;
    }

    // 更新未读数
    if (isCounted && senderUserId !== currentUserId) {
      conversation.unreadCount += 1;
      // 会话未读数累加需重置 markReaded 和 markUnread，防止菜单按钮展示错误
      conversation.markReaded = false;
      changeType = Math.max(changeType, 1);
    }

    if (this._unreadStates.has(key)) {
      this._refreshUnreadState(conversation);
    }

    return { changeType, conversation };
  }

  /**
   * 批量计算会话新位置，并对外派发会话列表排序变更事件
   * @param changed
   * @description 由于是批量处理，可能包含状态变更，因此不考虑 origin 与 current 相等的情况，照常计算通知
   */
  private _recalculatePosition(changed: Set<IRCKitCachedConversation>): void {
    const evtData: { order: number, conversation: IRCKitCachedConversation }[] = [];
    // 按 updateTime 升序排列，以便于有限处理位置更靠后的会话，使其变更不会影响前面的排序结果
    // 列表渲染时，根据 evtData 中的顺序还原变更列表即可
    const list = [...changed].sort((a, b) => a.updateTime - b.updateTime);
    // 统一处理位置变更
    list.forEach((conversation) => {
      const { current } = this._addToConversationList(conversation);
      evtData.push({ order: current, conversation });
    });
    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_ORDER_CHANGE, evtData));
  }

  /**
   * 获取远端会话列表数据
   * @param firstScreen - 是否是拉取首屏动作
   * @description - 首屏拉取时，数据仅为做及时渲染显示，无需确保数据准确，也不需拉取完整数据。
   * 当离线消息拉取完成后，会重新拉取全量会话列表覆盖
   */
  private async _getMoreRemoteConversation(
    firstScreen: boolean = false,
    startTime: number = 0,
    session: IRCKitUserCacheSession = this._getUserCacheSession(),
  ) {
    if (!this._isCurrentUserCache(session)) return;
    const count = startTime === 0 ? 30 : 200;
    const { code, data } = await getConversationListByTimestamp({ count, startTime });
    if (!this._isCurrentUserCache(session)) return;

    if (firstScreen && this._pullOfflineMessageFinished) {
      // 离线消息拉取完成，直接丢弃首屏数据
      return;
    }

    if (code !== ErrorCode.SUCCESS && !firstScreen) {
      // 首屏数据为临时数据，失败无需重试
      this.logger.error(LogTag.L_GET_CONVERSATION_E, `get conversation list failed: code = ${code}, count = ${count}, startTime = ${startTime}`);
      // 1s 后重试
      this._getRemoteConversationTimer = setTimeout(() => this._getMoreRemoteConversation(firstScreen, startTime, session), 1000);
      return;
    }

    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
    // 拉取并绑定最新消息的 V5 已读信息
      // 异步并行，不阻塞会话列表主流程
      this._handleLatestReadReceiptInfoV5(data || []);
    }

    const conversationList: IAReceivedConversation[] = data || [];
    if (conversationList.length === 0 || firstScreen) {
      // 无数据，不做处理，终止递归
      this._onGetRemoteConversationListDone(firstScreen);
      return;
    }

    const reset = startTime === 0 && !firstScreen;
    if (reset) {
      // 清空原临时首屏数据
      this._list.length = 0;
    }

    // 解析会话列表数据，并同步填充业务数据
    const list = this._parseConversationList(conversationList);

    // 由于会话列表数据是按照 updateTime 降序排列的，因此取最后一条数据的 updateTime 作为下一页请求的游标，确保分页拉取过程中数据不会遗漏或重复
    const nextRequestTimestamp = data![data!.length - 1]!.operationTime!;
    // 需要排重处理，原因在于会话列表数据获取过程中，SDK 接收消息造成数据库中的会话列表数据变更
    // sort 为 false 是因为 list 是降序排列，如果会话已存在于列表中，说明该会话在拉取过程中发生了变更，应以客户端当前为准，不需要重新计算位置
    list.forEach((item) => this._addToConversationList(item, false));

    // 通知 UI 同步完整会话列表：
    // - reset 场景：清空临时首屏数据后，首批数据入 `_list`，UI 需首屏渲染；
    // - 非 reset 场景：分页递归追加数据后，也必须通知 UI 同步最新 `_list`。
    //   原因：`_handleNextRequestTimestamp` 仅向 `_list` 追加数据，不主动派发事件；
    //   若 UI 仍停留在上一屏的快照，后续任何触发 `_recalculatePosition` 的会话
    //   变更事件，其 `order` 都是基于当前完整 `_list`（size = 上一屏 + 本次追加）
    //   计算的。UI 拿该 `order` 直接对"旧快照"做 splice，就会错位/重复插入
    //   （表现为"间隔一个插入置顶数据"等异常）。
    // 注：前面的早返回已保证此处 `firstScreen === false` 且 `list.length > 0`，
    // 因此无需再区分分支。如果担心 RESET 一次性替换整个列表对大量数据场景有性能影响（分页会累积，200 条/页）后续可评估新增 CONVERSATION_LIST_APPEND 事件，UI 侧 push 追加
    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_LIST_RESET, this._list));

    if (
      !nextRequestTimestamp // 数据最后一条没有时间记录，无法继续分页拉取
      || firstScreen
      || electronExtension.enable()
      || conversationList.length < count // 服务端返回的数据条数小于请求的 count，说明已经没有更多数据了
    ) {
      // electron 平台 getConversationList 接口会一次性返回所有会话，不需要分页拉取
      // 首屏仅需拉取一屏即可，无需全量拉取
      this._onGetRemoteConversationListDone(firstScreen);
      return;
    }

    // 递归拉取更多数据，为避免限频，每次拉取间隔 300ms
    this._getRemoteConversationTimer = setTimeout(() => this._getMoreRemoteConversation(false, nextRequestTimestamp, session), 300);
  }

  private _onPullOfflineMessageFinished(): void {
    // 停止正在进行的首屏数据拉取
    if (this._getRemoteConversationTimer) {
      clearTimeout(this._getRemoteConversationTimer);
      this._getRemoteConversationTimer = null;
    }

    // 停止进行中的解析动作，保护“首次加载时，全量拉取会话列表”的过程不被打断和污染
    if (this._handleQueueTimer) {
      clearTimeout(this._handleQueueTimer);
      this._handleQueueTimer = null;
    }

    // 是否是首次拉取离线消息（断线重连时，不需要重新拉会话）
    if (!this._pullOfflineMessageFinished) {
      this._getMoreRemoteConversation(false);
    } else {
      // 重连场景下拉取离线消息完毕，需要重新触发队列解析
      // 否则因为上面清除了 _handleQueueTimer，队列将永久停止
      this._handleQueueDelay();
    }

    this._pullOfflineMessageFinished = true;
  }

  private _onConnected() {
    // 初始化超级群开关设置
    this.#_getConversationListIncludeUltraGroup();
    if (!this._getRemoteConversationFinished && !this.#_enableSuperGroup) {
      this._getMoreRemoteConversation(true);
    }
  }

  private _onConversationsSynced() {
    this.#_conversationSynced = true;
    if (!this._pullOfflineMessageFinished) {
      // lib 通知会话同步完成，立刻调用还是会返回 35011，待lib 修复后可去掉 setTimeout
      const session = this._getUserCacheSession();
      setTimeout(() => this._getMoreRemoteConversation(false, 0, session), 100);
    }
  }

  /**
   * 初始化超级群开关设置
   * 从 imlib 的 getSetting 中获取是否开启会话包含超级群的开关
   */
  #_getConversationListIncludeUltraGroup() {
    const { isConversationListIncludeUltraGroup } = getAppSettings() || {};
    this.#_enableSuperGroup = !!isConversationListIncludeUltraGroup;
  }

  /**
   * 并行拉取最新消息的 V5 已读信息，并写入会话对象的 readReceiptInfo
   */
  private async _handleLatestReadReceiptInfoV5(list: IAReceivedConversation[]) {
    const session = this._getUserCacheSession();
    if (!this._isCurrentUserCache(session)) return;
    const identifiers = this._buildIdentifiersForLatest(list);
    if (!identifiers.length) return;

    const batchSize = 100;
    const batches: IMessageIdentifier[][] = [];
    for (let i = 0; i < identifiers.length; i += batchSize) {
      batches.push(identifiers.slice(i, i + batchSize));
    }
    try {
      const results = await Promise.all(batches.map((ids) => getMessageReadReceiptInfoV5ByIdentifiers(ids)));
      if (!this._isCurrentUserCache(session)) return;
      results.forEach((res: RCResult<ReadReceiptInfoV5[]>) => {
        const arr: ReadReceiptInfoV5[] = res?.data || [];
        arr.forEach((it: ReadReceiptInfoV5) => {
          const id = it?.identifier || {};
          const key = `${id.conversationType}|${id.targetId}|${id.channelId || ''}|${it.messageUId}`;
          this.#_rrV5Map.set(key, it);
        });
      });
      const changed: IRCKitCachedConversation[] = [];
      this._list.forEach((conv) => {
        if (conv.conversationType !== ConversationType.PRIVATE) return;
        const msg = conv.latestMessage as IAReceivedMessage;
        if (!msg?.messageUId) return;
        const k = `${conv.conversationType}|${conv.targetId}|${conv.channelId || ''}|${msg.messageUId}`;
        const info = this.#_rrV5Map.get(k);
        if (info) {
          conv.latestMessage!.kitReadReceiptInfo = info;
          this._pool.set(conv.key, conv);
          changed.push(conv);
        }
      });
      if (changed.length) {
        this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, changed));
      }
    } catch (e) {
      if (!this._isCurrentUserCache(session)) return;
      this.logger?.warn(LogTag.L_GET_READ_RECEIPT_INFO_V5_E, `getMessageReadReceip·tInfoV5ByIdentifiers error: ${e}`);
    }
  }

  /**
   * 提取单聊己方发送的 latestMessage，构建 IMessageIdentifier[]
   */
  private _buildIdentifiersForLatest(list: IAReceivedConversation[]): IMessageIdentifier[] {
    const identifiers: IMessageIdentifier[] = [];
    list.forEach((item) => {
      const msg = item.latestMessage as IAReceivedMessage;
      if (item.conversationType === ConversationType.PRIVATE
        && msg?.messageDirection === MessageDirection.SEND
        && msg?.messageUId) {
        identifiers.push({
          identifier: { conversationType: item.conversationType, targetId: item.targetId, channelId: item.channelId },
          messageUId: msg.messageUId,
        });
      }
    });
    return identifiers;
  }

  /**
   * V5 回执响应：更新内存态会话的 readReceiptInfo 并通知 UI
  */
  private _onV5ReceiptResponse(responses: ReadReceiptResponseV5[]): void {
    if (this.ctx.readReceiptVersion !== GroupReadReceiptVersion.V5) return;
    try {
      if (!responses || !Array.isArray(responses)) return;
      responses.forEach((info: ReadReceiptResponseV5) => {
        const id = info?.identifier || {};
        const v5CacheKey = `${id.conversationType}|${id.targetId}|${id.channelId || ''}|${info.messageUId}`;
        // 写入全局缓存，供后续会话通知回填
        this.#_rrV5Map.set(v5CacheKey, info);

        const convKey = trans2ConversationKey({ conversationType: id.conversationType, targetId: id.targetId, channelId: id.channelId });
        const cached = this._pool.get(convKey);
        // 若该消息为对应会话的 latestMessage，则触发 UI 刷新
        if (cached && cached.latestMessage && cached.latestMessage.messageUId === info?.messageUId) {
          cached.latestMessage!.kitReadReceiptInfo = info;
          this._pool.set(convKey, cached);
          this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
          this.logger.debug(LogTag.L_V5_RECEIPT_RESPONSE_O, `onV5ReceiptResponse success: ${JSON.stringify(cached)}`);
        }
      });
    } catch (e) {
      this.logger.warn(LogTag.L_V5_RECEIPT_RESPONSE_E, `onV5ReceiptResponse error: ${e}`);
    }
  }

  private _getRemoteConversationFinished: boolean = false;

  /**
   * 获取远端会话列表数据完成，开始消息与会话通知
   */
  private _onGetRemoteConversationListDone(tmpData: boolean): void {
    if (!tmpData) {
      // 首屏数据拉取完毕，不更新会话列表拉取完成标识
      this._getRemoteConversationFinished = true;
    }

    // 开启定时器，定时处理消息与会话通知
    this._handleQueue();
  }

  private _handleQueueTimer: any;

  private _handleQueueDelay() {
    if (this._handleQueueTimer) {
      return;
    }
    this._handleQueueTimer = setTimeout(() => {
      this._handleQueueTimer = null;
      this._handleQueue();
    }, 20);
  }

  /**
   * 批量处理消息与会话通知
   * @returns
   */
  private _handleQueue() {
    if (this._messageQueue.length === 0 && this._converNtfQueue.length === 0) {
      this._handleQueueDelay();
      return;
    }

    if (this._list.length >= 20 && !this._getRemoteConversationFinished) {
      // 首屏会话展示阶段，直接停止，不需要继续解析
      return;
    }

    const changed: Set<IRCKitCachedConversation> = new Set();
    // 用于暂存变更的会话: 位置变更、仅状态变更
    const orderChanged: Set<IRCKitCachedConversation> = new Set();
    const statChanged: Set<IRCKitCachedConversation> = new Set();
    // 计算消息队列和会话通知引发的会话列表变更长度，当长度超出 max 定义时暂停处理，避免 UI 一次性处理过多变更造成线程阻塞
    const max = Number.MAX_SAFE_INTEGER;
    // 计算队列处理时间，当处理时间超过 maxCostTime （毫秒）时，暂停处理，避免阻塞主线程
    const maxCostTime = 20;
    const startTime = Date.now();

    const handleChange = (data: { changeType: number, conversation?: IRCKitCachedConversation }) => {
      const { changeType, conversation } = data;
      if (changeType === 1) {
        statChanged.add(conversation!);
        changed.add(conversation!);
      } else if (changeType === 2) {
        orderChanged.add(conversation!);
        changed.add(conversation!);
      }
    };

    // 优先处理消息队列（仅 Electron 平台需要）
    this._handleMessageQueue(handleChange, changed, max, maxCostTime, startTime);

    // 处理会话通知前，需要确保 message 列表已清空，否则当接收到本地缓存不存在的会话通知时，无法识别该会话时被删除还是尚未生成
    // 列表拉取完成前，仅处理 updatedItems.latestMessage.isOffline 为 true 的通知
    // 列表拉取完成后，丢弃 updatedItems.latestMessage.isOffline 为 true 的通知，其他正常处理
    this._handleQueueNotify(handleChange, changed, max, maxCostTime, startTime);

    if (orderChanged.size) {
      // 计算会话位置变更并通知 UI
      this._recalculatePosition(orderChanged);
    }

    if (statChanged.size) {
      // orderChanged 中重复的会话不需要再次通知 UI
      const list = [...statChanged].filter((item) => !orderChanged.has(item));
      if (list.length) {
        // 通知 UI 更新会话列表
        this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, list));
      }
    }

    // 通知可能被当作已处理的离线数据丢弃，也必须唤醒等待队列消费的未读刷新。
    this._unreadStates.forEach((state) => {
      if (state.waitingForEvents && this._isCurrentUnreadState(state)) {
        state.waitingForEvents = false;
        this._refreshUnreadState(state.cached);
      }
    });

    this._handleQueueDelay();
  }

  private _handleMessageQueue(
    handleChange: (data: { changeType: number, conversation?: IRCKitCachedConversation }) => void,
    changed: Set<IRCKitCachedConversation>,
    max: number,
    maxCostTime: number,
    startTime: number,
  ) {
    while (this._messageQueue.length && Date.now() - startTime < maxCostTime && changed.size < max) {
      const msg = this._messageQueue[0];
      // 会话列表拉取完成前，仅处理离线消息，遇到非离线消息中止处理
      if (!this._getRemoteConversationFinished && !msg.isOffLineMessage) {
        // 未拉取完成会话列表，说明当前处于首屏临时数据显示中，不处理在线消息
        break;
      } else if (this._getRemoteConversationFinished && msg.isOffLineMessage) {
        // 会话列表拉取完成后，仅处理在线消息，离线消息丢弃
        this._messageQueue.shift();
        continue;
      }
      const message = createRCKitCacheMessage(this._messageQueue.shift()!);
      handleChange(this._handleMessage(message));
    }
  }

  private _handleQueueNotify(
    handleChange: (data: { changeType: number, conversation?: IRCKitCachedConversation }) => void,
    changed: Set<IRCKitCachedConversation>,
    max: number,
    maxCostTime: number,
    startTime: number,
  ) {
    if (!this._getRemoteConversationFinished) {
      // 会话列表数据拉取完成前，仅处理离线消息造成的 conversation 通知，其他等待会话列表拉取完成后处理
      let i = 0;
      while (this._messageQueue.length === 0 && i < this._converNtfQueue.length && Date.now() - startTime < maxCostTime && changed.size < max) {
        const item = this._converNtfQueue[i];
        if (item.updatedItems?.latestMessage) {
          if (!item.updatedItems.latestMessage.val.isOffLineMessage) {
            // 碰到在线消息直接中止循环
            break;
          }
          this._converNtfQueue.splice(i, 1);
          handleChange(this._handleConversationNtf(item));
          continue;
        }
        i += 1; // 其他通知跳过处理
      }
      return;
    }

    while (this._messageQueue.length === 0 && this._converNtfQueue.length && Date.now() - startTime < maxCostTime && changed.size < max) {
      const item = this._converNtfQueue.shift()!;
      if (item.updatedItems?.latestMessage?.val.isOffLineMessage) {
        // 离线消息产生的通知直接丢弃
        continue;
      }
      handleChange(this._handleConversationNtf(item));
    }
  }

  /**
   * 获取指定会话之前的会话列表数据
   * @param conversation - 指定会话，若不传，则获取最新的会话列表数据
   * @param count - 获取数量，默认为 30
   * @description - 该方法会根据指定会话在会话列表中的位置，向前获取 30 条会话数据；返回结果不包含传入的会话。
   */
  public async getMoreConversationList(conversation: IRCKitCachedConversation | null, count?: number) {
    let index = conversation ? this._list.findIndex((item) => isSameConversation(item, conversation)) : -1;
    if (index === -1) {
      index = 0;
    } else {
      // 返回结果不包含传入的会话。
      index += 1;
    }

    const endIndex = index + (count || 30);
    const list = this._list.slice(index, endIndex);
    const hasMore = this._list.length > endIndex || !this._getRemoteConversationFinished;
    return { hasMore, code: ErrorCode.SUCCESS, list };
  }

  /**
   * IMLib 接口返回非 SUCCESS 时的统一告警（按错误码选择话术）
   */
  private _alertImLibFailure(code: number): void {
    const key: keyof IRCKitLanguageEntries = code === IMLIB_ALERT_CHECK_NETWORK_CODE
      ? 'alert.imlib.failed.network'
      : 'alert.imlib.failed.generic';
    this.ctx.alert(key, code);
  }

  /**
   * 删除指定会话，若会话已被打开，则会同时派发会话选中状态变更事件
   * @emits {@link RCKitEvents.CONVERSATIN_ITEM_REMOVE}
   * @param conversation
   */
  async removeConversation(conversation: IConversationOption): Promise<void> {
    const session = this._getUserCacheSession();
    if (!this._isCurrentUserCache(session)) return;
    // 从 IMLib 层面删除会话
    const { code } = await removeConversation(conversation);
    if (!this._isCurrentUserCache(session)) return;
    if (code !== ErrorCode.SUCCESS) {
      this._alertImLibFailure(code);
      return;
    }

    // 清理缓存
    const key = trans2ConversationKey(conversation);
    const index = this._list.findIndex((item) => isSameConversation(item, conversation));
    if (index > -1) {
      const [cached] = this._list.splice(index, 1);
      this._pool.delete(key);
      clearTimeout(this._unreadStates.get(key)?.retryTimer);
      this._unreadStates.delete(key);
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATIN_ITEM_REMOVE, [cached]));

      if (cached === this._openedConversation) {
        this._setOpenedConversation(null, false);
      }
    }

    // 打开状态变更会同步通知业务层，业务回调可能切换账号或销毁实例。
    if (!this._isCurrentUserCache(session)) return;
    // 删除回话的同时，清理消息
    const bool = this.ctx.store.getCommandSwitch(RCKitCommand.DELETE_MESSAGES_WHILE_DELETE_CONVERSATION);
    if (!bool) {
      return;
    }
    // 清空消息缓存列表
    this.ctx.message.removeCachedMessages(conversation);

    const timestamp = getServerTime() + 5000;
    // 从服务删除消息
    clearHistoryMessages(conversation, timestamp);
    // 清理 Electron 平台本地数据库消息
    if (electronExtension.enable()) {
      electronExtension.deleteMessagesByTimestamp(conversation, timestamp, false);
    }
  }

  /**
   * 打开指定会话，若会话不存在，则会先创建会话并插入到会话列表顶部
   * @param conversation
   * @param focusInput - 是否默认选中输入框
   */
  async openConversation(conversation: IConversationOption, focusInput: boolean = true): Promise<{ code: number }> {
    if (isInvalidConversation(conversation)) {
      return { code: InnerErrorCode.INVALID_CONVERSATION };
    }

    if (!this._getRemoteConversationFinished || !this._pullOfflineMessageFinished) {
      return { code: InnerErrorCode.CONVERSATION_LIST_NOT_READY };
    }

    if (this._openedConversation && isSameConversation(this._openedConversation, conversation)) {
      return { code: ErrorCode.SUCCESS };
    }

    const { targetId, conversationType, channelId = '' } = conversation;

    // 检查会话是否已存在
    let index = this._list.findIndex((item) => isSameConversation(item, conversation));
    let cached = this._list[index];

    if (!cached) {
      // 生成新会话
      [cached] = this._parseConversationList([{
        targetId,
        conversationType,
        channelId,
        latestMessage: null,
        lastUnreadTime: 0,
      }]);

      // 标记更新时间
      cached.updateTime = getServerTime();
      this._recalculatePosition(new Set([cached]));
    }

    this._setOpenedConversation(cached, focusInput);
    return { code: ErrorCode.SUCCESS };
  }

  private _setOpenedConversation(conversation: IRCKitCachedConversation | null, focusInput: boolean = true): void {
    // 清理 typing 状态限频记录
    this._clearTypingStatus();

    this._openedConversation = conversation;
    this.ctx.emit(new RCKitEvent(RCKitEvents.CONVERSATION_SELECTED, {
      conversation,
      focusInput,
    }), 1);
  }

  /**
   * 设置会话免打扰等级
   * @param conversation - 会话
   * @param level - 免打扰等级
   */
  async setConversationNotificationLevel(conversation: IConversationOption, level: NotificationLevel): Promise<{ code: number }> {
    const session = this._getUserCacheSession();
    if (!this._isCurrentUserCache(session)) return { code: InnerErrorCode.TASK_CANCEL };
    if (isInvalidConversation(conversation)) {
      return { code: InnerErrorCode.INVALID_CONVERSATION };
    }
    const cached = this._list.find((item) => isSameConversation(item, conversation));
    if (!cached) {
      return { code: ErrorCode.CONVER_GET_ERROR };
    }

    if (cached.notificationLevel === level) {
      return { code: ErrorCode.SUCCESS };
    }

    const { code } = await setConversationNotificationLevel(conversation, level);
    if (!this._isCurrentUserCache(session) || this._pool.get(cached.key) !== cached) return { code: InnerErrorCode.TASK_CANCEL };
    if (code !== ErrorCode.SUCCESS) {
      this._alertImLibFailure(code);
      return { code };
    }

    // 主动通知 UI 更新（Electron 和 Web 都需要）
    cached.notificationLevel = level;
    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));

    return { code };
  }

  /**
   * 设置会话置顶
   * @param conversation - 会话
   * @param isTop - 是否置顶
   */
  async setConversationToTop(conversation: IConversationOption, isTop: boolean): Promise<{ code: number }> {
    const session = this._getUserCacheSession();
    if (!this._isCurrentUserCache(session)) return { code: InnerErrorCode.TASK_CANCEL };
    if (isInvalidConversation(conversation)) {
      return { code: InnerErrorCode.INVALID_CONVERSATION };
    }

    isTop = !!isTop;
    const cached = this._list.find((item) => isSameConversation(item, conversation));
    if (!cached) {
      return { code: ErrorCode.CONVER_GET_ERROR };
    }
    if (cached.isTop === isTop) {
      return { code: ErrorCode.SUCCESS };
    }

    const { code } = await setConversationToTop(conversation, isTop);
    if (!this._isCurrentUserCache(session) || this._pool.get(cached.key) !== cached) return { code: InnerErrorCode.TASK_CANCEL };
    if (code !== ErrorCode.SUCCESS) {
      this._alertImLibFailure(code);
      return { code };
    }

    // 主动更新缓存数据并触发 UI 更新（Electron 和 Web 都需要）
    cached.isTop = isTop;
    this._recalculatePosition(new Set([cached]));

    return { code };
  }

  /**
   * 标记会话为已读
   * @param conversation
   */
  public async markConversationReaded(conversation: IRCKitCachedConversation) {
    const session = this._getUserCacheSession();
    if (!this._isCurrentUserCache(session)) return;
    const key = trans2ConversationKey(conversation);
    const cached = this._pool.get(key);
    const { data } = await getFirstUnreadMessage(conversation);
    if (!this._isCurrentUserCache(session) || this._pool.get(key) !== cached) return;
    // 标记已读的同时该会话未读数置为 0
    const { code } = await this.clearUnreadCountByTimestamp(conversation, conversation.latestMessage?.sentTime || Date.now());
    if (!this._isCurrentUserCache(session) || code !== ErrorCode.SUCCESS || this._pool.get(key) !== cached) return;

    const list: IRCKitCachedMessage[] = [];
    // 标记会话已读需要发送回执

    if (data) {
      list.push(createRCKitCacheMessage(data));
    }
    if (conversation.latestMessage) {
      list.push(conversation.latestMessage);
    }
    this.ctx.message.sendReadReceiptMessage(conversation, list);
  }

  /**
   * 标记会话为未读
   * @param conversation
   */
  public markConversationUnread(conversation: IRCKitCachedConversation) {
    const cached = this._pool.get(trans2ConversationKey(conversation));
    if (!cached) return;

    // TODO: 定位组件存在的时候，清空未读数定位组件未读数应该也需要置空
    cached.markReaded = false;
    cached.markUnread = true;

    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
  }

  /**
   * 清除会话的手动未读标记
   * @param conversation
   */
  public clearConversationUnreadMark(conversation: IConversationOption): void {
    const cached = this._pool.get(trans2ConversationKey(conversation));
    if (!cached || !cached.markUnread) return;

    cached.markReaded = true;
    cached.markUnread = false;
    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
  }

  getCachedConversationByKey(key: string): IRCKitCachedConversation {
    return this._pool.get(key)!;
  }

  private _getUnreadState(conversation: IConversationOption): IConversationUnreadState | undefined {
    const key = trans2ConversationKey(conversation);
    const cached = this._pool.get(key);
    if (!cached) return;
    let state = this._unreadStates.get(key);
    if (!state || !this._isCurrentUnreadState(state)) {
      clearTimeout(state?.retryTimer);
      state = {
        key,
        cached,
        userId: this.ctx.userId,
        generation: this.ctx.userCacheGeneration,
        revision: 0,
        queue: Promise.resolve(),
        waitingForEvents: false,
        retryCount: 0,
      };
      this._unreadStates.set(key, state);
    }
    return state;
  }

  private _isCurrentUnreadState(state: IConversationUnreadState): boolean {
    return this._isCurrentUserCache(state)
      && this._pool.get(state.key) === state.cached
      && this._unreadStates.get(state.key) === state;
  }

  private _invalidateUnreadState(conversation: IConversationOption): void {
    const state = this._unreadStates.get(trans2ConversationKey(conversation));
    if (state) state.revision += 1;
  }

  private _enqueueUnreadOperation<T>(state: IConversationUnreadState, operation: () => Promise<T>): Promise<T> {
    const pending = state.queue.then(operation);
    // 一次 SDK 异常不能阻断后续清理或刷新。
    state.queue = pending.then(() => {}, () => {});
    return pending;
  }

  private _retryUnreadState(state: IConversationUnreadState): void {
    if (!this._isCurrentUnreadState(state) || state.retryTimer || state.retryCount >= 2) return;
    state.retryCount += 1;
    state.retryTimer = setTimeout(() => {
      state.retryTimer = undefined;
      if (this._isCurrentUnreadState(state)) this._refreshUnreadState(state.cached, true);
    }, state.retryCount * 250);
  }

  private _refreshUnreadState(conversation: IConversationOption, retry = false): Promise<void> {
    const state = this._getUnreadState(conversation);
    if (!state) return Promise.resolve();
    state.revision += 1;
    if (!retry) {
      clearTimeout(state.retryTimer);
      state.retryTimer = undefined;
      state.retryCount = 0;
    }
    if (!state.refresh) {
      state.refresh = this._enqueueUnreadOperation(state, () => this._updateUnreadState(state))
        .finally(() => { state.refresh = undefined; });
    }
    return state.refresh;
  }

  private async _updateUnreadState(state: IConversationUnreadState, forceNotify = false): Promise<void> {
    const { cached, key } = state;
    const { conversationType, targetId, channelId } = cached;
    const conversation = { conversationType, targetId, channelId };
    const hasPendingEvents = () => this._messageQueue.some((message) => trans2ConversationKey(message) === key)
      || this._converNtfQueue.some((item) => trans2ConversationKey(item.conversation) === key
        && (item.updatedItems?.latestMessage || item.updatedItems?.unreadMessageCount
          || item.updatedItems?.hasMentioned || item.updatedItems?.mentionedInfo));

    state.waitingForEvents = false;
    while (this._isCurrentUnreadState(state)) {
      // 先让批处理队列消费消息，避免 SDK 查询值已包含新消息、Kit 随后又累加一次。
      // 队列消费时会请求刷新，因此这里无需增加轮询计时器。
      if (hasPendingEvents()) {
        state.waitingForEvents = true;
        // 清理已成功，先同步手动未读标记；数值和 @ 状态仍等待队列消费后一起刷新。
        if (forceNotify) this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
        return;
      }
      const { revision } = state;
      try {
        let unreadCount: number;
        let mentionedType = RCKitMentionedType.NONE;
        if (electronExtension.enable()) {
          const { code, data } = await getUnreadCount(conversation);
          if (code !== ErrorCode.SUCCESS || typeof data !== 'number') {
            throw new Error(`getUnreadCount failed: ${code}`);
          }
          unreadCount = data;
          if (!this._isCurrentUnreadState(state)) return;
          if (unreadCount > 0 && conversationType === ConversationType.GROUP) {
            const result = await electronExtension.getUnreadMentionedMessages(conversation);
            if (result.code !== ErrorCode.SUCCESS || !Array.isArray(result.data)) {
              throw new Error(`getUnreadMentionedMessages failed: ${result.code}`);
            }
            for (const message of result.data) {
              if (message.senderUserId === state.userId) continue;
              mentionedType = Math.max(mentionedType, this._getMentionedType(state.userId, message.content?.mentionedInfo));
              if (mentionedType === RCKitMentionedType.AT_ME) break;
            }
          }
        } else {
          // Web 无未读 @ 消息查询能力，从同一份会话快照读取未读数和 @ 状态。
          const { code, data } = await getConversation(conversation);
          if (code !== ErrorCode.SUCCESS || !data || trans2ConversationKey(data) !== key) {
            throw new Error(`getConversation failed: ${code}`);
          }
          unreadCount = data.unreadMessageCount ?? 0;
          if (unreadCount > 0) mentionedType = this._getConversationMentionedType(data);
        }
        if (!Number.isFinite(unreadCount) || unreadCount < 0) {
          throw new Error(`invalid unread count: ${unreadCount}`);
        }
        if (!this._isCurrentUnreadState(state)) return;
        if (revision !== state.revision) continue;

        const changed = cached.unreadCount !== unreadCount || cached.mentionedType !== mentionedType
          || (unreadCount > 0 && cached.markReaded);
        cached.unreadCount = unreadCount;
        cached.mentionedType = mentionedType;
        if (unreadCount > 0) cached.markReaded = false;
        clearTimeout(state.retryTimer);
        state.retryTimer = undefined;
        state.retryCount = 0;
        if (changed || forceNotify) {
          this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
        }
        return;
      } catch (error) {
        if (!this._isCurrentUnreadState(state)) return;
        if (revision !== state.revision) continue;
        // 查询失败不等同于没有未读 @，保留旧值并有限重试。
        this.logger.warn(LogTag.L_GET_CONVERSATION_E, `refresh unread state failed: ${key}, ${error}`);
        this._retryUnreadState(state);
        if (forceNotify) this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_CHANGE, [cached]));
        return;
      }
    }
  }

  /**
   * 按时间戳清理消息未读数
   */
  async clearUnreadCountByTimestamp(conversation: IConversationOption, timestamp: number): Promise<{ code: number }> {
    const state = this._getUnreadState(conversation);
    if (!state) return { code: InnerErrorCode.INVALID_CONVERSATION };
    const { conversationType, targetId, channelId } = state.cached;
    const identifier = { conversationType, targetId, channelId };
    return this._enqueueUnreadOperation(state, async () => {
      if (!this._isCurrentUnreadState(state)) return { code: InnerErrorCode.TASK_CANCEL };
      // Web 只支持全量清理；Electron 按指定时间戳部分清理。
      const { code } = electronExtension.enable()
        ? await clearUnreadCountByTimestamp(identifier, timestamp)
        : await clearMessagesUnreadStatus(identifier);
      if (!this._isCurrentUnreadState(state)) return { code: InnerErrorCode.TASK_CANCEL };
      if (code !== ErrorCode.SUCCESS) return { code };
      state.revision += 1;
      state.retryCount = 0;
      state.cached.markReaded = true;
      state.cached.markUnread = false;
      await this._updateUnreadState(state, true);
      if (!this._isCurrentUnreadState(state)) return { code: InnerErrorCode.TASK_CANCEL };
      // 多端未读数同步
      await sendSyncReadStatusMessage(identifier, timestamp + 1 || Date.now());
      if (!this._isCurrentUnreadState(state)) return { code: InnerErrorCode.TASK_CANCEL };
      return { code: ErrorCode.SUCCESS };
    });
  }

  /**
   * 切换会话处理缓存数据
   * @param conversation
   * @param value
   * @returns
   */
  async handleConversationDraft(conversation: IConversationOption | null, value?: string): Promise<void> {
    if (!conversation) return;
    const session = this._getUserCacheSession();
    if (!this._isCurrentUserCache(session)) return;
    const { data } = await getTextMessageDraft(conversation);
    if (!this._isCurrentUserCache(session)) return;
    if (data === value) return;

    const key = trans2ConversationKey(conversation);
    let cached = this._pool.get(key);

    if (value) {
      const { code } = await saveTextMessageDraft(conversation, value);
      if (!this._isCurrentUserCache(session) || this._pool.get(key) !== cached) return;
      if (code !== ErrorCode.SUCCESS || !cached) return;
      cached.draft = value;
      cached.updateTime = getServerTime();
      const { current } = this._addToConversationList(cached);
      // 派发通知
      this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_ORDER_CHANGE, [{ order: current, conversation: cached }]));
      return;
    }
    await clearTextMessageDraft(conversation);
    if (!this._isCurrentUserCache(session) || this._pool.get(key) !== cached) return;
    if (!cached) return;
    cached.draft = '';
    if (cached.latestMessage) {
      cached.updateTime = cached.latestMessage.sentTime;
    }
    const { current } = this._addToConversationList(cached);
    // 派发通知
    this.ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_ITEM_ORDER_CHANGE, [{ order: current, conversation: cached }]));
  }

  updateLastReadTime(conversation: IConversationOption, time: number): void {
    if (!this.ctx.conversationStore) return;
    const { conversationType, targetId, channelId = '' } = conversation;
    const localStorage = this.ctx.conversationStore.get(conversationType, targetId, channelId);
    if (time > localStorage.lastReadTime!) {
      this.ctx.conversationStore.set(conversationType, targetId, {
        lastReadTime: time,
      }, channelId!);
    }
  }

  getLastReadTime(conversation: IConversationOption): number {
    if (!this.ctx.conversationStore) return 0;
    const { conversationType, targetId, channelId = '' } = conversation;
    return this.ctx.conversationStore.get(conversationType, targetId, channelId).lastReadTime || 0;
  }

  private _typingTime: any = null;

  /**
   * 向当前打开的单聊会话发送输入状态
   */
  sendTypingStatus(type: string = MessageType.TEXT) {
    if (!this._openedConversation || this._openedConversation.conversationType !== ConversationType.PRIVATE) {
      return;
    }
    // 限频检查
    if (this._typingTime) {
      return;
    }

    this._typingTime = setTimeout(() => {
      this._typingTime = null;
    }, 5000);
    sendTypingStatusMessage(this._openedConversation!, type);
  }

  /**
   * 清理 typing 限频记录
   */
  private _clearTypingStatus() {
    if (this._typingTime) {
      clearTimeout(this._typingTime);
      this._typingTime = null;
    }
  }
}
