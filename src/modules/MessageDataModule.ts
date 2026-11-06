import {
  Events, IAReceivedMessage, IMessagesEvent, addEventListener, removeEventListener,
  electronExtension, deleteMessages, recallMessage,
  BaseMessage, CombineV2Message,
  ISendMessageOptions,
  getHistoryMessages,
  ErrorCode,
  SentStatus,
  getServerTime,
  IInsertOptions,
  MessageType,
  ICombineV2MessageContent,
  ICombinedMessage,
  ConversationType,
  ReadReceiptInfoV5,
  RCConnectionStatus,
  getMessageReadReceiptInfoV5,
  sendReadReceiptResponseV5,
  getMessagesReadReceiptUsersByPageV5,
  RCResult,
  ReadReceiptUsersOption,
  getMessagesByUIds,
  IMessageResult,
  IFileMessageContent,
  batchGetMessageReactionSummaries,
  addMessageReaction,
  removeMessageReaction,
  IUpdateMessageReactionParam,
  GroupReadReceiptVersion, IMessageReaction, IQuoteInfo, IRecallCommandMessageContent,
  IReferenceMessageContent, MessageDirection, ReadReceiptResponseV5,
  IMessageReactionEvent,
  MessageReactionOperationType,
  IConversationIdentifier,
  IMessageReactionEventData,
  getAppSettings, modifyMessageWithParams, ReferenceMessageStatus, refreshReferenceMessageWithParams,
} from '@rongcloud/imlib-next';
import {
  isObject,
} from '@rongcloud/engine';
import { LogTag } from '@lib/enums/LogTag';
import { getMessageDesc, getReplyMessageSelectionId, replyMessage } from '@lib/ui/provider/context';
import {
  IRCKitDeleteMessageData, InnerEvent, RCKitEvents, BeforeSendMessageEventData,
} from '@lib/core/EventDefined';
import { cloneByJSON } from '@lib/helper/clone';
import { releaseLocalMediaUrl, takeLocalMediaUrl } from '@lib/helper/local-media-url';
import { RCKitQuoteMessageStatus } from '@lib/enums/RCKitQuoteMessageStatus';
import { IRCKitLanguageEntries } from '@lib/languages';
import { RCKitModule } from './RCKitModule';
import { MessageSendQueue, FileUploadQueue } from './Queue';
import {
  isInvalidConversation, isPrivOrGroupConversation, trans2ConversationKey, parseFileToMessage, createRCKitCacheMessage, findLastIndex,
  trans2RCKitQuoteInfo, isSameConversation,
  createRCKitQuoteInfoByReferenceMessageContent,
} from '../helper';
import { RCKitEvent } from '../core/RCKitEvent';
import { IRCKitUserCacheSession, RCKitContext } from '../core/RCKitContext';
import { InnerErrorCode } from '../enums/RCKitCode';
import { RCKitMessageEditStatus } from '../enums/RCKitMessageEditStatus';
import { canEditMessage, getSuccessfulEditTimestamp } from './message-editing';
import { createReferenceRefreshRound } from './reference-refresh';

export interface IRCKitQuoteInfo extends IQuoteInfo {
  /** 引用目标是否已编辑，与回复正文的编辑状态独立。 */
  isEdited?: boolean;
  /**
   * 引用消息状态
   */
  status: RCKitQuoteMessageStatus;
  /**
   * 仅当 status 值为 RCKitQuoteMessageStatus.LOADED 时有值
   */
  quoteMessage?: IAReceivedMessage;
}

function createQuoteInfo(message: IAReceivedMessage): IRCKitQuoteInfo {
  return {
    messageUId: message.messageUId,
    objectName: message.messageType,
    senderId: message.senderUserId,
    status: RCKitQuoteMessageStatus.LOADED,
    quoteMessage: message,
    isEdited: !!getSuccessfulEditTimestamp(message),
  };
}

const trans2IRCKitMessageReaction = (
  reaction: IMessageReaction,
  currentUserId: string,
): IRCKitMessageReaction => {
  const { hasCurrentUserReacted, users, ...others } = reaction;
  // 保持当前用户在第一位，且最多保留 10 条回应用户记录
  const newUsers: string[] = hasCurrentUserReacted
    ? [currentUserId, ...users.map((user) => user.userId).filter((id) => id !== currentUserId)]
    : users.map((user) => user.userId);
  const data: IRCKitMessageReaction = {
    hasCurrentUserReacted,
    users: newUsers.slice(0, 10),
    ...others,
  };
  return data;
};

/**
 * @since 5.42.0
 */
export interface IRCKitMessageReaction extends Omit<IMessageReaction, 'users'> {
  /**
   * 回应用户 ID 列表，最多保留 10 个用户 ID，且当前登录用户优先
   */
  users: string[],
}

export interface IRCKitCachedMessage extends Omit<IAReceivedMessage, 'quoteInfo'> {
  editStatus?: RCKitMessageEditStatus;
  /** 未确认成功的修改草稿，仅存在于内存。 */
  editDraft?: string;
  /** SDK 成功修改时间戳。 */
  editTimestamp?: number;
  /**
   * 对应的发送事务 ID，本地生成的消息会携带此 ID，用于匹配相关事件
   */
  transactionId: number;
  /**
   * 上传进度
   * * 100 为上传完成
   * * -1 为上传失败
   */
  progress?: number;
  /**
   * 待上传文件 Blob
   */
  file?: File;
  /* V5 已读信息（UI 绑定使用） */
  kitReadReceiptInfo?: ReadReceiptInfoV5;
  /**
   * 引用消息信息
   */
  quoteInfo?: IRCKitQuoteInfo;
  /**
   * 消息回应数据
   */
  reactions: IRCKitMessageReaction[]
}

/**
 * 内存态缓存消息列表
 */
interface IRCKitCachedMessageData {
  /**
   * 消息记录片段数据
   */
  histories: IRCKitCachedMessage[];
  /**
   * 片段数据的开始时间，片段数据将不包含该时间点的消息
   */
  startTime: number;
  /**
   * 片段数据的结束时间，片段数据将不包含该时间点的消息
   */
  endTime: number;
  /**
   * 起始时间以前是否还有更多历史消息
   */
  hasMoreBeforeStartTime: boolean;
  /**
   * 结束时间以后是否还有更多历史消息
   */
  hasMoreAfterEndTime: boolean;
}

const MESSAGE_PAGE_SIZE = 30;

/**
 * 消息模块，仅处理消息数据，不与会话列表产生有交互。
 * 会话列表中的 latestMessage 等状态更新，有会话模块自行解析处理。
 * @emits
 * - {@link RCKitEvents.INSERT_MESSAGE} - 向列表插入一条消息
 * - {@link RCKitEvents.MESSAGE_UPDATE} - 消息状态更新
 * @method
 * - 内存态历史消息维护，用于处理发送中的消息和实际消息的交叉展示
 * - 消息发送队列维护
 * - 消息上传队列维护
 * - 消息发送、发送状态维护
 * - 插入消息
 * - 消息接收、分发、暂存
 * - 消息删除、撤回
 */
export class MessageModule extends RCKitModule {
  /**
   * 消息发送队列
   */
  private readonly _sendQueue: MessageSendQueue;

  /**
   * 文件上传队列
   */
  private readonly _uploadQueue: FileUploadQueue;

  private _transactionIdCount = 0;

  private _localMediaUrls = new Map<IRCKitCachedMessage, string>();

  private _releaseLocalMediaUrl(message: IRCKitCachedMessage): void {
    const url = this._localMediaUrls.get(message);
    this._localMediaUrls.delete(message);
    if (url) URL.revokeObjectURL(url);
  }

  /**
   * 需要暂存部分消息列表缓存，以维护本地发送中的消息和实际消息的展示。
   */
  private _histories: Map<string, IRCKitCachedMessageData> = new Map();

  // Loaded pages outside the contiguous history range must remain addressable,
  // without making pagination treat the intervening gap as already loaded.
  private _detachedMessages = new Map<string, Map<string, IRCKitCachedMessage>>();

  /**
   * 记录已发送过 V5 回执的 messageUId，避免重复发送
   */
  private _v5Responded = new Set<string>();

  private _editAttempts = new Map<string, object>();

  private _unavailableMessages = new Map<string, RCKitQuoteMessageStatus>();

  private _quoteRounds = new Map<string, { token: object, generation: number, pending: boolean }>();

  private _cancelQuoteRounds = new Set<() => void>();

  private _messageKey(conversation: IConversationIdentifier, uid: string): string {
    return `${trans2ConversationKey(conversation)}:${uid}`;
  }

  private _isRecallMessage(message: Pick<IAReceivedMessage, 'messageType'>): boolean {
    return message.messageType === MessageType.RECALL || message.messageType === MessageType.RECALL_NOTIFICATION_MESSAGE;
  }

  getCachedMessage(conversation: IConversationIdentifier, uid: string): IRCKitCachedMessage | undefined {
    return this._getExistCache(conversation)?.histories.find((message) => message.messageUId === uid)
      || this._detachedMessages.get(trans2ConversationKey(conversation))?.get(uid);
  }

  /** 查询源消息的已知失效状态；仅缓存未命中不代表消息已删除。 */
  getMessageUnavailableStatus(message: IAReceivedMessage): RCKitQuoteMessageStatus | undefined {
    const status = this._unavailableMessages.get(this._messageKey(message, message.messageUId));
    if (status !== undefined) return status;
    const current = this.getCachedMessage(message, message.messageUId) || message;
    return this._isRecallMessage(current) ? RCKitQuoteMessageStatus.RECALLED : undefined;
  }

  private _getCachedMessages(conversation: IConversationIdentifier): IRCKitCachedMessage[] {
    const histories = this._getExistCache(conversation)?.histories || [];
    return [...histories, ...(this._detachedMessages.get(trans2ConversationKey(conversation))?.values() || [])];
  }

  private _retainMessage(existing: IRCKitCachedMessage, incoming: IRCKitCachedMessage): IRCKitCachedMessage {
    // Recall is terminal: neither a local draft nor an older history page may restore its body.
    if (this._isRecallMessage(incoming)) return incoming;
    if (this._isRecallMessage(existing)) return existing;
    if (existing.editDraft !== undefined || existing.editStatus === RCKitMessageEditStatus.UPDATING
      || (existing.editTimestamp || 0) > (incoming.editTimestamp || 0)
      || this._quoteRounds.has(this._messageKey(existing, existing.messageUId))) return existing;
    if (existing.quoteInfo && existing.quoteInfo.messageUId === incoming.quoteInfo?.messageUId) {
      incoming.quoteInfo = existing.quoteInfo;
      if (incoming.messageType === MessageType.REFERENCE) {
        incoming.content = { ...incoming.content, referMsg: existing.content.referMsg, referMsgStatus: existing.content.referMsgStatus };
      }
    }
    return incoming;
  }

  private _rememberDetachedMessage(conversation: IConversationIdentifier, message: IRCKitCachedMessage): IRCKitCachedMessage {
    const key = trans2ConversationKey(conversation);
    let detached = this._detachedMessages.get(key);
    if (!detached) {
      detached = new Map();
      this._detachedMessages.set(key, detached);
    }
    const previous = detached.get(message.messageUId);
    const current = previous ? this._retainMessage(previous, message) : message;
    detached.set(message.messageUId, current);
    return current;
  }

  canEdit(message: IRCKitCachedMessage, forMenu = false): boolean {
    const conversation = this.ctx.conversation.getCachedConversationByKey(trans2ConversationKey(message));
    return canEditMessage(
      message,
      this.ctx.userId,
      this.ctx.isMessageEditEnabled,
      getAppSettings()?.messageModifiableMinutes,
      getServerTime(),
      forMenu ? conversation?.updatingMessageUId : undefined,
    );
  }

  startEdit(conversation: IConversationIdentifier, uid: string): boolean {
    const message = this.getCachedMessage(conversation, uid);
    const cached = this.ctx.conversation.getCachedConversationByKey(trans2ConversationKey(conversation));
    if (!message || !cached || !this.canEdit(message)) return false;
    message.editDraft = message.editDraft ?? message.content.content;
    cached.updatingMessageUId = uid;
    this._emitMessageState([message]);
    return true;
  }

