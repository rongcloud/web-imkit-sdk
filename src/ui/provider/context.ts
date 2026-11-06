import {
  ConversationType,
  IConversationOption,
  SentStatus,
  MessageType,
  IInformationNotificationMessageContent,
  getCurrentUserId, RCConnectionStatus,
} from '@rongcloud/imlib-next';
import { ErrorCode, ILogger } from '@rongcloud/engine';
import {
  computed, provide, reactive, readonly, Ref, ref,
} from 'vue';
import { IRCKitCachedConversation } from '@lib/modules/conversation/IRCKitCachedConversation';
import { isSameConversation } from '@lib/helper';
import { createAuthorizedDownloadMessage } from '@lib/helper/download';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import {
  ConnectionStatusChangeEvent, ConversationSelectedEvent, DeleteMessageModalEvent, EventDefined, ForwardingEvent, InnerEvent, RCKitEvents, RCKitModalBtnType, RCKitModalForwardingType,
} from '@lib/core/EventDefined';
import { RCKIT_ENV_KEYS } from '@lib/constants';
import { IRCKitGroupMemberProfile } from '@lib/modules/appdata/GroupCache';
import { ICacheUserProfile } from '@lib/modules/appdata/UserCache';
import { RCKitContext } from '../../core/RCKitContext';
import { IRCKitCachedMessage as IAReceivedMessage, IRCKitCachedMessage } from '../../modules/MessageDataModule';
import { IRCKitLanguageEntries } from '../../languages';
import {
  $has, $t, $tt, lang,
} from '../i18n-vue';
import { InnerComponentTag } from '../component';
import { InnerProviderTag } from '.';
import { RCKitCommand } from '../../enums/RCKitCommand';
import { IRCKitReplyPreviewBarComponentProps } from '../override-able';
import {
  resolveCustomMessageBubbleContentLayout,
  MessageBubbleContentLayout,
} from '../message-bubble-layout';
import { resetUserCacheState } from './user-cache-state';
import { resolveUserDisplayName } from '../../helper/user-display-name';
import { RCKitQuoteMessageStatus } from '../../enums/RCKitQuoteMessageStatus';

let _logger: ILogger | null = null;
let _ctx: RCKitContext | null = null;
let _overrideAbleComponentTags: Record<string, string> = {};
let _providerContextOwner: RCKitContext | null = null;
const _providerContextDisposers: Array<() => void> = [];
type ModalCancel = () => void;
const _activeModalElements = new Map<HTMLElement, ModalCancel | undefined>();

const addProviderContextListener = <K extends keyof EventDefined>(
  context: RCKitContext,
  type: K,
  listener: (event: EventDefined[K]) => void,
): void => {
  context.addEventListener(type, listener);
  // 保存注册时的函数引用，销毁时才能精确移除匿名回调并避免旧实例继续响应事件。
  _providerContextDisposers.push(() => context.removeEventListener(type, listener));
};

export const setOverrideAbleComponentTags = (tags: Record<string, string>): void => {
  _overrideAbleComponentTags = { ...tags };
};

export const getOverrideAbleComponentTag = (originTag: string): string => _overrideAbleComponentTags[originTag] || originTag;

const currentUserId = ref<string>('');
/**
 * 在两个核心顶级组件中向注入环境变量
 */
export const setEnvInfo = () => {
  // 将环境变量 CURRENT_USER_ID 改为响应式数据，用户切换能进行更新
  currentUserId.value = ctx().userId;
  provide(RCKIT_ENV_KEYS.CURRENT_USER_ID, currentUserId);
  provide(RCKIT_ENV_KEYS.LANGUAGE, readonly(lang));
};
/**
 * 是否开启会话栏
 */
export const showConversationBar = ref(true);

/**
 * 是否开启会话详情返回按钮
 */
export const showConversationDetailBack = ref(true);

/**
 * 会话栏标题
 */
export const conversationBarTitle = ref<string | undefined>(undefined);

/**
 * 已打开的会话
 */
export const openedConversation = ref<IRCKitCachedConversation | null>(null);
/**
 * 编辑框的 DOM 元素，草稿和重新编辑功能需要对编辑框的内容进行获取或者设置
 */
export const textarea = ref();
/**
 * Bottom 定位组件未读数
 */
export const unreadCountBottom = ref<number>(0);

const syncOpenedConversation = (conversation: IRCKitCachedConversation): void => {
  if (openedConversation.value && isSameConversation(conversation, openedConversation.value)) {
    openedConversation.value = { ...openedConversation.value, ...conversation };
    unreadCountBottom.value = conversation.unreadCount;
  }
};

