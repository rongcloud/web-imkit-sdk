import {
  ILogger, RCConnectionStatus, PluginContext, GroupReadReceiptVersion,
} from '@rongcloud/engine';
import {
  addEventListener, Events, getCurrentUserId, removeEventListener, ErrorCode,
  getAppSettings,
} from '@rongcloud/imlib-next';

import { Statistic, StatisticKey } from '@lib/modules/Statistic';
import { ConversationDataModule } from '@lib/modules/conversation/ConversationDataModule';
import { ConversationItemModule } from '@lib/modules/conversation/ConversationItemModule';
import { RCKitCommand } from '@lib/enums/RCKitCommand';
import { EventDispatcher } from './EventDispatcher';
import { RCKitStore } from '../modules/RCKitStore';
import { RCKitConversationStore } from '../modules/RCKitConversationStore';
import { AppDataModule } from '../modules/appdata/AppDataModule';
import { IRCKitInitOpts } from './RCKitApplication';
import { I18nModule } from '../modules/I18nModule';
import { RCKitEvent } from './RCKitEvent';
import { MessageModule } from '../modules/MessageDataModule';
import { InputModule } from '../modules/InputModule';
import { BubbleModule } from '../modules/BubbleModule';
import { ConversationMenu } from '../modules/ConversationMenu';
import { MessageMenu } from '../modules/MessageMenu';
import { IRCKitLanguageEntries } from '../languages';
import { AudioPlayer } from '../modules/AudioPlayer';
import { SpeechToTextStore } from '../modules/SpeechToTextStore';
import {
  ConfirmEvent, ConnectionStatusChangeEvent, EventDefined, InnerEvent, RCKitEvents,
} from './EventDefined';

export interface IRCKitUserCacheSession {
  userId: string;
  generation: number;
}

/**
 * 业务上下文总线
 * @emits
 * - RCKitEvents.CONNECTION_STATUS_CHANGE - 连接状态变更
 * - RCKitEvents.USER_CHANGED - 用户变更，UI 与数据模块依据此事件判断是否需要清理缓存
 */
export class RCKitContext extends EventDispatcher<EventDefined> {
  public readonly store: RCKitStore;

  public conversationStore: RCKitConversationStore | null = null;

  public readonly i18n: I18nModule;

  public readonly appData: AppDataModule;

  public readonly message: MessageModule;

  public readonly conversation: ConversationDataModule;

  public readonly conversationItem: ConversationItemModule;

  public readonly input: InputModule;

  public readonly bubble: BubbleModule;

  /** Audio 音频管理模块 */
  public readonly audioPlayer: AudioPlayer;

  /**
   * 会话菜单管理模块
   */
  public readonly conversationMenu: ConversationMenu;

  public readonly msgMenu: MessageMenu;

  /** 语音转文字管理模块 */
  public readonly speechToTextStore: SpeechToTextStore;

  /** 埋点模块 */
  private readonly _stat: Statistic;

  /** 登录的用户 ID，用于判断连接后是否已更换登录用户 */
  private _originUserId: string = '';

  /** 用户缓存生命周期代次；同用户重连不会变化，销毁用户缓存时递增 */
  private _userCacheGeneration = 0;

  private _readReceiptVersion: GroupReadReceiptVersion | undefined = undefined;

  public get readReceiptVersion() {
    return this._readReceiptVersion;
  }

  /** 当前登录用户 ID */
  public get userId(): string {
    return this._originUserId;
  }

  public get userCacheGeneration(): number {
    return this._userCacheGeneration;
  }

  /** 是否启用引用消息 V2 */
  public get isQuoteMessageV2Enabled(): boolean {
    return this.store.getCommandSwitch(RCKitCommand.USE_QUOTE_MESSAGE_V2);
  }

  public get isMessageReactionEnabled(): boolean {
    return this.store.getCommandSwitch(RCKitCommand.MESSAGE_REACTION_ENABLED);
  }

  public get isMessageEditEnabled(): boolean {
    return this.store.getCommandSwitch(RCKitCommand.MESSAGE_EDIT_ENABLED);
  }