  setEditDraft(conversation: IConversationIdentifier, uid: string, draft: string): void {
    const message = this.getCachedMessage(conversation, uid);
    if (!message || message.editStatus === RCKitMessageEditStatus.UPDATING) return;
    message.editDraft = draft;
    this._emitMessageState([message]);
  }

  clearEdit(conversation: IConversationIdentifier, uid: string): void {
    const message = this.getCachedMessage(conversation, uid);
    if (!message || message.editStatus === RCKitMessageEditStatus.UPDATING) return;
    delete message.editDraft;
    message.editStatus = getSuccessfulEditTimestamp(message) ? RCKitMessageEditStatus.SUCCESS : undefined;
    this._clearActiveEdit(conversation, uid);
    this._emitMessageState([message]);
  }

  private _clearActiveEdit(conversation: IConversationIdentifier, uid: string): void {
    const cached = this.ctx.conversation.getCachedConversationByKey(trans2ConversationKey(conversation));
    if (cached?.updatingMessageUId === uid) delete cached.updatingMessageUId;
  }

  private _emitMessageState(messages: IRCKitCachedMessage[]): void {
    if (messages.length) this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, messages));
  }

  async submitEdit(conversation: IConversationIdentifier, uid: string): Promise<void> {
    const message = this.getCachedMessage(conversation, uid);
    if (!message) return;
    if (!this.canEdit(message)) {
      this.ctx.alert('message.edit.expired');
      this.clearEdit(conversation, uid);
      return;
    }
    if (!message.editDraft?.trim()) return;
    const maxLength = getAppSettings()?.messageSizeLimit ? 1500 : 5000;
    if (message.editDraft.length > maxLength) {
      this.ctx.alert('alert.send.message.maxcount', maxLength);
      return;
    }
    const session = this._getUserCacheSession();
    const key = this._messageKey(conversation, uid);
    const token = {};
    this._editAttempts.set(key, token);
    message.editStatus = RCKitMessageEditStatus.UPDATING;
    this._clearActiveEdit(conversation, uid);
    this._emitMessageState([message]);
    const isCurrent = () => this._isCurrentUserCache(session)
      && this.getCachedMessage(conversation, uid) === message && this._editAttempts.get(key) === token;
    try {
      const result = await modifyMessageWithParams({
        conversation, messageUId: uid, messageContent: { ...message.content, content: message.editDraft },
      });
      if (!isCurrent() || result.code === ErrorCode.SUCCESS) return;
    } catch (error) {
      if (!isCurrent()) return;
    }
    this._editAttempts.delete(key);
    message.editStatus = RCKitMessageEditStatus.FAILED;
    this._emitMessageState([message]);
  }

  private _onMessagesModified(messages: IAReceivedMessage[]): void {
    messages.forEach((incoming) => {
      const timestamp = getSuccessfulEditTimestamp(incoming);
      if (!timestamp || this._unavailableMessages.has(this._messageKey(incoming, incoming.messageUId))) return;
      const message = this.getCachedMessage(incoming, incoming.messageUId);
      // Stop before refreshing references as well as before replacing the recalled row.
      if (message && this._isRecallMessage(message)) return;
      if (message && timestamp > (message.editTimestamp || 0)) {
        const converted = createRCKitCacheMessage(incoming);
        const previousQuote = message.quoteInfo;
        if (previousQuote?.messageUId === converted.quoteInfo?.messageUId) {
          if (message.messageType === MessageType.REFERENCE) {
            converted.content = {
              ...converted.content, referMsg: message.content.referMsg, referMsgStatus: message.content.referMsgStatus,
            };
          }
          converted.quoteInfo = previousQuote;
        }
        Object.assign(message, converted, {
          transactionId: message.transactionId,
          sentTime: message.sentTime,
          progress: message.progress,
          file: message.file,
          reactions: message.reactions,
          kitReadReceiptInfo: message.kitReadReceiptInfo,
          readReceiptInfo: message.readReceiptInfo,
          editStatus: RCKitMessageEditStatus.SUCCESS,
          editTimestamp: timestamp,
        });
        delete message.editDraft;
        this._editAttempts.delete(this._messageKey(message, message.messageUId));
        this._clearActiveEdit(message, message.messageUId);
        this._emitMessageState([message]);
        this._checkAndFillQuoteInfo(message, [message], true);
      }
      this._refreshReferencingMessages(incoming, incoming.messageUId, incoming);
    });
  }

  private _refreshReferencingMessages(conversation: IConversationIdentifier, uid: string, updated?: IAReceivedMessage): void {
    const messages = this._getCachedMessages(conversation).filter((message) => message.quoteInfo?.messageUId === uid);
    if (updated) {
      messages.forEach((message) => {
        if (message.messageType !== MessageType.REFERENCE && !this._unavailableMessages.has(this._messageKey(conversation, uid))) {
          const previous = message.quoteInfo!.quoteMessage;
          if ((getSuccessfulEditTimestamp(previous || {}) || 0) <= (getSuccessfulEditTimestamp(updated) || 0)) {
            message.quoteInfo!.quoteMessage = updated;
            message.quoteInfo!.status = RCKitQuoteMessageStatus.LOADED;
            message.quoteInfo!.isEdited = !!getSuccessfulEditTimestamp(updated);
          }
        }
      });
      this._emitMessageState(messages);
    }
    this._checkAndFillQuoteInfo(conversation, messages, true);
  }

  private _markUnavailable(conversation: IConversationIdentifier, uid: string, status: RCKitQuoteMessageStatus): void {
    this._unavailableMessages.set(this._messageKey(conversation, uid), status);
    this._editAttempts.delete(this._messageKey(conversation, uid));
    this._quoteRounds.delete(this._messageKey(conversation, uid));
    const message = this.getCachedMessage(conversation, uid);
    const cachedConversation = this.ctx.conversation.getCachedConversationByKey(trans2ConversationKey(conversation));
    const wasActiveEdit = !!message && cachedConversation?.updatingMessageUId === uid;
    if (message) {
      delete message.editDraft;
      delete message.editStatus;
      delete message.editTimestamp;
      delete message.modifyInfo;
    }
    this._clearActiveEdit(conversation, uid);
    if (wasActiveEdit) {
      this.ctx.alert('alert.message.edit.recalled');
    }
    const references = this._getCachedMessages(conversation).filter((item) => item.quoteInfo?.messageUId === uid);
    references.forEach((item) => this._setQuoteUnavailable(item, status));
    this._emitMessageState(references);
    this._checkAndFillQuoteInfo(conversation, references, true);
  }

  private _applyRecallMessage(message: IRCKitCachedMessage): boolean {
    // Legacy commands identify the target in content; RC:RcNtf uses the original UID.
    const uid = message.messageType === MessageType.RECALL
      ? (message.content as IRecallCommandMessageContent).messageUId || message.content.messageUid || message.messageUId
      : message.messageUId;
    if (!uid) return false;
    const target = this.getCachedMessage(message, uid);
    this._markUnavailable(message, uid, RCKitQuoteMessageStatus.RECALLED);
    message.messageUId = uid;
    delete message.editDraft;
    delete message.editStatus;
    delete message.editTimestamp;
    delete message.modifyInfo;
    delete message.quoteInfo;
    if (!target) return false;

    message.sentTime = target.sentTime;
    message.transactionId = target.transactionId;
    const cached = this._getExistCache(message);
    const index = cached?.histories.indexOf(target) ?? -1;
    if (index !== -1) cached!.histories.splice(index, 1, message);
    else this._detachedMessages.get(trans2ConversationKey(message))?.set(uid, message);
    this.ctx.emit(new RCKitEvent(RCKitEvents.MESSAGES_DELETED, [{ target, recallMsg: message }]), 1);
    return true;
  }

  private _setQuoteUnavailable(message: IRCKitCachedMessage, status: RCKitQuoteMessageStatus): void {
    message.quoteInfo!.status = status;
    delete message.quoteInfo!.quoteMessage;
    delete message.quoteInfo!.isEdited;
    if (message.messageType === MessageType.REFERENCE) {
      message.content = {
        ...message.content,
        referMsg: {},
        referMsgStatus: status === RCKitQuoteMessageStatus.RECALLED
          ? ReferenceMessageStatus.RECALLED
          : ReferenceMessageStatus.DELETE,
      };
    }
  }

  constructor(ctx: RCKitContext) {
    super(ctx);

    this._sendQueue = new MessageSendQueue(ctx);
    this._uploadQueue = new FileUploadQueue(ctx);
  }

  protected _onInit(): void {
    if (electronExtension.enable()) {
      addEventListener(Events.MESSAGES, this._onRecvElectronMessage, this);
      this._handleElectronMessages();
    } else {
      addEventListener(Events.MESSAGES, this._onRecvMessages, this);
    }
    // 监听 V5 已读回执响应
    addEventListener(Events.MESSAGE_RECEIPT_RESPONSE_V5, this._onV5ReceiptResponse, this);
    // 监听消息回应事件
    addEventListener(Events.MESSAGE_REACTION_CHANGED, this._onMessageReactionChanged, this);
    addEventListener(Events.MESSAGE_MODIFIED, this._onMessagesModified, this);
  }

  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    this._localMediaUrls.forEach((url, message) => this._releaseLocalMediaUrl(message));
    const keys = new Set([...this._histories.keys(), ...this._detachedMessages.keys()]);
    keys.forEach((key) => {
      const messages = [...this._histories.get(key)?.histories || [], ...(this._detachedMessages.get(key)?.values() || [])];
      messages.forEach((message) => { delete message.editDraft; delete message.editStatus; });
      const conversation = this.ctx.conversation.getCachedConversationByKey(key);
      if (conversation) delete conversation.updatingMessageUId;
    });
    this._quoteRounds.clear();
    this._cancelQuoteRounds.forEach((cancel) => cancel());
    this._cancelQuoteRounds.clear();
    this._editAttempts.clear();
    this._unavailableMessages.clear();
    this._histories.clear();
    this._detachedMessages.clear();
    this._transactionIdCount = 0;
    this._messageQueue.length = 0;
    if (this._messageHandleTimer) {
      clearTimeout(this._messageHandleTimer);
      this._messageHandleTimer = null;
    }
  }

  private _getUserCacheSession(): IRCKitUserCacheSession {
    return {
      userId: this.ctx.userId,
      generation: this.ctx.userCacheGeneration,
    };
  }

  private _isCurrentUserCache(session: IRCKitUserCacheSession): boolean {
    return session.userId === this.ctx.userId
      && session.generation === this.ctx.userCacheGeneration;
  }

  public destroy(): void {
    this._onDestroyUserCache();
    this._sendQueue.destroy();
    this._uploadQueue.destroy();
    removeEventListener(Events.MESSAGE_RECEIPT_RESPONSE_V5, this._onV5ReceiptResponse, this);
    removeEventListener(Events.MESSAGE_REACTION_CHANGED, this._onMessageReactionChanged, this);
    removeEventListener(Events.MESSAGE_MODIFIED, this._onMessagesModified, this);
    removeEventListener(Events.MESSAGES, this._onRecvElectronMessage, this);
    removeEventListener(Events.MESSAGES, this._onRecvMessages, this);
  }

  /**
   * 生成本地消息标识 ID，用以匹配消息发送过程中的不同阶段处理任务
   */
  private _createTransactionId(): number {
    return ++this._transactionIdCount;
  }

  private _getExistCache(conversation: IConversationIdentifier): IRCKitCachedMessageData | undefined {
    return this._histories.get(trans2ConversationKey(conversation));
  }

  /**
   * 获取或创建指定会话的缓存数据
   * 注意：本地没有缓存时，startTime 应该为 0
   * 否则获取a会话历史消息前接收到a消息，远端历史消息无法与缓存数据合并
   * @param conversation
   * @param forword
   * @returns
   */
  private _getOrCreateCache(
    conversation: IConversationIdentifier,
    timestamp: number,
    hasMoreAfterEndTime: boolean,
    hasMoreBeforeStartTime: boolean,
  ): IRCKitCachedMessageData {
    const key = trans2ConversationKey(conversation);
    let cached = this._histories.get(key);
    if (!cached) {
      cached = {
        histories: [],
        startTime: 0,
        endTime: timestamp === 0 ? getServerTime() : timestamp,
        hasMoreAfterEndTime,
        hasMoreBeforeStartTime,
      };
      this._histories.set(key, cached);
    }
    return cached;
  }

  private _emitBeforeSendMessage<T extends BaseMessage<any>>(
    conversation: IConversationIdentifier,
    message: T,
    options?: ISendMessageOptions,
  ): BeforeSendMessageEventData<T> {
    const data: BeforeSendMessageEventData<T> = { conversation, message, options };
    this.ctx.emitMutable(new RCKitEvent(RCKitEvents.BEFORE_SEND_MESSAGE, data));
    return data;
  }

  private _isSameMessage(source: IRCKitCachedMessage, target: IRCKitCachedMessage): boolean {
    if (source.messageUId && target.messageUId) {
      return source.messageUId === target.messageUId;
    }
    if (source.messageId && target.messageId) {
      return source.messageId === target.messageId;
    }
    return false;
  }

  /**
   * 向缓存队列尾部插入消息，插入时会自动去重
   * @param histories
   * @param message
   */
  private _push2Cache(cache: IRCKitCachedMessageData, ...messages: IRCKitCachedMessage[]): void {
    const { histories, startTime } = cache;
    messages.forEach((message) => {
      // 历史拉取与实时收消息可能交错到达，相同消息命中时直接替换，避免缓存中出现双份记录
      const unavailable = message.quoteInfo && this._unavailableMessages.get(this._messageKey(message, message.quoteInfo.messageUId));
      if (unavailable) this._setQuoteUnavailable(message, unavailable);
      const duplicateIndex = histories.findIndex((item) => this._isSameMessage(item, message));
      if (duplicateIndex !== -1) {
        histories.splice(duplicateIndex, 1, this._retainMessage(histories[duplicateIndex], message));
      } else {
        const detached = this._detachedMessages.get(trans2ConversationKey(message));
        const previous = detached?.get(message.messageUId);
        if (previous) message = this._retainMessage(previous, message);
        detached?.delete(message.messageUId);
        // 查找比当前消息时间更早的消息
        const index = findLastIndex(histories, (item) => item.sentTime < message.sentTime);
        if (index === -1) {
          histories.unshift(message);
        } else {
          histories.splice(index + 1, 0, message);
        }
      }
      // 更新结束时间
      const newTime = message.sentTime + 1;
      cache.endTime = cache.endTime === 0 ? newTime : Math.max(cache.endTime, newTime);
    });
    if (!startTime) {
      cache.startTime = Math.min(...messages.map((item) => item.sentTime)) - 1;
    }
  }

  /**
   * 向缓存队列头部插入消息，插入时会自动去重
   * @param cache
   * @param messages
   */
  private _unshift2Cache(cache: IRCKitCachedMessageData, ...messages: IRCKitCachedMessage[]): void {
    const { histories } = cache;
    messages.forEach((message) => {
      const unavailable = message.quoteInfo && this._unavailableMessages.get(this._messageKey(message, message.quoteInfo.messageUId));
      if (unavailable) this._setQuoteUnavailable(message, unavailable);
      const duplicateIndex = histories.findIndex((item) => this._isSameMessage(item, message));
      if (duplicateIndex !== -1) {
        histories.splice(duplicateIndex, 1, this._retainMessage(histories[duplicateIndex], message));
      } else {
        const detached = this._detachedMessages.get(trans2ConversationKey(message));
        const previous = detached?.get(message.messageUId);
        if (previous) message = this._retainMessage(previous, message);
        detached?.delete(message.messageUId);
        // 查找比当前消息时间更晚的消息
        const index = histories.findIndex((item) => item.sentTime > message.sentTime);
        if (index === -1) {
          histories.push(message);
        } else {
          histories.splice(index, 0, message);
        }
      }
      // 更新起始时间
      const newTime = message.sentTime - 1;
      cache.startTime = cache.startTime === 0 ? newTime : Math.min(cache.startTime, newTime);
    });
  }

  private _messageQueue: IAReceivedMessage[] = [];

  /**
   * 处理 Electron 平台接收消息
   * @description - Electron 平台下消息为逐条抛出，离线场景下会大量派发事件，事件会产生大量 timer 计时器，同时会频繁刷新 UI 导致性能下降；因此需要聚合消息批量处理
   * @param message
   */
  private _onRecvElectronMessage(evt: IMessagesEvent): void {
    this._messageQueue.push(...evt.messages);
  }

  private _messageHandleTimer: any = null;

  private _handleElectronMessages(): void {
    this._messageHandleTimer = setTimeout(() => {
      if (this._messageQueue.length > 0) {
        const messages = this._messageQueue.splice(0);
        this._handleMessages(messages);
      }

      this._messageHandleTimer = null;
      this._handleElectronMessages();
    }, 60);
  }

  private _onRecvMessages(evt: IMessagesEvent): void {
    this._handleMessages(evt.messages);
  }

  private _onMessageReactionChanged(evt: IMessageReactionEvent): void {
    if (!this.ctx.isMessageReactionEnabled) {
      // 功能未启用，不处理
      return;
    }

    const showUsers = this.ctx.isShowMessageReactUsersEnabled;
    const { reactions } = evt;

    /** 记录变更的消息 */
    const messages: Set<IRCKitCachedMessage> = new Set();

    /**
     * 记录需要重新查询 reaction summaries 信息的消息
     * @description 删除后 reaction.users 和 reaction.totalCount 可能出现数据不匹配，在需要显示人名的场景下，
     * 剩余人员列表可能不能满足显示需求，因此需要重新查一遍 summary 信息
    */
    const refetchMessages: Map<
    string,
    { identifier: IConversationIdentifier, msgSet: Set<IRCKitCachedMessage> }
  > = new Map();

    reactions.forEach((data) => {
      const {
        messageUId, conversationIdentifier, reactionId, operationType, totalCount, users,
      } = data;
      const key = trans2ConversationKey(conversationIdentifier);
      const cached = this._histories.get(key);
      if (!cached) {
        return;
      }
      const message = cached.histories.find((item) => item.messageUId === messageUId);
      if (!message) {
        // 未缓存的消息不需要处理
        return;
      }

      // 记录变更的消息，后续统一派发事件通知 UI 层更新
      messages.add(message);

      if (operationType === MessageReactionOperationType.CLEARED) {
        // 清空消息上的所有回应数据
        message.reactions.length = 0;
        return;
      }

      const crtUserId = this.ctx.userId;
      const { reactions } = message;
      const reactionIndex = reactions.findIndex((item) => item.reactionId === reactionId);
      /** 当前回应数据 */
      const reaction: IRCKitMessageReaction | undefined = message.reactions[reactionIndex];

      // 修改对应消息的 reactions 数据

      // 处理增加逻辑
      if (operationType === MessageReactionOperationType.ADDED) {
        const hasCurrentUserReacted = reaction?.hasCurrentUserReacted || users.some((u) => u.userId === crtUserId);
        // 修改 reaction.users 列表，最多保留 10 条记录，当前登录用户优先
        const newUsers = hasCurrentUserReacted ? [crtUserId] : [];
        (reaction?.users || []).concat(users.map(({ userId }) => userId)).forEach((userId) => {
          if (newUsers.length >= 10) {
            return;
          }
          if (!newUsers.includes(userId)) {
            newUsers.push(userId);
          }
        });

        if (reaction) {
          reaction.totalCount = totalCount;
          reaction.hasCurrentUserReacted = hasCurrentUserReacted;
          reaction.users = newUsers;
        } else {
          reactions.push({
            reactionId,
            totalCount,
            hasCurrentUserReacted,
            messageUId,
            users: newUsers,
            reactionTime: users[0].reactionTime,
          });
        }
      } else if (operationType === MessageReactionOperationType.REMOVED) {
        // 处理删除逻辑
        if (!reaction) {
          // 本身不存在的回应数据，无需处理
          return;
        }

        if (totalCount === 0) {
          // 回应人数清空，移除该表情回应
          reactions.splice(reactionIndex, 1);
          return;
        }

        reaction.totalCount = totalCount;
        users.forEach(({ userId }) => {
          const index = reaction!.users.findIndex((id) => id === userId);
          if (index !== -1) {
            reaction.users.splice(index, 1);
          }
        });
        reaction.hasCurrentUserReacted = reaction.users.includes(crtUserId);
        if (showUsers && reaction.users.length < Math.min(reaction.totalCount, 10)) {
          // 名单样本不足时补查摘要，本地人数和选中状态仍立即通知 UI。
          const data = refetchMessages.get(key) || { identifier: conversationIdentifier, msgSet: new Set() };
          data.msgSet.add(message);
          refetchMessages.set(key, data);
        }
      }
    });

    if (messages.size > 0) {
      this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, Array.from(messages)));
    }

    if (refetchMessages.size > 0) {
      [...refetchMessages.values()].forEach(({ identifier, msgSet }) => {
        // 显式刷新已有回应，不能使用只填充空 reactions 的首次加载入口。
        this._batchGetMessageReactionsSummay(identifier, Array.from(msgSet));
      });
    }
  }

  /**
   * 回执响应：收到后刷新相关消息的 V5 信息
   */
  private _onV5ReceiptResponse(responses: ReadReceiptResponseV5[]): void {
    try {
      if (!responses || !Array.isArray(responses)) return;
      // 先直接回填内存，确保 UI 即刻更新
      responses.forEach((r: ReadReceiptResponseV5) => {
        const key = trans2ConversationKey(r.identifier);
        let cached = this._histories.get(key);
        if (!cached) return;
        const index = cached.histories.findIndex((item) => item.messageUId === r.messageUId);
        if (index < 0) return;
        const readReceiptInfo: ReadReceiptInfoV5 = {
          identifier: r.identifier,
          messageUId: r.messageUId,
          unreadCount: r.unreadCount,
          readCount: r.readCount,
          totalCount: r.totalCount,
        };
        cached.histories[index].kitReadReceiptInfo = readReceiptInfo;
        this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [cached.histories[index]]));
      });
    } catch (e) {
      this.logger.warn(LogTag.L_V5_RECEIPT_RESPONSE_E, `onV5ReceiptResponse error: ${e}`);
    }
  }

  /**
   * 发送 V5 回执（对当前会话内指定消息）
   * messageUIds 需要根据内存态消息存储做校验去重、过滤缓存中非接收向、已有回执或不存在的消息
   */
  private async _sendReadReceiptMessageV5(conversation: IConversationIdentifier, messages: IRCKitCachedMessage[]) {
    if (this.ctx.readReceiptVersion !== GroupReadReceiptVersion.V5) return;
    const messageUIds = messages.map((item) => item.messageUId);
    // 去重、过滤缓存中非接收向、已有回执或不存在的消息
    const ids = Array.from(new Set((messageUIds || []).filter(Boolean)));

    if (ids.length === 0) {
      this.logger.info(LogTag.L_SEND_V5_RECEIPT_T, `sendV5Receipts ids size is 0, messageUIds: ${JSON.stringify(messageUIds)}`);
      return;
    }
    const convKey = trans2ConversationKey(conversation);
    const cached = this._histories.get(convKey);
    if (!cached || !cached.histories.length) return;
    const sendReceiptMessages = new Set(ids.filter((id) => {
      const m = cached.histories.find((x) => x.messageUId === id);
      if (!m) return false;
      const isReceive = m.messageDirection === 2;
      const notResponded = !this._v5Responded.has(id) && m.sendReceipt !== true && m.needReceipt;
      return isReceive && notResponded;
    }));

    if (sendReceiptMessages.size === 0) {
      this.logger.info(LogTag.L_SEND_V5_RECEIPT_T, 'sendV5Receipts messageUIds size is 0');
      return;
    }
    const sendReceiptMessagesList = Array.from(sendReceiptMessages);
    try {
      this.logger.info(LogTag.L_SEND_V5_RECEIPT_T, `sendV5Receipts: ${JSON.stringify(sendReceiptMessagesList)}`);
      const res = await sendReadReceiptResponseV5(conversation, sendReceiptMessagesList);
      this.logger.info(LogTag.L_SEND_V5_RECEIPT_R, `sendV5Receipts res: ${JSON.stringify(res)}`);
      sendReceiptMessagesList.forEach((id) => this._v5Responded.add(id));
      this._markSendReceiptTrue(conversation, sendReceiptMessagesList);
    } catch (e) {
      this.logger.warn(LogTag.L_SEND_V5_RECEIPT_E, `sendV5Receipts error: ${e}`);
    }
  }

  /**
   * 标记内存消息为已发送回执
   */
  private _markSendReceiptTrue(conversation: IConversationIdentifier, ids: string[]) {
    try {
      if (!ids || !ids.length) return;
      const convKey = trans2ConversationKey(conversation);
      const cached = this._histories.get(convKey);
      if (!cached) return;
      const set = new Set(ids);
      cached.histories.forEach((it) => {
        if (it.messageUId && set.has(it.messageUId)) {
          it.sendReceipt = true;
        }
      });
    } catch (e) { this.logger.warn(LogTag.L_SEND_V5_RECEIPT_E, `markSendReceiptTrue error: ${e}`); }
  }

  private _handleMessages(messages: IAReceivedMessage[]): void {
    // 非存储的消息，由业务层处理
    const unPresitedMsgs: IRCKitCachedMessage[] = [];
    // 需要通知 UI 层的消息
    let newMsgs: IRCKitCachedMessage[] = [];

    messages.forEach(async (message) => {
      const msg = createRCKitCacheMessage(message);

      // Electron 接收的是撤回信令信息，不存储。和 web 报错一致改为存储继续走下面逻辑
      if (electronExtension.enable() && msg.messageType === MessageType.RECALL) {
        message.isPersited = true;
      }
      if (!message.isPersited || isInvalidConversation(message)) {
        // 不存储的消息，以及会话类型不合法的消息，直接派发给业务层
        unPresitedMsgs.push(msg);
        return;
      }

      // 处理撤回消息
      if (msg.messageType === MessageType.RECALL) {
        const { messageUId } = msg.content;
        // 从当前批次待处理消息中查找删除消息，替换为撤回消息，无需再通知新接收消息
        // 一般发生在拉取大量离线消息时，消息中包含撤回消息的场景
        let index = newMsgs.findIndex((item) => item.messageUId === messageUId);
        if (index !== -1) {
          newMsgs.splice(index, 1, msg);
          return;
        }
      }

      newMsgs.push(msg);
    });

    // 二次处理 newMsgs
    newMsgs = this._handleNotifiedUIMessaages(newMsgs);

    // 通知 UI 层接收到新消息
    const messageList = newMsgs.filter((item) => item.messageType !== MessageType.RECALL);
    if (messageList.length) {
      this.ctx.dispatch(new RCKitEvent(InnerEvent.RECV_NEW_MESSAGES, newMsgs));
    }

    // 通知 App 层接收到非存储的消息
    if (unPresitedMsgs.length) {
      this.ctx.emit(new RCKitEvent(RCKitEvents.UNSCHEDULED_MESSAGES, unPresitedMsgs));
    }
  }

  // 需要通知 UI 层的消息
  private _handleNotifiedUIMessaages(messages: IRCKitCachedMessage[]): IRCKitCachedMessage[] {
    /** 记录接收到的含有 quoteInfo 的消息数据，消息被推入缓存后检查并拉取 quoteMessage */
    const conversationCacheMap: Map<string, { messages: IRCKitCachedMessage[], conversation: IConversationIdentifier }> = new Map();

    messages.forEach((msg) => {
      const key = trans2ConversationKey(msg);
      const cached = this._getOrCreateCache(msg, msg.sentTime + 1, false, true);
      let list: IRCKitCachedMessage[];
      if (conversationCacheMap.has(key)) {
        list = conversationCacheMap.get(key)!.messages;
      } else {
        list = [];
        const conversation: IConversationIdentifier = {
          targetId: msg.targetId,
          conversationType: msg.conversationType,
          channelId: msg.channelId,
        };
        conversationCacheMap.set(key, { conversation, messages: list });
      }

      // 撤回消息二次检查
      // 因要保证撤回消息与原消息位置一致，故需从缓存中查找，不能直接向缓存队列中 push
      if (this._isRecallMessage(msg) && this._applyRecallMessage(msg)) return;

      // 非撤回消息，尝试向缓存中插入
      if (!cached.hasMoreAfterEndTime && msg.messageType !== MessageType.RECALL) {
        // 缓存数据已与现实最新时间有连续性，直接向后插入消息，并更新 endTime
        this._push2Cache(cached, msg);
        list.push(msg);
      }
    });

    Array.from(conversationCacheMap.entries()).forEach(([key, data]) => {
      this._checkAndFillQuoteInfo(data.conversation, data.messages);
      this._checkAndFillReactions(data.conversation, data.messages);
    });

    return messages.map((message) => this.getCachedMessage(message, message.messageUId) || message);
  }

  /**
   * 判断时间点是否与指定消息列表数据有时间重合
   * @param cache
   * @param timestamp
   * @returns
   */
  private _ifTimeCoincides(cache: IRCKitCachedMessageData, timestamp: number): boolean {
    return cache.endTime >= timestamp && cache.startTime <= timestamp;
  }

  /**
   * 从 IMLib 请求历史消息，当返回数据与缓存数据有重合时，将会合并到缓存数据中
   * @param conversation
   * @param timestamp
   * @param forward
   */
  private async _requestHistoriesFromLib(conversation: IConversationIdentifier, timestamp: number, forward: boolean): Promise<{ hasMore: boolean, list: IRCKitCachedMessage[], code: number }> {
    const session = this._getUserCacheSession();
    const res = await getHistoryMessages(conversation, { timestamp, count: MESSAGE_PAGE_SIZE, order: forward ? 0 : 1 });
    if (!res.isOk) {
      return { code: res.code, hasMore: true, list: [] };
    }

    const { list, hasMore } = res.data!;
    let tmpList = await this._handleTransIAReceivedMessages(list, conversation);
    if (!this._isCurrentUserCache(session)) return { code: ErrorCode.SUCCESS, hasMore: false, list: [] };
    // Register terminal states before retaining local rows or merging either history range.
    tmpList.forEach((message) => {
      if (this._isRecallMessage(message)) this._applyRecallMessage(message);
    });

    // 取缓存数据，此时必定存在缓存数据，所以从第二个参数开始并无实际意义
    const cached = this._getOrCreateCache(conversation, timestamp, timestamp !== 0, true);

    // 缓存的开始时间始终小于第一条未读时间(Electron场景会出现第一条未读大于本地缓存记录缓存的问题)
    if (!forward && timestamp !== 0 && cached.startTime > timestamp) {
      cached.startTime = timestamp - 1;
    }

    if (
      // 检查请求时间是否与缓存数据时间重合
      this._ifTimeCoincides(cached, timestamp)
      // 消息队列数据与缓存时间重合
      || (list.length && (this._ifTimeCoincides(cached, list[0].sentTime) || this._ifTimeCoincides(cached, list[list.length - 1].sentTime)))
    ) {
      // 数据重合，合并数据
      if (forward) {
        // 服务给的数据为降序，需反转
        tmpList = tmpList.reverse();
        this._unshift2Cache(cached, ...tmpList);
        cached.hasMoreBeforeStartTime = hasMore;
      } else {
        this._push2Cache(cached, ...tmpList);
        cached.hasMoreAfterEndTime = hasMore;
      }
    } else {
      if (forward) tmpList.reverse();
      tmpList = tmpList.map((message) => cached.histories.find((item) => item.messageUId === message.messageUId)
        || this._rememberDetachedMessage(conversation, message));
    }

    tmpList = tmpList.map((message) => this.getCachedMessage(conversation, message.messageUId) || message);
    this._checkAndFillQuoteInfo(conversation, tmpList);
    return { hasMore, list: tmpList, code: ErrorCode.SUCCESS };
  }

  private async _handleTransIAReceivedMessages(messages: IAReceivedMessage[], conversation: IConversationIdentifier): Promise<IRCKitCachedMessage[]> {
    const kitMessages: IRCKitCachedMessage[] = messages.map((item) => createRCKitCacheMessage(item));
    // V5 逻辑
    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      const res = await this._handleReadReceiptV5(conversation, kitMessages);
      return res;
    }
    return kitMessages;
  }

  private async _handleReadReceiptV5(conversation: IConversationIdentifier, kitMessages: IRCKitCachedMessage[]): Promise<IRCKitCachedMessage[]> {
    if (kitMessages.length === 0) return [];
    try {
      // 只获取己方发送的消息的阅读状态
      const selfSentMessages = kitMessages.filter((item) => item.senderUserId === this.ctx.userId);
      if (selfSentMessages.length === 0) return kitMessages;

      const messageUIds = selfSentMessages.map((item) => item.messageUId);
      const { data } = await getMessageReadReceiptInfoV5(conversation, messageUIds);
      if (data && data.length > 0) {
        data.forEach((item) => {
          const index = kitMessages.findIndex((cacheItem) => cacheItem.messageUId === item.messageUId);
          if (index > -1) { kitMessages[index].kitReadReceiptInfo = item; }
        });
      }
    } catch (e) {
      this.logger.warn(LogTag.L_HANDLE_READ_RECEIPT_V5_E, `_handleReadReceiptV5 error: ${e}`);
    }
    return kitMessages;
  }

  private async _reqHistoriesHandler(conversation: IConversationIdentifier, timestamp: number = 0, forward: boolean = true): Promise<{ hasMore: boolean, list: IRCKitCachedMessage[], code: number }> {
    // 获取缓存数据
    const cached = this._getOrCreateCache(conversation, timestamp, timestamp !== 0, true);
    const {
      histories, hasMoreAfterEndTime, hasMoreBeforeStartTime, startTime, endTime,
    } = cached;
    if (!hasMoreAfterEndTime && timestamp === 0 && forward) {
      // 解决 endTime 小于缓存中最后一条消息的 sentTime 时，切会话无法获取最新历史消息
      const messageTime = histories[histories.length - 1]?.sentTime || 0;
      if (messageTime > endTime) {
        cached.endTime = messageTime + 1;
      }
      timestamp = cached.endTime;
    }

    if (!this._ifTimeCoincides(cached, timestamp)) {
      // 请求时间点与缓存数据时间不重合，请求远程数据)
      return this._requestHistoriesFromLib(conversation, timestamp, forward);
    }

    // 从缓存中获取所有符合时间要求的消息列表
    let list: IRCKitCachedMessage[];
    if (forward) {
      const index = findLastIndex(histories, (item) => item.sentTime < timestamp);
      list = histories.slice(0, index + 1);
    } else {
      const index = histories.findIndex((item) => item.sentTime > timestamp);
      list = histories.slice(index);
    }

    const hasMore = forward ? hasMoreBeforeStartTime : hasMoreAfterEndTime;

    if (list.length < MESSAGE_PAGE_SIZE) {
      const res = await this._reqHasMoreHistories(hasMore, startTime, endTime, forward, conversation, timestamp, list);
      return res;
    }

    let msgList = forward ? list.slice(list.length - MESSAGE_PAGE_SIZE) : list.slice(0, MESSAGE_PAGE_SIZE);

    // V5 逻辑：从缓存获取消息时，需要重新获取己方发送消息的阅读状态
    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5 && conversation.conversationType === ConversationType.GROUP) {
      // 重新获取阅读状态并更新缓存
      await this._handleReadReceiptV5(conversation, msgList);
      // 同步更新缓存中的消息
      msgList.forEach((msg) => {
        const index = cached.histories.findIndex((item) => item.messageUId === msg.messageUId);
        if (index > -1 && msg.kitReadReceiptInfo) {
          cached.histories[index].kitReadReceiptInfo = msg.kitReadReceiptInfo;
        }
      });
    }

    // 缓存数据充足，直接指定条目
    return {
      // 远端 hasMore 或缓存数据有更多数据，均返回 true
      hasMore: hasMore || list.length > MESSAGE_PAGE_SIZE,
      list: msgList,
      code: ErrorCode.SUCCESS,
    };
  }

  private async _reqHasMoreHistories(hasMore: boolean, startTime: number, endTime: number, forward: boolean, conversation: IConversationIdentifier, timestamp: number = 0, list: IRCKitCachedMessage[] = []) {
    if (hasMore) {
      // 缓存数据不足，且存在更多历史消息可拉取，从 IMLib 同步数据
      const forwardTime = startTime === 0 ? 0 : startTime + 1;
      const backwardTime = endTime === 0 ? 0 : endTime - 1;
      const tmpTimestamp = forward ? forwardTime : backwardTime;
      const { code } = await this._requestHistoriesFromLib(conversation, tmpTimestamp, forward);
      if (code === ErrorCode.SUCCESS) {
        // 递归
        return this._reqHistoriesHandler(conversation, timestamp, forward);
      }
      // 当次请求失败，直接返回缓存数据
      return { hasMore, list, code };
    }
    // 无更多数据可拉取
    return { hasMore, list, code: ErrorCode.SUCCESS };
  }

  /**
   * 获取指定会话历史消息，默认一次获取 30 条
   * @param conversation - 会话
   * @param timestamp - 时间戳，默认从最新当前时间开始获取，返回数据不包含该时间点的消息
   * @param forward - 是否取时间点以前的消息，默认为 true
   */
  async reqHistories(conversation: IConversationIdentifier, timestamp: number = 0, forward: boolean = true): Promise<{ hasMore: boolean, list: IRCKitCachedMessage[], code: number }> {
    // this.logger.info(LogTag.D, `reqHistories -> timestamp: ${timestamp}, forward: ${forward}`)
    const res = await this._reqHistoriesHandler(conversation, timestamp, forward);
    // 检查填充引用数据
    this._checkAndFillQuoteInfo(conversation, res.list);
    this._checkAndFillReactions(conversation, res.list);
    return res;
  }

  /**
   * 发送消息，该接口仅限于发送单、群聊消息，向其他类型会话发送消息会返回 -3 参数错误
   * @param conversation - 会话
   * @param message - 消息
   * @param options - 发送选项
   * @param replyMessage - 用于本地构建 msg 缓存对象时直接构建 quoteInfo
   */
  async sendMessage(
    conversation: IConversationIdentifier,
    message: BaseMessage<any>,
    options?: ISendMessageOptions,
    replyMessage?: IAReceivedMessage | null,
  ): Promise<{ code: number, message?: IAReceivedMessage }> {
    if (isInvalidConversation(conversation) || !isPrivOrGroupConversation(conversation)) {
      return { code: InnerErrorCode.INVALID_CONVERSATION };
    }

    const session = this._getUserCacheSession();

    const transactionId = this._createTransactionId();
    // V5 发消息需要携带 needReceipt 参数
    // SDK 侧 needReceipt 使用限制（否则返回 35056）：
    // 1. 仅支持单聊、群聊
    // 2. 状态消息 / 不存储的消息不可配置
    // 3. 群内定向消息（即 directionalUserIdList 非空）不可配置
    // 注意：isMentioned 只表示"是否为 @ 消息"，不等于定向消息，@ALL 和 @ 指定用户都不是定向消息
    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      const isSupport = [ConversationType.PRIVATE, ConversationType.GROUP].includes(conversation.conversationType);
      const directionalUserIdList = options?.directionalUserIdList;
      const isDirected = Array.isArray(directionalUserIdList) && directionalUserIdList.length > 0;
      const isStatusMessage = options?.isStatusMessage === true;
      const isPersited = message.isPersited !== false;
      if (isSupport && !isDirected && !isStatusMessage && isPersited) {
        (options as any) = { needReceipt: true, ...(options || {}) };
      }
    }

    const sendData = this._emitBeforeSendMessage(conversation, message, options);
    message = sendData.message;
    options = sendData.options;

    const msg = this._transBaseMessage2CachedMessage(conversation, message, transactionId, options);
    // 根据 quoteInfo 确定是否是要做回复消息，避免重复检查开关和白名单等
    if (replyMessage && options?.quoteInfo) {
      msg.quoteInfo = createQuoteInfo(replyMessage);
    } else if (replyMessage && msg.messageType === MessageType.REFERENCE
      && msg.quoteInfo?.messageUId === replyMessage.messageUId) {
      // V1 从原消息的成功编辑记录补齐本地标记，不向发送内容添加 referMsgStatus。
      msg.quoteInfo.isEdited = !!getSuccessfulEditTimestamp(replyMessage);
    }

    if (isObject(msg.content)) {
      // 消息 content 进行拷贝，防止 Proxy 数据导致 Electron 发送消息报错导致消息状态一直是发送中
      try {
        msg.content = cloneByJSON(msg.content);
      } catch (error: any) {
        this.logger.warn(LogTag.A_SEND_MESSAGE_E, error.message);
      }
    }
    // 不存储的消息不需要缓存和通知 UI 变更
    if (msg.isPersited) {
      const cached = this._getOrCreateCache(conversation, msg.sentTime + 1, false, true);
      if (cached.hasMoreAfterEndTime) {
        // 说明存在以中间时间点拉取消息的记录，消息记录与现实数据不连续
        // 因发送有本地状态需要存储，所以以本地发送数据为准，清理缓存数据以避免缓存断档
        cached.histories.forEach((message) => this._releaseLocalMediaUrl(message));
        cached.histories.length = 0;
        cached.startTime = msg.sentTime;
        cached.hasMoreBeforeStartTime = true;
        cached.hasMoreAfterEndTime = false;
      }
      this._push2Cache(cached, msg);

      //  通知 UI 层更新消息列表
      this.ctx.dispatch(new RCKitEvent(InnerEvent.INSERT_NEW_MESSAGES, [msg]));
    }

    // 推送到消息发送队列
    const { code, data } = await this._sendQueue.push({
      conversation, message: msg, options, transactionId: msg.transactionId, session,
    });
    if (!this._isCurrentUserCache(session)) {
      return { code, message: data };
    }
    if (code !== ErrorCode.SUCCESS) {
      msg.sentStatus = SentStatus.FAILED;
    } else {
      this._updateCachedMessage(msg, data!);

      if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5 && msg.conversationType === ConversationType.GROUP) {
        await this._handleReadReceiptV5(conversation, [msg]);
        if (!this._isCurrentUserCache(session)) {
          return { code, message: data };
        }
      }
    }

    if (msg.isPersited) {
      //  通知 UI 层更新消息列表
      this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [msg]));
    }
    return { code, message: data };
  }

  private _updateCachedMessage(msg: IRCKitCachedMessage, source: IAReceivedMessage): void {
    const {
      sentStatus, sentTime, messageUId, messageId,
    } = source;
    msg.sentStatus = sentStatus;
    msg.sentTime = sentTime;
    msg.messageUId = messageUId;
    msg.messageId = messageId;
  }

  /**
   * 批量发送媒体类、文件类消息
   * @param conversation
   * @param files
   * @param msgCreator
   */
  private async _sendMultiMediaMessage(
    msgCreator: (file: File) => Promise<BaseMessage<any>>,
    conversation: IConversationIdentifier,
    files: File[],
  ): Promise<void> {
    const session = this._getUserCacheSession();
    // 解析期间会话和回复栏都可能变化，固定本次发送的会话与引用身份。
    conversation = { ...conversation };
    const replyMsg = replyMessage.value;
    const replySelectionId = getReplyMessageSelectionId();
    const quoteSnapshot = this.ctx.isQuoteMessageV2Enabled && replyMsg && isSameConversation(conversation, replyMsg)
      ? createQuoteInfo({ ...replyMsg })
      : undefined;
    if (files.length > 99) {
      this.ctx.alert('alert.pickfiles.maxcount', '99');
      return;
    }

    // 拣选非法文件
    const invalid: File[] = [];
    const valid: File[] = [];
    for (let file of files) {
      // 超出 100MB 或为 0 大小的文件均视为非法
      if (file.size > 100 * 1024 * 1024 || file.size === 0) {
        invalid.push(file);
      } else {
        valid.push(file);
      }
    }

    if (invalid.length > 0) {
      // 对业务层抛出事件，以提示用户部分文件超过大小非法
      this.ctx.emit(new RCKitEvent(RCKitEvents.FILE_SEND_FAILED_EVENT, invalid));
    }

    if (valid.length === 0) {
      return;
    }

    const messageOptionsMap = new Map<number, ISendMessageOptions | undefined>();
    const preparedMessages = new Set<IRCKitCachedMessage>();
    let aborted = false;
    // 用于缓存的消息
    const messages = await Promise.all(valid.map(async (file) => {
      const baseMessage = await msgCreator(file);
      if (aborted || !this._isCurrentUserCache(session)) {
        releaseLocalMediaUrl(baseMessage);
        return undefined;
      }
      try {
        let options: ISendMessageOptions | undefined;
        if (valid.length === 1 && quoteSnapshot && this.ctx.input.isQuoteInfoEnabledForMessageType(baseMessage.messageType)) {
          const { messageUId, senderId, objectName } = quoteSnapshot;
          options = { quoteInfo: { messageUId, senderId, objectName } };
        }
        const sendData = this._emitBeforeSendMessage({ ...conversation }, baseMessage, options);
        const msg = this._transBaseMessage2CachedMessage(conversation, sendData.message, this._createTransactionId(), sendData.options);
        // 仅为未被业务替换或标记失效的原引用补齐本地预览，发送引用以事件返回的 options 为准。
        if (quoteSnapshot && msg.quoteInfo?.messageUId === quoteSnapshot.messageUId
          && msg.quoteInfo.senderId === quoteSnapshot.senderId && msg.quoteInfo.objectName === quoteSnapshot.objectName
          && msg.quoteInfo.status === RCKitQuoteMessageStatus.LOADING) {
          Object.assign(msg.quoteInfo, {
            status: quoteSnapshot.status,
            quoteMessage: quoteSnapshot.quoteMessage,
            isEdited: quoteSnapshot.isEdited,
          });
        }
        const localUrl = takeLocalMediaUrl(baseMessage);
        if (localUrl) this._localMediaUrls.set(msg, localUrl);
        preparedMessages.add(msg);
        messageOptionsMap.set(msg.transactionId, sendData.options);
        msg.file = file;
        msg.progress = 0;
        return msg;
      } finally {
        releaseLocalMediaUrl(baseMessage);
      }
    })).catch((error) => {
      aborted = true;
      preparedMessages.forEach((message) => this._releaseLocalMediaUrl(message));
      throw error;
    });

    if (!this._isCurrentUserCache(session)) {
      preparedMessages.forEach((message) => this._releaseLocalMediaUrl(message));
      return;
    }

    const msgs = messages.filter((message): message is IRCKitCachedMessage => !!message);
    if (msgs.length === 0) {
      return;
    }

    // 白名单和单条限制仅控制是否携带 quoteInfo；V2 媒体消息进入发送流程后均结束本次回复态。
    const currentReply = replyMessage.value;
    if (quoteSnapshot && currentReply && getReplyMessageSelectionId() === replySelectionId
      && currentReply.messageUId === quoteSnapshot.messageUId && isSameConversation(conversation, currentReply)) {
      replyMessage.value = null;
    }

    // 无网络时，媒体类消息直接置为发送失败，和文本消息表现一致
    const offline = this.ctx.status !== RCConnectionStatus.CONNECTED;
    if (offline) {
      msgs.forEach((m) => {
        m.progress = -1;
        m.sentStatus = SentStatus.FAILED;
      });
    }

    // 插入缓存
    const msg = msgs[0];
    const cached = this._getOrCreateCache(conversation, msg.sentTime + 1, false, true);
    if (cached.hasMoreAfterEndTime) {
      // 清空缓存
      cached.histories.forEach((message) => this._releaseLocalMediaUrl(message));
      cached.histories.length = 0;
      cached.startTime = msg.sentTime + 1;
      cached.hasMoreBeforeStartTime = true;
      cached.hasMoreAfterEndTime = false;
    }
    this._push2Cache(cached, ...msgs);

    // 通知 UI 层更新消息列表
    this.ctx.dispatch(new RCKitEvent(InnerEvent.INSERT_NEW_MESSAGES, msgs));

    // 离线状态下，不进入上传与发送队列，直接返回
    if (offline) {
      return;
    }

    // 按顺序推入上传队列
    const promises = msgs.map((msg) => this._uploadQueue.push({
      message: msg,
      transactionId: msg.transactionId!,
      session,
    }));
    for (let promise of promises) {
      // 顺序等待上传完成，以保证消息发送顺序
      const { code, data } = await promise;

      if (!this._isCurrentUserCache(session)) {
        return;
      }

      const { message } = data!;

      // 验证 message 是否还处于列表，若不在列表中，说明已被删除，不再处理
      const index = cached.histories.findIndex((item) => item.transactionId === message.transactionId);
      if (index === -1) {
        this._releaseLocalMediaUrl(message);
        continue;
      }

      if (code !== ErrorCode.SUCCESS) {
        // 更新消息状态
        message.progress = -1;
        message.sentStatus = SentStatus.FAILED;
        // 派发消息状态变更事件
        this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [message]));
        continue;
      }

      const httpUrl = data!.httpUrl!;

      // 清空 file 引用
      message.file = undefined;
      this._updateHttpUrl(message, httpUrl);

      // 顺序推入发送队列
      this._push2SendQueue(message, message, messageOptionsMap.get(message.transactionId), session);
    }
  }

  private _updateHttpUrl(message: IRCKitCachedMessage, httpUrl: string): void {
    switch (message.messageType) {
      case MessageType.IMAGE:
        message.content.imageUri = httpUrl;
        break;
      case MessageType.GIF:
        message.content.remoteUrl = httpUrl;
        break;
      case MessageType.SIGHT:
        message.content.sightUrl = httpUrl;
        break;
      case MessageType.COMBINE_V2:
        message.content.remoteUrl = httpUrl;
        break;
      default:
        message.content.fileUrl = httpUrl;
        break;
    }
    this._releaseLocalMediaUrl(message);
  }

  /**
   * 批量发送文件消息，文件视类型不同会被发送为不同的消息类型：
   * * 若文件为可解析的视频编码且时长不大于 1min，会被发送为视频消息，否则都按文件消息发送
   * @param conversation - 会话
   * @param files - 待发送文件列表
   * @description - 内部使用接口，不校验参数合法性
   */
  public sendFiles = this._sendMultiMediaMessage.bind(this, parseFileToMessage);

  /**
   * 向本地插入一条消息，不发送到服务器
   * @param conversation - 会话
   * @param message - 消息
   * @param options
   * @description - 不允许用户直接插入从服务器接收到的消息，否则可能会导致消息缓存列表断档
   */
  async insertMessage(conversation: IConversationIdentifier, message: BaseMessage<any>, options?: IInsertOptions): Promise<{ code: number, message?: IAReceivedMessage }> {
    if (isInvalidConversation(conversation) || !isPrivOrGroupConversation(conversation)) {
      // 非单群聊消息禁止插入
      return { code: InnerErrorCode.INVALID_CONVERSATION };
    }

    // 用户可能从任意时间点插入消息，因此插入不能影响缓存数据的 endTime 和 startTime 时间，以免造成缓存数据不连续
    const transactionId = this._createTransactionId();
    const msg = this._transBaseMessage2CachedMessage(conversation, message, transactionId);

    if (msg.isPersited) {
      const cached = this._getOrCreateCache(conversation, msg.sentTime + 1, true, true);
      let index = findLastIndex(cached.histories, (item) => item.messageUId === msg.messageUId || item.messageId === msg.messageId);
      if (index !== -1) {
        cached.histories.splice(index, 1, msg);
      } else {
        index = findLastIndex(cached.histories, (item) => item.sentTime <= msg.sentTime);
        if (index === -1) {
          cached.histories.unshift(msg);
        } else {
          cached.histories.splice(index, 0, msg);
        }
      }

      //  通知 UI 层更新消息列表
      this.ctx.dispatch(new RCKitEvent(InnerEvent.INSERT_NEW_MESSAGES, [msg]));
    }

    if (electronExtension.enable()) {
      // 向协议栈数据库插入消息
      const { code, data } = await electronExtension.insertMessage(conversation, msg, options);
      if (code === ErrorCode.SUCCESS) {
        msg.messageId = data!.messageId;
      }
      return { code, message: msg };
    }
    return { code: ErrorCode.SUCCESS, message: msg };
  }

  private _transBaseMessage2CachedMessage(
    conversation: IConversationIdentifier,
    message: BaseMessage<any>,
    transactionId: number,
    options?: ISendMessageOptions,
  ): IRCKitCachedMessage {
    const { conversationType, targetId, channelId } = conversation;
    const {
      isCounted, isPersited, content, messageType,
    } = message;
    const senderUserId: string = this.ctx.userId;
    let quoteInfo: IRCKitQuoteInfo | undefined;
    if (messageType === MessageType.REFERENCE) {
      const { referMsgUserId } = content as IReferenceMessageContent;
      const direction: MessageDirection = referMsgUserId !== senderUserId
        ? MessageDirection.RECEIVE
        : MessageDirection.SEND;
      quoteInfo = createRCKitQuoteInfoByReferenceMessageContent(content, conversation, direction);
    } else if (options?.quoteInfo) {
      quoteInfo = trans2RCKitQuoteInfo(options.quoteInfo);
    }
    const msg: IRCKitCachedMessage = {
      transactionId,
      targetId,
      conversationType,
      messageDirection: 1,
      messageType,
      sentTime: getServerTime(),
      isStatusMessage: options?.isStatusMessage,
      isCounted,
      isPersited,
      content,
      channelId: channelId || '',
      senderUserId,
      receivedTime: 0,
      messageUId: '',
      sentStatus: SentStatus.SENDING,
      isOffLineMessage: false,
      canIncludeExpansion: options?.canIncludeExpansion || false,
      receivedStatus: 0,
      isMentioned: options?.isMentioned,
      expansion: options?.expansion,
      quoteInfo,
      reactions: [],
    };

    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      msg.kitReadReceiptInfo = undefined;
    }
    return msg;
  }

  /**
   * 消息批量删除或撤回
   * @param conversation
   * @param messages
   * @param recall
   */
  async deleteMessages(conversation: IConversationIdentifier, messages: IRCKitCachedMessage[], recall: boolean): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    // 筛选发送成功或失败的消息，发送中的消息不可撤回或删除，不予处理
    const sentList: IRCKitCachedMessage[] = [];
    const failedList: IRCKitCachedMessage[] = [];
    const session = this._getUserCacheSession();
    const cachedConversation = this.ctx.conversation.getCachedConversationByKey(trans2ConversationKey(conversation));
    const activeUid = cachedConversation?.updatingMessageUId;
    if (activeUid && messages.some((message) => message.messageUId === activeUid)) {
      this.clearEdit(conversation, activeUid);
    }
    messages.forEach((message) => {
      if (message.messageUId) {
        sentList.push(message);
      } else if (message.sentStatus === SentStatus.FAILED) {
        failedList.push(message);
      }
    });

    const history = this._getExistCache(conversation);

    // 分别记录被撤回或删除的消息
    const recallList: IRCKitDeleteMessageData[] = [];

    // 已发送的消息，根据 recall 确定是否需要撤回，或仅调用删除接口
    if (sentList.length) {
      const { recallList: sendRecallList } = await this._handleSentList(recall, sentList, conversation);
      if (!this._isCurrentUserCache(session)) return;
      recallList.push(...sendRecallList);
      // Successful operations already invalidate edits and reference snapshots.
    }

    // 对于本身状态为发送失败的消息，直接删除本地缓存和数据库
    if (failedList.length && history && history.histories.length) {
      failedList.forEach((message) => {
        // 失败的消息没有 messageUid，需根据 messageId 或 transactionId 匹配
        const index = history.histories.findIndex((item) => {
          if (item.messageUId) {
            return item.messageUId === message.messageUId;
          }
          return item.transactionId === message.transactionId;
        });
        if (index !== -1) {
          const [target] = history.histories.splice(index, 1);
          this._releaseLocalMediaUrl(target);
          recallList.push({ target });
        }
      });
    }

    // 通知 UI 层消息被撤回
    if (recallList.length) {
      this.ctx.dispatch(new RCKitEvent(RCKitEvents.MESSAGES_DELETED, recallList));
    }
  }

  getAllowedToRecallTime(): number {
    return this.ctx.allowedToRecallTime;
  }

  private async _handleSentList(recall: boolean, sentList: IRCKitCachedMessage[], conversation: IConversationIdentifier) {
    const session = this._getUserCacheSession();
    const reqSuccess: IRCKitCachedMessage[] = [];
    const reqFailed: IRCKitCachedMessage[] = [];
    const recallList: IRCKitDeleteMessageData[] = [];

    if (recall) {
      const list = await Promise.all(sentList.map((message) => recallMessage(conversation, {
        messageUId: message.messageUId!,
        sentTime: message.sentTime,
        isDelete: false,
      }).catch(() => ({ code: -1 }))));
      list.forEach((res, index) => {
        if (res.code === ErrorCode.SUCCESS) {
          reqSuccess.push(sentList[index]);
          return;
        }

        reqFailed.push(sentList[index]);
      });
    } else {
      const res = await deleteMessages(conversation, sentList.map((message) => ({
        messageUId: message.messageUId!,
        sentTime: message.sentTime,
        messageDirection: message.messageDirection,
      }))).catch(() => ({ code: -1 }));
      if (res.code === ErrorCode.SUCCESS) {
        reqSuccess.push(...sentList);
      } else {
        reqFailed.push(...sentList);
      }
    }
    if (!this._isCurrentUserCache(session)) return { recallList, successfulUIds: [] as string[] };
    reqSuccess.forEach((message) => this._markUnavailable(
      conversation,
      message.messageUId,
      recall ? RCKitQuoteMessageStatus.RECALLED : RCKitQuoteMessageStatus.DELETED,
    ));
    // 处理撤回或删除成功的消息
    reqSuccess.forEach((message) => {
      const currentHistory = this._getExistCache(conversation);
      const detached = this._detachedMessages.get(trans2ConversationKey(conversation));
      const target = this.getCachedMessage(conversation, message.messageUId);
      if (!target) return;
      const index = currentHistory?.histories.indexOf(target) ?? -1;
      const recallMsg = recall ? this._trans2RecallMessage(target) : undefined;
      if (index !== -1) {
        if (recallMsg) currentHistory!.histories.splice(index, 1, recallMsg);
        else currentHistory!.histories.splice(index, 1);
      } else if (recallMsg) detached?.set(message.messageUId, recallMsg);
      else detached?.delete(message.messageUId);
      recallList.push({ target, recallMsg });
    });

    // 删除失败的消息不予处理（产品逻辑：删除远端成功后才删本地）
    if (reqFailed.length) {
      // 提示部分消息删除失败
      this.ctx.alert('alert.delete.messages.partial.failure', reqFailed.length);
    }
    return { recallList, successfulUIds: reqSuccess.map((message) => message.messageUId) };
  }

  private _trans2RecallMessage(message: IRCKitCachedMessage): IRCKitCachedMessage {
    const msg: IRCKitCachedMessage = {
      ...message,
      messageType: MessageType.RECALL,
      content: {
        messageUid: message.messageUId,
        sentTime: message.sentTime,
        targetId: message.targetId,
        conversationType: message.conversationType,
        channelId: message.channelId,
      },
      isMentioned: false,
      editStatus: undefined,
      editDraft: undefined,
      editTimestamp: undefined,
      quoteInfo: undefined,
    };
    return msg;
  }

  /**
   * 将消息逐条转发到指定会话
   * @param conversation
   * @param messages
   * @description - 仅用于 UI 层面调用，无需校验参数合法性
   */
  async forward(conversation: IConversationIdentifier, messages: IRCKitCachedMessage[]) {
    if (messages.length === 0) {
      return;
    }

    const { conversationType, targetId, channelId } = conversation;
    const sentTime = getServerTime();
    const messageOptionsMap = new Map<number, ISendMessageOptions | undefined>();

    // 修改消息内容与状态
    const msgs: IRCKitCachedMessage[] = messages.map((item) => {
      const msg: IRCKitCachedMessage = { ...item };
      // 转发产生独立消息，不继承原消息的编辑草稿、状态和 SDK 修改记录。
      delete msg.editStatus;
      delete msg.editDraft;
      delete msg.editTimestamp;
      delete msg.modifyInfo;
      // 拷贝消息内容，防止修改原消息内容导致 UI 层面显示异常
      const content = cloneByJSON(item.content);
      if (content.mentionedInfo) {
        // 转发消息去掉 mentionedInfo 信息，防止接收端会话识别为@信息
        delete content.mentionedInfo;
      }
      delete msg.quoteInfo; // 转发消息去掉引用信息，防止接收端会话识别为引用消息
      msg.hasReactions = false; // 修改回应消息数据
      msg.reactions = [];
      msg.content = content;
      msg.messageUId = '';
      // 转发消息的本地 ID 由 SDK 重新分配，避免在同会话缓存中覆盖源消息。
      delete msg.messageId;
      msg.transactionId = this._createTransactionId();
      msg.conversationType = conversationType;
      msg.targetId = targetId;
      msg.channelId = channelId || '';
      msg.sentStatus = SentStatus.SENDING;
      msg.messageDirection = 1;
      msg.sentTime = sentTime;
      msg.senderUserId = this.ctx.userId;
      // 清除已读状态信息，防止原消息的已读状态被带到转发消息
      if (msg.readReceiptInfo) {
        delete msg.readReceiptInfo;
      }
      if (msg.kitReadReceiptInfo) {
        msg.kitReadReceiptInfo = undefined;
      }
      const sendData = this._emitBeforeSendMessage(conversation, new BaseMessage<any>(msg.messageType, msg.content, msg.isPersited, msg.isCounted));
      msg.content = sendData.message.content;
      msg.isPersited = sendData.message.isPersited;
      msg.isCounted = sendData.message.isCounted;
      messageOptionsMap.set(msg.transactionId, sendData.options);
      return msg;
    });

    const cache = this._getOrCreateCache(conversation, sentTime + 1, false, true);
    // 向后插入缓存队列
    this._push2Cache(cache, ...msgs);

    // 通知 UI 层更新消息列表
    this.ctx.dispatch(new RCKitEvent(InnerEvent.INSERT_NEW_MESSAGES, msgs));

    // 推送到消息发送队列
    const session = this._getUserCacheSession();
    msgs.forEach((msg) => this._push2SendQueue(conversation, msg, messageOptionsMap.get(msg.transactionId), session));
  }

  /**
   * 发送合并转发消息
   * @param conversation
   * @param messages
   */
  public async sendCombineMessage(conversation: IConversationIdentifier, messages: IRCKitCachedMessage[]): Promise<void> {
    if (messages.length === 0 || isInvalidConversation(conversation)) {
      return;
    }

    // 消息来源会话
    const { conversationType: fromConversationType, targetId: fromTargetId } = messages[0];

    const summaryList: string[] = [];
    const currentUserId = this.ctx.userId;
    const currentUsername = this.ctx.appData.getUserProfile(currentUserId)!.name;

    // 单聊合并转发，nameList 为己方与对方昵称，群聊为群组名称
    const nameList: string[] = [];

    if (fromConversationType === ConversationType.PRIVATE) {
      // 单聊场景 nameList 需要根据消息不同的 senderUserId 添加
      const selfIndex = messages.findIndex((item) => item.senderUserId === currentUserId);
      const otherIndex = messages.findIndex((item) => item.senderUserId !== currentUserId);
      if (selfIndex > -1) {
        nameList.push(currentUsername);
      }
      if (otherIndex > -1) {
        nameList.push(this.ctx.appData.getUserProfile(fromTargetId)!.name);
      }
    } else {
      nameList.push(this.ctx.appData.getGroupProfile(fromTargetId)!.name);
    }

    const msgList: ICombinedMessage[] = messages.map((message, index) => {
      // 复制消息内容，去掉 user、extra、mentionedInfo 等信息，避免修改原消息内容
      const content = cloneByJSON(message.content);
      delete content.user;
      delete content.extra;
      delete content.mentionedInfo;

      const {
        targetId, sentTime, messageType, senderUserId,
      } = message;

      // summary 信息记录
      if (index < 4) {
        const username = this.ctx.appData.getUserProfile(senderUserId)!.name;
        let desc: string = getMessageDesc(message);
        // 产品要求文件消息要带文件名
        if (messageType === MessageType.FILE) {
          const fileName = (message.content as IFileMessageContent).name;
          desc = `${desc}${fileName}`;
        }
        summaryList.push(`${username}: ${desc}`.substring(0, 1000));
      }

      return {
        targetId, timestamp: sentTime, objectName: messageType, content, fromUserId: senderUserId,
      };
    });

    const combineMsgContent: ICombineV2MessageContent = {
      summaryList,
      nameList,
      conversationType: fromConversationType,
      msgNum: msgList.length,
    };

    const jsonStr = JSON.stringify(msgList);
    if (jsonStr.length >= 120 * 1024) {
      // 发文件
      const jsonMsgKey = `${Date.now()}-${Math.floor(Math.random() * Date.now())}.json`;
      combineMsgContent.jsonMsgKey = jsonMsgKey;
      const file = new File([jsonStr], jsonMsgKey, { type: 'application/json' });
      this._sendMultiMediaMessage(async (file) => new CombineV2Message(combineMsgContent), conversation, [file]);
    } else {
      combineMsgContent.msgList = msgList;
      this.sendMessage(conversation, new CombineV2Message(combineMsgContent));
    }
  }

  private async _push2SendQueue(
    conversation: IConversationIdentifier,
    message: IRCKitCachedMessage,
    options?: ISendMessageOptions,
    session: IRCKitUserCacheSession = this._getUserCacheSession(),
  ) {
    if (!this._isCurrentUserCache(session)) {
      return;
    }

    const { code, data } = await this._sendQueue.push({
      conversation, message, options, transactionId: message.transactionId!, session,
    });

    if (!this._isCurrentUserCache(session)) {
      return;
    }

    if (code !== ErrorCode.SUCCESS) {
      message.sentStatus = SentStatus.FAILED;
    } else {
      const oldTime = message.sentTime;
      this._updateCachedMessage(message, data!);
      if (message.sentTime !== oldTime) {
        const cached = this._getExistCache(conversation);
        if (cached) {
          // 不使用全量排序，而是将消息从原位置移除并插入到正确的位置
          const index = cached.histories.findIndex((item) => item.transactionId === message.transactionId);
          if (index !== -1) {
            cached.histories.splice(index, 1);
            const insertIndex = findLastIndex(cached.histories, (item) => item.sentTime <= message.sentTime);
            cached.histories.splice(insertIndex + 1, 0, message);
          }
        }
      }
    }

    // 通知 UI 层更新消息列表
    this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [message]));
  }

  removeCachedMessages(conversation: IConversationIdentifier): void {
    const conversationKey = trans2ConversationKey(conversation);
    this._localMediaUrls.forEach((url, message) => {
      if (trans2ConversationKey(message) === conversationKey) this._releaseLocalMediaUrl(message);
    });
    this._getCachedMessages(conversation).forEach((message) => {
      const key = this._messageKey(conversation, message.messageUId);
      this._editAttempts.delete(key);
      this._quoteRounds.delete(key);
      delete message.editDraft;
      delete message.editStatus;
    });
    const cached = this.ctx.conversation.getCachedConversationByKey(trans2ConversationKey(conversation));
    if (cached) delete cached.updatingMessageUId;
    this._histories.delete(trans2ConversationKey(conversation));
    this._detachedMessages.delete(trans2ConversationKey(conversation));
  }

  /**
   * 取消消息上传与发送，同时删除本地消息缓存
   * @param message
   */
  cancelMessageSent(message: IRCKitCachedMessage): void {
    const {
      transactionId, conversationType, targetId, channelId,
    } = message;
    const conversation = { conversationType, targetId, channelId };
    const cached = this._getExistCache(conversation);
    if (!cached) {
      return;
    }

    const index = cached.histories.findIndex((item) => item.transactionId === transactionId);
    const cachedMessage = cached.histories[index];
    if (
      !cachedMessage // 缓存消息不存在
      || cachedMessage.sentStatus !== SentStatus.SENDING // 消息已发送成功或发送失败，不做处理
      || typeof cachedMessage.transactionId !== 'number' // 无 transactionId，不做处理
    ) {
      return;
    }

    // 删除本地缓存
    cached.histories.splice(index, 1);
    this._releaseLocalMediaUrl(cachedMessage);
    // 通知 UI 删除消息
    this.ctx.dispatch(new RCKitEvent(RCKitEvents.MESSAGES_DELETED, [{ target: message }]));

    // 从上传队列或发送队列中取消任务，由于任务不可能同时存在于两个队列中，因此进行 || 运算即可
    // eslint-disable-next-line no-unused-expressions
    this._uploadQueue.remove(transactionId!) || this._sendQueue.remove(transactionId!);
  }

  /**
   * 重发发送失败的消息
   * @param message
   */
  async resendMessage(message: IRCKitCachedMessage): Promise<void> {
    const session = this._getUserCacheSession();
    const {
      transactionId, conversationType, targetId, channelId,
    } = message;
    const conversation = { conversationType, targetId, channelId };
    const cached = this._getExistCache(conversation);
    if (!cached) {
      return;
    }

    const cachedMessage = cached.histories.find((item) => item.transactionId === transactionId);
    if (
      !cachedMessage // 缓存消息不存在
      || cachedMessage.sentStatus !== SentStatus.FAILED // 消息已发送成功或发送失败，不做处理
      || typeof transactionId !== 'number' // 无 transactionId，不做处理
    ) {
      return;
    }

    // 更新消息状态
    cachedMessage.sentStatus = SentStatus.SENDING;

    if (cachedMessage.file && cachedMessage.progress !== 100) {
      cachedMessage.progress = 0;
      // 派发时间更新 UI 状态
      this.ctx.emit(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [cachedMessage]));

      // 重新上传文件
      const { code, data } = await this._uploadQueue.push({ message: cachedMessage, transactionId, session });
      if (!this._isCurrentUserCache(session)) {
        return;
      }
      if (code !== ErrorCode.SUCCESS) {
        cachedMessage.sentStatus = SentStatus.FAILED;
        cachedMessage.progress = -1;
        // 派发时间更新 UI 状态
        this.ctx.emit(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [cachedMessage]));
        return;
      }

      cachedMessage.file = undefined;
      this._updateHttpUrl(cachedMessage, data!.httpUrl!);
    }

    const sendData = this._emitBeforeSendMessage(
      conversation,
      new BaseMessage<any>(cachedMessage.messageType, cachedMessage.content, cachedMessage.isPersited, cachedMessage.isCounted),
    );
    cachedMessage.content = sendData.message.content;
    cachedMessage.isPersited = sendData.message.isPersited;
    cachedMessage.isCounted = sendData.message.isCounted;

    // 推入发送队列
    this._push2SendQueue(cachedMessage, cachedMessage, sendData.options, session);
  }

  /**
   * 发送回执
   * @param conversation
   * @param list
   * @param isStart 是否要传 startMsgId（web平台在线收消息适用）
   * @returns
   */
  async sendReadReceiptMessage(conversation: IConversationIdentifier, list: IRCKitCachedMessage[]): Promise<void> {
    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      this._sendReadReceiptMessageV5(conversation, list);
    }
  }

  /**
   * 获取会话最后一条消息
   * @param conversation
   */
  getConversationLatestMessage(conversation: IConversationIdentifier): IRCKitCachedMessage | null {
    const cached = this._getExistCache(conversation);
    if (!cached) {
      return null;
    }
    const { length } = cached.histories;
    return cached.histories[length - 1];
  }

  /**
   * 获取消息已读未读用户列表（V5分页）
   * @param conversation 会话信息
   * @param messageUId 消息UId
   * @param option 分页选项
   */
  async getMessagesReadReceiptUsersByPageV5(
    conversation: IConversationIdentifier,
    messageUId: string,
    option: { pageToken?: string; count?: number; type?: 'read' | 'unread' },
  ): Promise<RCResult<any>> {
    // 该接口仅针对 v5，非 v5 版本直接返回，不请求接口
    if (this.ctx.readReceiptVersion !== GroupReadReceiptVersion.V5) {
      return { code: ErrorCode.SUCCESS, data: null } as RCResult<any>;
    }
    try {
      // readStatus: 0 表示获取已读列表，1 表示获取未读列表
      // type: 'read' -> readStatus: 0 (获取已读列表)
      // type: 'unread' -> readStatus: 1 (获取未读列表)
      const readStatus: 0 | 1 = option.type === 'read' ? 0 : 1;
      const receiptOption: ReadReceiptUsersOption = {
        pageToken: option.pageToken,
        pageCount: option.count || 20,
        readStatus,
        order: 0, // 按读取时间降序查询
      };
      const result = await getMessagesReadReceiptUsersByPageV5(conversation, messageUId, receiptOption);
      return result;
    } catch (e) {
      this.logger.warn(LogTag.L_GET_READ_RECEIPT_INFO_V5_E, `getMessagesReadReceiptUsersByPageV5 error: ${e}`);
      return { code: ErrorCode.SUCCESS, data: null } as RCResult<any>;
    }
  }

  /**
   * 检查并填充消息的 quoteInfo 数据，并在更新后派发事件通知 UI 层更新
   * @param conversation
   * @param messages
   */
  private _checkAndFillQuoteInfo(
    conversation: IConversationIdentifier,
    messages: IRCKitCachedMessage[],
    invalidate = false,
  ): void {
    const session = this._getUserCacheSession();
    const pending: { message: IRCKitCachedMessage, key: string, target: string,
      state: { token: object, generation: number, pending: boolean }, generation: number }[] = [];
    messages.forEach((item) => {
      const message = this.getCachedMessage(conversation, item.messageUId);
      if (!message?.quoteInfo) return;
      const unavailable = this._unavailableMessages.get(this._messageKey(conversation, message.quoteInfo.messageUId));
      if (unavailable) this._setQuoteUnavailable(message, unavailable);
      const key = this._messageKey(conversation, message.messageUId);
      const running = this._quoteRounds.get(key);
      if (running) {
        if (invalidate) { running.generation += 1; running.pending = true; }
        return;
      }
      const state = { token: {}, generation: 0, pending: false };
      this._quoteRounds.set(key, state);
      pending.push({
        message, key, state, generation: 0, target: message.quoteInfo.messageUId,
      });
    });
    const isCurrent = (entry: typeof pending[number]) => this._isCurrentUserCache(session)
      && this._quoteRounds.get(entry.key) === entry.state
      && entry.state.generation === entry.generation
      && this.getCachedMessage(conversation, entry.message.messageUId) === entry.message
      && entry.message.quoteInfo?.messageUId === entry.target;
    const finish = (batch: typeof pending) => {
      const again: IRCKitCachedMessage[] = [];
      batch.forEach((entry) => {
        if (this._quoteRounds.get(entry.key) !== entry.state) return;
        this._quoteRounds.delete(entry.key);
        if (entry.state.pending && this._isCurrentUserCache(session)) again.push(entry.message);
      });
      if (again.length) this._checkAndFillQuoteInfo(conversation, again);
    };
    const apply = (batch: typeof pending, results: IMessageResult[], v1: boolean) => {
      const changed: IRCKitCachedMessage[] = [];
      batch.forEach((entry) => {
        if (!isCurrent(entry)) return;
        const { message, target } = entry;
        const unavailable = this._unavailableMessages.get(this._messageKey(conversation, target));
        if (unavailable) {
          this._setQuoteUnavailable(message, unavailable);
          changed.push(message);
          return;
        }
        const initialLoadFailed = () => {
          if (!v1 && !message.quoteInfo!.quoteMessage
            && [RCKitQuoteMessageStatus.LOADING, RCKitQuoteMessageStatus.LOAD_ERROR].includes(message.quoteInfo!.status)) {
            message.quoteInfo!.status = RCKitQuoteMessageStatus.LOAD_ERROR;
            changed.push(message);
          }
        };
        const result = Array.isArray(results) ? results.find((item) => item?.messageUId === (v1 ? message.messageUId : target)) : undefined;
        if (result?.code === ErrorCode.SUCCESS && result.message) {
          if (v1) {
            const content = result.message.content as IReferenceMessageContent;
            if (!content || content.referMsgUid !== target || typeof content.referMsgStatus !== 'number'
              || ![ReferenceMessageStatus.DEFAULT, ReferenceMessageStatus.MODIFIED,
                ReferenceMessageStatus.DELETE, ReferenceMessageStatus.RECALLED].includes(content.referMsgStatus)) return;
            if ([ReferenceMessageStatus.DEFAULT, ReferenceMessageStatus.MODIFIED].includes(content.referMsgStatus)
              && (!content.referMsg || typeof content.referMsg !== 'object' || Array.isArray(content.referMsg)
                || ((message.content.objName === MessageType.TEXT || message.content.objName === MessageType.REFERENCE)
                  && typeof content.referMsg.content !== 'string'))) return;
            message.content = { ...message.content, referMsg: content.referMsg, referMsgStatus: content.referMsgStatus };
            message.quoteInfo = createRCKitQuoteInfoByReferenceMessageContent(
              message.content,
              message,
              message.quoteInfo!.quoteMessage?.messageDirection || MessageDirection.RECEIVE,
            );
          } else if (this._isRecallMessage(result.message)) {
            this._setQuoteUnavailable(message, RCKitQuoteMessageStatus.RECALLED);
          } else {
            const snapshot = result.message;
            if (snapshot.messageUId !== target || typeof snapshot.messageType !== 'string'
              || !snapshot.content || typeof snapshot.content !== 'object' || Array.isArray(snapshot.content)
              || ((snapshot.messageType === MessageType.TEXT || snapshot.messageType === MessageType.REFERENCE)
                && typeof snapshot.content.content !== 'string')) {
              initialLoadFailed();
              return;
            }
            const oldTimestamp = getSuccessfulEditTimestamp(message.quoteInfo!.quoteMessage || {}) || 0;
            if ((getSuccessfulEditTimestamp(result.message) || 0) < oldTimestamp) return;
            message.quoteInfo!.quoteMessage = result.message;
            message.quoteInfo!.status = RCKitQuoteMessageStatus.LOADED;
            message.quoteInfo!.isEdited = !!getSuccessfulEditTimestamp(result.message);
          }
          changed.push(message);
        } else if (result?.code === ErrorCode.RC_DB_DATA_NOT_FOUND) {
          this._setQuoteUnavailable(message, RCKitQuoteMessageStatus.DELETED);
          changed.push(message);
        } else initialLoadFailed();
      });
      this._emitMessageState(changed);
    };
    const v1 = pending.filter((entry) => entry.message.messageType === MessageType.REFERENCE);
    for (let i = 0; i < v1.length; i += 20) {
      const batch = v1.slice(i, i + 20);
      const round = createReferenceRefreshRound<IMessageResult>((results) => apply(batch, results, true), () => {
        this._cancelQuoteRounds.delete(round.cancel);
        finish(batch);
      });
      this._cancelQuoteRounds.add(round.cancel);
      const messageInfoMap: Record<string, string> = {};
      batch.forEach((entry) => { messageInfoMap[entry.message.messageUId] = entry.target; });
      try {
        refreshReferenceMessageWithParams({
          conversationIdentifier: conversation,
          messageUIds: batch.map((entry) => entry.message.messageUId),
          messageInfoMap,
          localMessageBlock: round.local,
          remoteMessageBlock: round.remote,
        }).then((result) => round.acknowledge(result.code === ErrorCode.SUCCESS), round.fail);
      } catch (error) { round.fail(); }
    }
    const v2 = pending.filter((entry) => entry.message.messageType !== MessageType.REFERENCE);
    const targets = [...new Set(v2.map((entry) => entry.target))];
    for (let i = 0; i < targets.length; i += 20) {
      const ids = targets.slice(i, i + 20);
      const batch = v2.filter((entry) => ids.includes(entry.target));
      Promise.resolve().then(async () => {
        if (!batch.some(isCurrent)) return null;
        return getMessagesByUIds({ conversationIdentifier: conversation, messageUIds: ids });
      })
        .then((result) => apply(batch, result?.isOk ? result.data || [] : [], false))
        .catch(() => apply(batch, [], false))
        .finally(() => finish(batch));
    }
  }

  private _checkAndFillReactions(
    conversation: IConversationIdentifier,
    messages: IRCKitCachedMessage[],
  ): void {
    if (!this.ctx.isMessageReactionEnabled) {
      // 功能未开，不处理
      return;
    }
    const validMessages = messages.filter((msg) => {
      const { hasReactions, reactions } = msg;
      if (!hasReactions || reactions.length > 0) {
        // 消息无回应信息，无需请求
        // 消息已经填充过回应信息，基于后续事件更新即可，无需再次请求
        return false;
      }
      return true;
    });
    if (validMessages.length === 0) {
      return;
    }

    this._batchGetMessageReactionsSummay(conversation, validMessages);
  }

  /**
   * 批量获取消息的回应信息，单次最多获取 100 条
   * @param conversation
   * @param messages
   * @returns
   */
  private async _batchGetMessageReactionsSummay(
    conversation: IConversationIdentifier,
    messages: IRCKitCachedMessage[],
  ): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    const list = messages.slice(0, 100);

    const res = await batchGetMessageReactionSummaries({
      conversationIdentifier: conversation,
      messageUIds: list.map((item) => item.messageUId),
    });

    if (res.isOk) {
      const crtUserId = this.ctx.userId;
      list.forEach((item) => {
        const reactions = res.data![item.messageUId] || [];
        const list = reactions.map((item) => trans2IRCKitMessageReaction(item, crtUserId));
        item.reactions = list;
      });

      this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, list));
    }
    return this._batchGetMessageReactionsSummay(conversation, messages.slice(100));
  }

  public async updateMessageReaction(
    message: IRCKitCachedMessage,
    reactionId: string,
    isDelete: boolean,
  ): Promise<void> {
    if (message.sentStatus !== SentStatus.SENT) {
      // 未发送成功的消息不允许添加或删除回应
      return;
    }

    const conversationIdentifier: IConversationIdentifier = {
      conversationType: message.conversationType,
      targetId: message.targetId,
      channelId: message.channelId,
    };
    const { messageUId } = message;
    const param: IUpdateMessageReactionParam = {
      conversationIdentifier,
      messageUId,
      reactionId,
    };
    const { code, isOk } = await (isDelete ? removeMessageReaction(param) : addMessageReaction(param));
    if (!isOk) {
      // 产品定义：只有添加回应时超出上限做单独提示，其他统一提示回应失败
      const key: keyof IRCKitLanguageEntries = !isDelete && (code === 26323 || code === 26324)
        ? 'alert.reaction.limit.reached'
        : 'alert.reaction.failed';
      this.ctx.alert(key);
      return;
    }

    // 根据本地数据创造一个 evt 数据，更新消息列表
    const reaction: IRCKitMessageReaction | undefined = message.reactions.find((item) => item.reactionId === reactionId);
    const totalCount = Math.max((reaction?.totalCount || 0) + (isDelete ? -1 : 1), 0);
    const data: IMessageReactionEventData = {
      messageUId,
      reactionId,
      operationType: isDelete ? MessageReactionOperationType.REMOVED : MessageReactionOperationType.ADDED,
      conversationIdentifier,
      totalCount,
      users: [{ userId: this.ctx.userId, reactionTime: Date.now() }],
    };
    this._onMessageReactionChanged({ reactions: [data] });
  }
}