type UserViewInfo = {
  name: string
  userId: string
  portraitUri: string
  nickname?: string
}

/**
 * 选中的群组会话的成员列表
 * @description - 该列表数据不包含当前登录用户
 */
export const selectedGroupMembers: Ref<Array<UserViewInfo>> = ref([]);

/**
 * selectedGroupMembers 供 @ 面板等需要完整列表的组件使用；该索引供消息列表等高频路径按 ID 查询。
 * 两者共享成员对象，并在当前会话的群成员发生变化时一起重建。
 */
const selectedGroupMembersById = reactive(new Map<string, UserViewInfo>());

export const getSelectedGroupMember = (userId: string): UserViewInfo | undefined => (
  selectedGroupMembersById.get(userId)
);

/** 群成员资料版本，用于通知依赖群昵称的展示组件刷新。 */
export const selectedGroupMembersVersion = ref(0);

/**
 * 当前用户配置信息
 */
export const currentUserProfile = ref<UserViewInfo>();

const _onConnectionStatusChange = async (e: ConnectionStatusChangeEvent) => {
  const { status } = e.data;
  if (status === RCConnectionStatus.CONNECTED) {
    const userId = getCurrentUserId();
    const user = ctx().appData.getUserProfile(userId);
    currentUserProfile.value = user;
  }
};

const _onConversationSelected = async (evt: ConversationSelectedEvent) => {
  const context = ctx();
  const conversation = evt.data?.conversation;
  // 更新缓存
  openedConversation.value = conversation || null;
  unreadCountBottom.value = conversation?.unreadCount || 0;
  // 索引只属于当前打开的群，切换会话时必须同步清理，避免异步渲染读取上个群的数据。
  selectedGroupMembers.value.length = 0;
  selectedGroupMembersById.clear();
  selectedGroupMembersVersion.value += 1;

  // 切换会话时停止音频播放
  context.audioPlayer.pause();

  if (!conversation) {
    return;
  }

  // 更新群成员列表数据
  const { conversationType, targetId } = conversation;
  if (conversationType !== ConversationType.GROUP) {
    return;
  }

  // 获取群组成员列表
  const mems = await context.appData.reqGroupMembers(targetId);
  if (_providerContextOwner !== context || mems.length === 0) {
    return;
  }

  const users = await context.appData.requestUserProfiles(mems.map((item) => item.userId));
  if (
    _providerContextOwner !== context
    || !openedConversation.value
    || !isSameConversation(conversation, openedConversation.value)
  ) {
    // 数据请求是异步的，需要在数据获取后判断是否重新切换了会话
    return;
  }

  // 更新群成员信息
  updateSelectedGroupMembers(users, mems);
};

/**
 * 聚合更新群成员数据和人员数据
 */
const updateSelectedGroupMembers = (
  users: ICacheUserProfile[],
  members: IRCKitGroupMemberProfile[],
): void => {
  // 先建立昵称索引，避免为每个用户重新遍历一次完整群成员列表。
  const membersById = new Map(members.map((item) => [item.userId, item]));
  const newMembers: Array<UserViewInfo> = users
    .filter((item) => item.userId !== ctx().userId)
    .map<UserViewInfo>((item) => ({
      ...item,
      nickname: membersById.get(item.userId)?.nickname,
    }));

  // 数组与索引引用同一批成员对象，后续用户资料回填可同时更新列表和按 ID 查询结果。
  selectedGroupMembersById.clear();
  newMembers.forEach((item) => selectedGroupMembersById.set(item.userId, item));
  selectedGroupMembers.value.splice(0, selectedGroupMembers.value.length, ...newMembers);
  selectedGroupMembersVersion.value += 1;
};

/** 获取当前群聊中用户的显示名称，当前用户不使用群昵称。 */
export const getGroupMemberDisplayName = (userId: string): string => {
  const context = ctx();
  const profile = context.appData.getUserProfile(userId);
  if (userId === context.userId) {
    return profile.name || userId;
  }
  return resolveUserDisplayName(getSelectedGroupMember(userId) || profile, userId);
};

/**
 * 重置 UIModule 数据
 */