  public get isShowMessageReactUsersEnabled(): boolean {
    return this.store.getCommandSwitch(RCKitCommand.SHOW_MESSAGE_REACT_USERS);
  }

  /** 当前连接状态 */
  private _status: RCConnectionStatus = RCConnectionStatus.DISCONNECTED;

  /**
   * 是否运行在 Electron 版本 IMLib 引擎之上
   */
  public readonly isElectronRuntime = false;

  /**
   * IM 连接状态
   */
  public get status(): RCConnectionStatus {
    return this._status;
  }

  /**
   * 业务层定义的模态框容器
   */
  public readonly modalContainerId: string = ''

  /**
   * 允许撤回的时间范围，单位：秒
   */
  public readonly allowedToRecallTime: number;

  /**
   * 允许撤回消息编辑的时间范围，单位：秒
   */
  public readonly allowedToReEditTime: number;

  constructor(
    private context: PluginContext,
    public readonly logger: ILogger,
    /**
     * 业务层事件派发器
     */
    private readonly _emittor: EventDispatcher<EventDefined>,
    _opts: IRCKitInitOpts,
  ) {
    super();

    // 必须在业务模块注册前监听，确保模块清理前代次已经失效。
    this.addEventListener(InnerEvent.DESTROY_USER_CACHE, this._onDestroyUserCache, this);

    this._stat = new Statistic(context);

    this.modalContainerId = _opts.modalContainerId || '';
    this.allowedToRecallTime = _opts.allowedToRecallTime || 120;
    this.allowedToReEditTime = _opts.allowedToReEditTime || 60;

    this.store = new RCKitStore(logger);

    // UI 无关性模块初始化
    this.i18n = new I18nModule(this);
    this.audioPlayer = new AudioPlayer(this);
    this.appData = new AppDataModule(this, _opts.hooks);
    this.message = new MessageModule(this);
    this.conversation = new ConversationDataModule(this);
    this.conversationItem = new ConversationItemModule(this);
    this.input = new InputModule(this);
    this.bubble = new BubbleModule(this);
    this.conversationMenu = new ConversationMenu(this);
    this.msgMenu = new MessageMenu(this);
    this.speechToTextStore = new SpeechToTextStore(logger, this);
    this.msgMenu.setSpeechToTextStore(this.speechToTextStore);

    addEventListener(Events.CONNECTED, this._onConnected, this);
    addEventListener(Events.DISCONNECT, this._onDisconnected, this);
    addEventListener(Events.SUSPEND, this._onSuspend, this);
    addEventListener(Events.CONNECTING, this._onConnecting, this);
  }

  private _onConnecting() {
    this._status = RCConnectionStatus.CONNECTING;
    this.dispatch(new ConnectionStatusChangeEvent(RCConnectionStatus.CONNECTING));
  }

  private _onDisconnected(code: ErrorCode) {
    this._status = RCConnectionStatus.DISCONNECTED;
    this.dispatch(new ConnectionStatusChangeEvent(RCConnectionStatus.DISCONNECTED, code));
  }

  private _onSuspend(code: ErrorCode) {
    this._status = RCConnectionStatus.SUSPENDED;
    this.dispatch(new ConnectionStatusChangeEvent(RCConnectionStatus.SUSPENDED, code));
  }

  private _onConnected() {
    this._status = RCConnectionStatus.CONNECTED;
    // 获取当前支持的已读版本
    this._readReceiptVersion = getAppSettings()?.readReceiptVersion;

    // 重新连接后，userId 与原 ID 不匹配，说明用户已切换
    const newUserId = getCurrentUserId();

    if (this._originUserId === newUserId) {
      // 重新连接后，userId 与原 ID 匹配，说明用户未切换
      this.dispatch(new ConnectionStatusChangeEvent(RCConnectionStatus.CONNECTED));
      return;
    }

    if (this._originUserId && this._originUserId !== newUserId) {
      // 重新连接后，userId 与原 ID 不匹配，说明用户已切换，UI 与数据层应清空数据缓存
      // 不在 disconnec 事件中清空，是为了避免重新登录后数据构建过程过长
      this._originUserId = newUserId;
      this.dispatch(new RCKitEvent(InnerEvent.DESTROY_USER_CACHE), false);
    }

    // 首次连接
    this._originUserId = newUserId;
    // 通知 UI 与数据层构建数据缓存
    this.dispatch(new RCKitEvent(InnerEvent.INIT_USER_CACHE), false);

    this.dispatch(new ConnectionStatusChangeEvent(RCConnectionStatus.CONNECTED));

    this.conversationStore = new RCKitConversationStore(window, this.getAppkey(), this.userId, this.logger);
  }