const resetProviderState = (): void => {
  conversationListGeneration += 1;
  conversationListHasMore.value = false;
  loadingMoreConversations = false;
  sttStatusMap.value = {};
  sttTextMap.value = {};
  sttHiddenMap.value = {};
  sttErrorCodeMap.value = {};
  resetUserCacheState({
    openedConversation,
    conversationList,
    messageList,
    textarea,
    unreadCountBottom,
    selectedGroupMembers,
    currentUserProfile,
    replyMessage,
  });
  selectedGroupMembersById.clear();
  selectedGroupMembersVersion.value += 1;
};

export const destroyUserCache = (): void => {
  resetProviderState();
  // 更新环境变量 userId
  currentUserId.value = ctx().userId;
};

export function destroyProviderContext(context: RCKitContext): void {
  if (_providerContextOwner !== context) {
    return;
  }

  // 逆序释放本实例注册的监听，避免旧 Context 在重新初始化后继续更新全局 Provider 状态。
  _providerContextDisposers.splice(0).reverse().forEach((dispose) => dispose());
  _activeModalElements.forEach((cancel, element) => {
    cancel?.();
    element.remove();
  });
  _activeModalElements.clear();
  resetProviderState();
  currentUserId.value = '';
  showConversationBar.value = true;
  showConversationDetailBack.value = true;
  conversationBarTitle.value = undefined;
  _overrideAbleComponentTags = {};
  _providerContextOwner = null;
  _ctx = null;
  _logger = null;
}

export function initProviderContext(context: RCKitContext): void {
  if (_providerContextOwner) {
    // Provider 状态是模块级单例；新实例接管前先释放旧实例绑定。
    destroyProviderContext(_providerContextOwner);
  }

  _ctx = context;
  _logger = context.logger;
  _providerContextOwner = context;
  _overrideAbleComponentTags = {};
  conversationList.value = context.conversation.getCachedConversationList();
  conversationListHasMore.value = conversationList.value.length >= 30;

  addProviderContextListener(context, RCKitEvents.CONVERSATION_SELECTED, _onConversationSelected);
  // 会话列表还供转发弹窗使用，数据和未读数同步不能依赖 H5 会话列表是否挂载。
  addProviderContextListener(context, InnerEvent.CONVERSATION_LIST_RESET, (e) => {
    conversationListGeneration += 1;
    loadingMoreConversations = false;
    conversationList.value.splice(0, conversationList.value.length, ...e.data);
    conversationListHasMore.value = e.data.length >= 30;
    e.data.forEach(syncOpenedConversation);
  });
  addProviderContextListener(context, InnerEvent.CONVERSATION_ITEM_ORDER_CHANGE, (e) => {
    e.data.forEach(({ conversation, order }) => {
      const index = conversationList.value.findIndex((item) => isSameConversation(item, conversation));
      if (index !== -1) {
        conversationList.value.splice(index, 1);
      }
      conversationList.value.splice(order, 0, JSON.parse(JSON.stringify(conversation)));
      syncOpenedConversation(conversation);
    });
  });
  addProviderContextListener(context, InnerEvent.CONVERSATION_ITEM_CHANGE, (e) => {
    e.data.forEach((conversation) => {
      const index = conversationList.value.findIndex((item) => isSameConversation(item, conversation));
      if (index !== -1) {
        conversationList.value.splice(index, 1, JSON.parse(JSON.stringify(conversation)));
      }
      syncOpenedConversation(conversation);
    });
  });
  addProviderContextListener(context, InnerEvent.CONVERSATIN_ITEM_REMOVE, (e) => {
    e.data.forEach((conversation) => {
      const index = conversationList.value.findIndex((item) => isSameConversation(item, conversation));
      if (index !== -1) {
        conversationList.value.splice(index, 1);
      }
    });
  });
  addProviderContextListener(context, InnerEvent.SPEECH_TO_TEXT_STATE_CHANGE, (e) => {
    const {
      messageUId, status, text, errorCode,
    } = e.data;
    if (sttHiddenMap.value[messageUId]) return;
    sttStatusMap.value[messageUId] = status;
    if (errorCode !== undefined) {
      sttErrorCodeMap.value[messageUId] = errorCode;
    } else {
      delete sttErrorCodeMap.value[messageUId];
    }
    if (status === 'success') {
      sttTextMap.value[messageUId] = text || '';
    }
  });
  // 获取当前连接成功的用户信息
  addProviderContextListener(context, InnerEvent.CONNECTION_STATUS_CHANGE, _onConnectionStatusChange);
  // 切换用户登入，重置数据
  addProviderContextListener(context, InnerEvent.DESTROY_USER_CACHE, destroyUserCache);
  // 监听会话栏开关变更事件
  addProviderContextListener(context, InnerEvent.CONVERSATION_BAR_SWITCH_CHANGE, (e) => {
    showConversationBar.value = e.data;
  });
  // 监听会话详情返回按钮开关变更事件
  addProviderContextListener(context, InnerEvent.CONVERSATION_DETAIL_BACK_SWITCH_CHANGE, (e) => {
    showConversationDetailBack.value = e.data;
  });
  // 监听会话栏标题变更事件
  addProviderContextListener(context, InnerEvent.CONVERSATION_BAR_TITLE_CHANGE, (e) => {
    conversationBarTitle.value = e.data;
  });
  // 监听用户数据变更，更新当前登录用户缓存数据
  addProviderContextListener(context, InnerEvent.USER_PROFILES_UPDATE, (evt) => {
    const crtUserId = currentUserId.value;
    const data = evt.data.find((value) => value.userId === crtUserId);
    if (data) {
      currentUserProfile.value = data;
    }
  });

  initModalListener(context);
}

export const ctx = (): RCKitContext => {
  if (!_ctx) {
    throw new Error('Provider context is not initialized.');
  }
  return _ctx;
};

export const logger = (): ILogger => {
  if (!_logger) {
    throw new Error('Provider logger is not initialized.');
  }
  return _logger;
};

/**
 * 会话列表数据
 */
export const conversationList = ref<IRCKitCachedConversation[]>([]);
export const conversationListHasMore = ref(false);
let conversationListGeneration = 0;
let loadingMoreConversations = false;

export const loadMoreConversations = async (): Promise<void> => {
  if (!conversationListHasMore.value || loadingMoreConversations) return;
  const context = ctx();
  const generation = conversationListGeneration;
  const lastConversation = conversationList.value[conversationList.value.length - 1] || null;
  loadingMoreConversations = true;
  try {
    const { hasMore, code, list } = await context.conversation.getMoreConversationList(lastConversation);
    if (_providerContextOwner !== context || generation !== conversationListGeneration) return;
    if (code === ErrorCode.SUCCESS) {
      const additions = list.filter((item) => !conversationList.value.some((current) => isSameConversation(item, current)));
      conversationList.value.push(...additions);
      conversationListHasMore.value = hasMore;
    }
  } finally {
    if (_providerContextOwner === context && generation === conversationListGeneration) {
      loadingMoreConversations = false;
    }
  }
};

// 语音转换 UI 状态在同一用户会话期间保留，不随 H5 消息列表卸载丢失。
export const sttStatusMap = ref<Record<string, 'converting' | 'success' | 'error'>>({});
export const sttTextMap = ref<Record<string, string>>({});
export const sttHiddenMap = ref<Record<string, boolean>>({});
export const sttErrorCodeMap = ref<Record<string, ErrorCode>>({});

/**
 * 消息列表数据
 */
export const messageList = ref<IAReceivedMessage[]>([]);

/**
 * 被回复的消息
 */
export const replyMessage = ref<IAReceivedMessage | null>(null);

let replyMessageSelectionId = 0;

/** 回复目标的内容刷新沿用选择序号；用户每次选择回复都创建新的操作。 */
export const selectReplyMessage = (message: IAReceivedMessage): void => {
  replyMessageSelectionId += 1;
  replyMessage.value = message;
};

export const getReplyMessageSelectionId = (): number => replyMessageSelectionId;

/**
 * 获取消息描述，若为文本消息，则直接返回文本内容，否则返回消息类型的简短描述
 * @param message
 * @returns
 */
export const getMessageDesc = (message: IAReceivedMessage): string => {
  const { messageType } = message;
  if (messageType === MessageType.TextMessage || messageType === MessageType.REFERENCE) {
    return message.content.content;
  }

  let key = `message-type.${messageType}` as keyof IRCKitLanguageEntries;
  if ($has(key)) {
    return $t(key).value;
  }
  // 自定义消息使用 disget 数据
  return getMessageDigest(message);
};