  public destroy() {
    removeEventListener(Events.CONNECTED, this._onConnected, this);
    removeEventListener(Events.DISCONNECT, this._onDisconnected, this);
    removeEventListener(Events.SUSPEND, this._onSuspend, this);
    removeEventListener(Events.CONNECTING, this._onConnecting, this);

    this._userCacheGeneration += 1;
    this.removeEventListener(InnerEvent.DESTROY_USER_CACHE, this._onDestroyUserCache, this);

    this.audioPlayer.destroy();
    this.i18n.destroy();
    this.appData.destroy();
    this.message.destroy();
    this.conversation.destroy();
    this.input.destroy();
    this.bubble.destroy();
    this.conversationMenu.destroy();
    this.msgMenu.destroy();
    this.speechToTextStore.destroy();

    this._originUserId = '';
    this._readReceiptVersion = undefined;
  }

  private _onDestroyUserCache = () => {
    this._userCacheGeneration += 1;
  };

  /**
   * 弹窗提示
   * @param msgkey - 多语言词条 key
   */
  public alert(msgkey: keyof IRCKitLanguageEntries, ...args: Array<string | number>): void {
    this.emit(new RCKitEvent(RCKitEvents.ALERT_EVENT, this.i18n.format(msgkey, ...args)));
  }

  /**
   * 弹窗确认框，等待用户进行选择确认
   * @param msgkey - 多语言词条 key
   * @returns
   */
  public confirm(msgkey: keyof IRCKitLanguageEntries, ...args: Array<string | number>): Promise<boolean> {
    const evt: ConfirmEvent = new RCKitEvent(RCKitEvents.CONFIRM_EVENT, this.i18n.format(msgkey, ...args));
    this.emit(evt);
    return evt.awaitResult();
  }

  /**
   * 派发事件，如果事件不需要向 App 层传递，应调用 `dispatch`。
   * @param event - 事件
   * @param mode - 派发模式，默认值为 0
   * - 0. (default)优先向业务层派发，业务层弱拦截后，将停止向 SDK 内部继续传递
   * - 1. 向业务派发，同时向 SDK 内部派发，不受业务拦截影响，同时也不接收业务层的事件处理结果
   * - 2. 仅向业务层派发，SDK 内部不处理
   */
  emit<K extends keyof EventDefined>(event: EventDefined[K], mode: 0 | 1 | 2 = 0): void {
    // 对业务层派发的事件，使用 clone 复制实例
    const tmpEvent = event.clone(mode !== 0);
    // 立即执行监听器函数，避免 event.isDefaultPrevented() 无法获取到正确的值
    this._emittor.dispatch(tmpEvent, false);

    if (mode === 2 || (mode === 0 && tmpEvent.isDefaultPrevented())) {
      // 若业务层已拦截事件，则统一不再向 SDK 内部派发，避免各模块分散处理引发混乱
      return;
    }

    // 将原始数据在 SDK 内部分发
    this.dispatch(event);
  }

  /**
   * 向业务层同步派发可变数据事件。
   * @description
   * 该方法不会 clone 事件实例，也不会继续向 SDK 内部分发，适用于需要业务监听器同步修改
   * `event.data` 并回写到当前流程的场景。普通事件仍应优先使用 `emit`，避免业务层误改内部数据。
   * @param event - 事件
   */
  emitMutable<K extends keyof EventDefined>(event: EventDefined[K]): void {
    this._emittor.dispatch(event, false);
  }

  /**
   * 获取当前的 appkey
   * @returns
   */
  getAppkey() {
    return this.context.getAppkey();
  }

  /**
   * 记录埋点数据
   * @param key
   * @param value
   */
  statistic(key: StatisticKey | string) {
    this._stat.report(key);
  }
}