export const replyBarProps = computed(() => {
  if (!replyMessage.value) {
    return null;
  }

  const message = replyMessage.value;
  const { messageType, content } = message;

  let previewText = getMessageDesc(message);
  if (messageType === MessageType.FILE) {
    previewText += ` ${content.name}`;
  }

  let thumbnail: string | undefined;
  if (messageType === MessageType.IMAGE || messageType === MessageType.SIGHT) {
    thumbnail = `data:image/png;base64,${content.content}`;
  }

  const username = openedConversation.value?.conversationType === ConversationType.GROUP
    ? getGroupMemberDisplayName(replyMessage.value.senderUserId)
    : ctx().appData.getUserProfile(replyMessage.value.senderUserId).name;

  const propsValue: IRCKitReplyPreviewBarComponentProps = reactive({
    previewText,
    thumbnail,
    username,
    message,
    cancel() {
      replyMessage.value = null;
    },
  });
  return propsValue;
});

const removeModalElement = (element: HTMLElement): void => {
  _activeModalElements.delete(element);
  element.remove();
};

const appendChild = (ctx: RCKitContext, ele: HTMLElement, cancel?: () => void) => {
  let elementParent = document.body;
  if (ctx.modalContainerId && document.getElementById(ctx.modalContainerId)) {
    elementParent = document.getElementById(ctx.modalContainerId)!;
  }
  _activeModalElements.set(ele, cancel);
  elementParent.appendChild(ele);
};
/**
 * 注册弹框事件监听
 * @param ctx
 */
export const initModalListener = (ctx: RCKitContext): void => {
  addProviderContextListener(ctx, RCKitEvents.CONFIRM_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_CONFIRM_PROVIDER);
    // 挂载前传入正文，不依赖组件在当前事件派发过程中新增监听器。
    element.setAttribute('content', e.data);
    element.addEventListener('cancel', () => {
      e.sendResult(false);
      removeModalElement(element);
    });
    element.addEventListener('confirm', () => {
      e.sendResult(true);
      removeModalElement(element);
    });

    appendChild(ctx, element, () => e.sendResult(false));
  });

  addProviderContextListener(ctx, RCKitEvents.ALERT_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_ALERT_PROVIDER);
    element.setAttribute('content', e.data);
    element.addEventListener('cancel', (event) => {
      removeModalElement(element);
    });

    appendChild(ctx, element);
  });

  addProviderContextListener(ctx, RCKitEvents.FORWARDING_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_FORWARDING_PROVIDER);
    element.addEventListener('cancel', () => {
      e.sendResult({ type: RCKitModalBtnType.CANCEL });
      removeModalElement(element);
    });
    element.addEventListener('confirm', (event: any) => {
      e.sendResult({ type: RCKitModalBtnType.CONFIRM, list: event.detail[0].list });
      removeModalElement(element);
    });
    appendChild(ctx, element, () => e.sendResult({ type: RCKitModalBtnType.CANCEL }));
  });

  addProviderContextListener(ctx, RCKitEvents.DELETE_MESSAGE_MODAL_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_DELETE_MESSAGE_PROVIDER);
    element.addEventListener('cancel', () => {
      e.sendResult({ type: RCKitModalBtnType.CANCEL });
      removeModalElement(element);
    });
    element.addEventListener('confirm', (event: any) => {
      e.sendResult({ type: RCKitModalBtnType.CONFIRM });
      removeModalElement(element);
    });
    appendChild(ctx, element, () => e.sendResult({ type: RCKitModalBtnType.CANCEL }));
  });

  addProviderContextListener(ctx, RCKitEvents.MEDIA_MESSAGE_MODAL_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_MEDIA_MESSAGE_PROVIDER);
    element.addEventListener('cancel', (event) => {
      removeModalElement(element);
    });
    element.addEventListener('download', async () => {
      const message = await createAuthorizedDownloadMessage(e.data);
      if (message) {
        ctx.emit(new RCKitEvent(RCKitEvents.DOWNLOAD_LINK_EVENT, message));
      }
    });
    const url = e.data.content?.sightUrl || e.data.content?.imageUri || e.data.content?.remoteUrl || e.data.content?.fileUrl;
    element.setAttribute('url', url);
    element.setAttribute('user-id', e.data.senderUserId);
    element.setAttribute('sent-time', `${e.data.sentTime}`);
    element.setAttribute('message-type', `${e.data.messageType}`);
    element.setAttribute('message-uid', `${e.data.messageUId}`);
    element.setAttribute('content', `${e.data.content.content}`);
    appendChild(ctx, element);
  });

  addProviderContextListener(ctx, RCKitEvents.COMBINE_MESSAGE_MODAL_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_COMBINE_MESSAGE_PROVIDER);
    element.addEventListener('cancel', (event: any) => {
      ctx.audioPlayer.pause();
      removeModalElement(element);
    });
    element.addEventListener('download', async (event: any) => {
      const message = await createAuthorizedDownloadMessage(event.detail[0]);
      if (message) {
        ctx.emit(new RCKitEvent(RCKitEvents.DOWNLOAD_LINK_EVENT, message));
      }
    });
    const url = e.data.content.remoteUrl || '';
    element.setAttribute('url', url);
    const content = e.data.content || {};
    const type = e.data.messageType || MessageType.COMBINE_V2;
    element.setAttribute('content', JSON.stringify(content));
    element.setAttribute('type', type);
    element.setAttribute('message-uid', `${e.data.messageUId}`);
    appendChild(ctx, element);
  });

  addProviderContextListener(ctx, RCKitEvents.TAKE_PHOTO_MODAL_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_TAKE_PHOTO_PROVIDER);
    // 取消
    element.addEventListener('cancel', (event: any) => {
      removeModalElement(element);
    });
    appendChild(ctx, element);
  });

  addProviderContextListener(ctx, RCKitEvents.REACTIONS_DETAIL_EVENT, (e) => {
    const element: HTMLElement = document.createElement(InnerProviderTag.MODAL_REACTIONS_DETAIL_PROVIDER);
    element.addEventListener('cancel', () => {
      removeModalElement(element);
    });
    element.setAttribute('message-uid', e.data.message.messageUId);
    element.setAttribute('initial-reaction-id', e.data.reactionId);
    element.setAttribute('reactions', JSON.stringify(e.data.message.reactions));
    appendChild(ctx, element);
  });

  // 文本消息中邮箱和链接事件通知
  addProviderContextListener(ctx, RCKitEvents.MESSAGE_LINK_CLICK, (e) => {
    if (e.data.type === 'mail') {
      location.href = `mailto:${e.data.address}`;
      return;
    }
    window.open(e.data.address);
  });

  addProviderContextListener(ctx, InnerEvent.GROUP_MEMBERS_UPDATE, async (e) => {
    if (!openedConversation.value) {
      return;
    }

    const { groupId, members } = e.data;

    const { conversationType, targetId } = openedConversation.value;
    if (conversationType !== ConversationType.GROUP || targetId !== e.data.groupId) {
      return;
    }

    // 更新群成员列表数据
    const users = await ctx.appData.requestUserProfiles(members.map((item) => item.userId));
    if (
      _providerContextOwner !== ctx
      || !openedConversation.value
      || openedConversation.value.conversationType !== ConversationType.GROUP
      || openedConversation.value.targetId !== groupId
    ) {
      // 数据请求是异步的，需要在数据获取后判断是否重新切换了会话
      return;
    }

    // 更新群成员信息
    updateSelectedGroupMembers(users, members);
  });

  addProviderContextListener(ctx, InnerEvent.USER_PROFILES_UPDATE, (e) => {
    if (openedConversation.value?.conversationType !== ConversationType.GROUP) {
      return;
    }

    // selectedGroupMembers 保存的是用户缓存的快照，需要主动同步后续资料更新。
    let changed = false;
    e.data.forEach((profile) => {
      const member = getSelectedGroupMember(profile.userId);
      if (!member) {
        return;
      }
      member.name = profile.name;
      member.portraitUri = profile.portraitUri;
      changed = true;
    });
    if (changed) {
      selectedGroupMembersVersion.value += 1;
    }
  });
};

interface IMessageComponentDefinition {
  tag: string;
  bubbleContentLayout: MessageBubbleContentLayout;
}

const createMessageComponentDefinition = (
  tag: string,
  bubbleContentLayout: MessageBubbleContentLayout = MessageBubbleContentLayout.STANDARD,
): IMessageComponentDefinition => ({ tag, bubbleContentLayout });

const messageComponentDefinitions: Record<string, IMessageComponentDefinition> = {
  [MessageType.TEXT]: createMessageComponentDefinition(InnerComponentTag.TEXT_MESSAGE),
  [MessageType.IMAGE]: createMessageComponentDefinition(
    InnerComponentTag.IMAGE_MESSAGE,
    MessageBubbleContentLayout.ADAPTIVE,
  ),
  [MessageType.SIGHT]: createMessageComponentDefinition(
    InnerComponentTag.SIGHT_MESSAGE,
    MessageBubbleContentLayout.ADAPTIVE,
  ),
  [MessageType.FILE]: createMessageComponentDefinition(InnerComponentTag.FILE_MESSAGE),
  [MessageType.REFERENCE]: createMessageComponentDefinition(InnerComponentTag.REFERENCE_MESSAGE),
  [MessageType.COMBINE]: createMessageComponentDefinition(InnerComponentTag.COMBINE_V2_MESSAGE),
  [MessageType.COMBINE_V2]: createMessageComponentDefinition(InnerComponentTag.COMBINE_V2_MESSAGE),
  [MessageType.HQ_VOICE]: createMessageComponentDefinition(InnerProviderTag.HQ_VOICE_MESSAGE_PROVIDER),
  [MessageType.GIF]: createMessageComponentDefinition(
    InnerComponentTag.GIF_MESSAGE,
    MessageBubbleContentLayout.ADAPTIVE,
  ),
};

const customMessageDigestHandlers: Map<string, (message: IAReceivedMessage, language: string) => string> = new Map();

/**
 * 设置自定义消息的内容摘要计算函数
 * @param messageType - 消息类型
 * @param getContent - 获取灰条消息内容的钩子函数，用于消息列表内容展示
 * @param digest - 获取灰条消息摘要的钩子函数，用于会话最后一条消息展示
 */
export const setCustomMessageDigestHandler = (
  messageType: string,
  digest: (message: IAReceivedMessage, language: string) => string,
) => {
  customMessageDigestHandlers.set(messageType, digest);
};

// 注册撤回消息为小灰条
setCustomMessageDigestHandler(MessageType.RECALL, (message) => {
  const context = ctx();
  if (message.senderUserId === context.userId) {
    return $tt('message.list.recall.by.self');
  }
  const { name } = context.appData.getUserProfile(message.senderUserId);
  return $tt('message.list.recall.by.other', name);
});

setCustomMessageDigestHandler(MessageType.RECALL_NOTIFICATION_MESSAGE, (message) => {
  const context = ctx();
  if (message.senderUserId === context.userId) {
    return $tt('message.list.recall.by.self');
  }
  const { name } = context.appData.getUserProfile(message.senderUserId);
  return $tt('message.list.recall.by.other', name);
});

setCustomMessageDigestHandler(MessageType.INFORMATION_NOTIFICATION, (message) => (message.content as IInformationNotificationMessageContent).message);

// 产品明确不内置支持，由业务层自行注册实现
// setCustomMessageDigestHandler(MessageType.GROUP_NOTIFICATION, (message) => {
//   return (message.content as IGroupNotificationMessageContent).message;
// })

/**
 * 注册消息渲染组件标签
 * @param messageType
 * @param tag
 */
export const regMessageTypeComponentTag = (
  messageType: string,
  tag: string,
  disableDefaultBubblePadding = false,
) => {
  messageComponentDefinitions[messageType] = createMessageComponentDefinition(
    tag,
    resolveCustomMessageBubbleContentLayout(disableDefaultBubblePadding),
  );
};

export const getMessageComponentTag = (messageType: string): string => messageComponentDefinitions[messageType]?.tag || 'rc-unsupported-message';

export const getMessageBubbleContentLayout = (
  messageType: string,
): MessageBubbleContentLayout => messageComponentDefinitions[messageType]?.bubbleContentLayout
    || MessageBubbleContentLayout.STANDARD;

/**
 * 检测消息是否为灰条消息
 * @param messageType
 * @returns
 */
export const isGreyMessage = (messageType: string): boolean => !messageComponentDefinitions[messageType];

/**
 * 消息转发
 * @description 该方法会弹窗确认框，并根据用户选择行为执行转发操作
 * @param forwardType - 转发类型
 * @returns - boolean 值，`true` 表示已发起转发，`false` 表示已取消或源消息失效
 */
export const forwarding = async (forwardType: RCKitModalForwardingType, messages: IAReceivedMessage[]): Promise<boolean> => {
  if (messages.length === 0) return false;
  const context = ctx();
  const { userId, userCacheGeneration } = context;
  // 弹窗确认
  const evt: ForwardingEvent = new RCKitEvent(RCKitEvents.FORWARDING_EVENT, forwardType);
  context.emit(evt);
  const { type, list } = await evt.awaitResult();
  if (
    _providerContextOwner !== context
    || context.userId !== userId
    || context.userCacheGeneration !== userCacheGeneration
    || type === RCKitModalBtnType.CANCEL
    || !(list instanceof Array)
    || list.length === 0
  ) {
    // 用户取消或其他返回值异常
    // TODO: 该事件会被业务层捕获，因此需对数据进行校验
    return false;
  }

  // 弹层打开期间缓存可能已被撤回记录替换，不能仅检查打开前的消息对象。
  const unavailable = messages.map((message) => context.message.getMessageUnavailableStatus(message))
    .find((status) => status !== undefined);
  if (unavailable !== undefined) {
    context.alert(unavailable === RCKitQuoteMessageStatus.RECALLED ? 'alert.message-recalled' : 'alert.message-deleted');
    return false;
  }

  const conversationList = list.map((item) => ({
    conversationType: item.conversationType,
    targetId: item.targetId,
    channelId: item.channelId,
  }));

  if (forwardType === RCKitModalForwardingType.SINGLE) {
    // 逐条转发
    conversationList.forEach((item) => context.message.forward(item, messages.slice()));
  } else {
    // 合并转发
    conversationList.forEach((item) => context.message.sendCombineMessage(item, messages.slice()));
  }

  // 合并转发
  return true;
};
export const handleDeleteMessage = async (messages: IAReceivedMessage[]): Promise<boolean> => {
  if (messages.length === 0) {
    return false;
  }

  // 所有消息必然属于同一会话，因此取第一条消息作为会话参数即可
  const conversation: IConversationOption = messages[0];
  // 只有己方发送的消息（不是发送中, 发送失败）可撤回
  // 弹窗确认弹窗，允许业务层自定义弹窗
  const context = ctx();
  const evt: DeleteMessageModalEvent = new RCKitEvent(RCKitEvents.DELETE_MESSAGE_MODAL_EVENT, { messages });
  context.emit(evt);
  const { type } = await evt.awaitResult();

  if (_providerContextOwner !== context || type === RCKitModalBtnType.CANCEL) {
    // 取消删除
    return false;
  }

  // 批量删除
  context.message.deleteMessages(conversation, messages, false);
  return true;
};

export const handleRecallMessage = async (messages: IAReceivedMessage[]) => {
  if (messages.length === 0) {
    return;
  }

  const conversation: IConversationOption = {
    conversationType: messages[0].conversationType,
    targetId: messages[0].targetId,
    channelId: messages[0].channelId,
  };
  ctx().message.deleteMessages(conversation, messages, true);
};
/**
 * 判断消息状态是否显示
 * 1. 消息不存在不显示
 * 2. 非己方发送的消息不显示
 * 3. 消息类型为撤回消息不显示
 * @param msg
 * @returns
 */
export const handleShowSentStatus = (msg: IRCKitCachedMessage | null): boolean => {
  if (!msg) return false;
  if (msg.messageType === MessageType.RECALL || msg.messageType === MessageType.RECALL_NOTIFICATION_MESSAGE) return false;

  const context = ctx();
  const isSelf = msg.senderUserId === context.userId;

  if (context.store.getCommandSwitch(RCKitCommand.SHOW_MESSAGE_STATE) && isSelf) return true;
  if (
    (msg.sentStatus === SentStatus.FAILED || msg.sentStatus === SentStatus.SENDING)
    && isSelf
  ) return true;

  return false;
};

/**
 * 获取消息摘要信息
 */
export const getMessageDigest = (message: IRCKitCachedMessage | null): string => {
  if (!message) {
    return ' ';
  }

  // 内置消息摘要计算

  const { messageType, content, senderUserId } = message;
  if (messageType === MessageType.TEXT || messageType === MessageType.REFERENCE) {
    return content.content || ' ';
  }
  if (messageType === MessageType.RECALL || messageType === MessageType.RECALL_NOTIFICATION_MESSAGE) {
    const context = ctx();
    if (senderUserId === context.userId) {
      return $tt('message.list.recall.by.self');
    }
    const { name } = context.appData.getUserProfile(senderUserId);
    return $tt('message.list.recall.by.other', name);
  }

  const messageTypes: string[] = [
    MessageType.IMAGE,
    MessageType.GIF,
    MessageType.VOICE,
    MessageType.HQ_VOICE,
    MessageType.FILE,
    MessageType.SIGHT,
    MessageType.COMBINE,
    MessageType.COMBINE_V2,
  ];
  if (messageTypes.includes(messageType)) {
    const name = `message-type.${messageType}` as keyof IRCKitLanguageEntries;
    return $tt(name);
  }

  // 自定义消息摘要计算
  if (!customMessageDigestHandlers.has(messageType)) {
    return $tt('message-type.unknown');
  }
  const digest = customMessageDigestHandlers.get(messageType)!;
  return computed(() => digest(message, lang.value)).value;
};
