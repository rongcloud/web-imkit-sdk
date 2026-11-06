import {
  IConversationOption, ILogger, LogL, PluginContext,
} from '@rongcloud/engine';
import { BaseMessage, IAReceivedMessage, ISendMessageOptions } from '@rongcloud/imlib-next';
import { IRCKitUserProfile } from '@lib/modules/appdata/UserCache';
import { IRCKitGroupProfile, IRCKitGroupMemberProfile } from '@lib/modules/appdata/GroupCache';
import { RCKitCommand } from '../enums/RCKitCommand';

import { RCKitContext } from './RCKitContext';
import { EventDispatcher } from './EventDispatcher';
import { UIModule } from '../ui';
import type { IRCKitRegisterMessageTypeOpts } from '../ui/interface';
import { IRCKitDefineCustomElementOptions, IRCKitOverrideAbleComponentProps } from '../ui/override-able';
import { LogTag } from '../enums/LogTag';
import { IRCKitLanguageEntries, RCKitLanguageDirection } from '../languages';
import { IRCKitServiceHooks } from '../modules/appdata/AppDataModule';
import { IRCKitCachedConversation } from '../modules/conversation/IRCKitCachedConversation';
import { IRCKitChatEmojiLibrary, IRCKitImageEmojiLibrary, IRCKitInputMenu } from '../modules/InputModule';
import { IRCKitMessageBubbleCfg } from '../modules/BubbleModule';
import { IRCKitConversationItemCfg } from '../modules/conversation/ConversationItemModule';
import { IRCKitConversationMenuItem } from '../modules/ConversationMenu';
import { IRCKitMessageMenuItem } from '../modules/MessageMenu';
import { IRCKitConversationExtension, IRCKitPushConfigHook } from '../modules/RCKitStore';
import { EventDefined, InnerEvent } from './EventDefined';
import { RCKitEvent } from './RCKitEvent';

export interface IRCKitInitOpts {
  /**
   * 业务数据模块钩子，用于向 SDK 注入用户信息、群组信息等。
   */
  hooks: IRCKitServiceHooks;
  /**
   * 日志输出等级，默认值 `LogL.WARN(2)`
   */
  logLevel?: LogL.DEBUG | LogL.INFO | LogL.WARN | LogL.ERROR;
  /**
   * 初始语言配置。
   * @description 若不传或值非法，则默认 `zh_CN`。
   */
  language?: string;
  /**
   * 允许对己方已发送消息进行撤回操作的最大时间，单位：秒。
   * @description 若不传或值非法，则默认 120 秒
   */
  allowedToRecallTime?: number;
  /**
   * 允许对己方发送的撤回消息进行编辑操作的最大时间，单位：秒。
   * @description 若不传或值非法，则默认 60 秒
   */
  allowedToReEditTime?: number;
  /**
   * 弹窗父级 DOM，不传默认为 document.body
   */
  modalContainerId?: string;
}

/** 确保接口仅在 `ready()` 前可被调用的装饰器 */
function BeforeReady(tag: LogTag) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if ((this as any)._isReady) {
        (this as any)._logger.error(tag, `RCKitApplication.${propertyKey} must be called before 'ready'`);
        return;
      }
      return originalMethod.apply(this, args);
    };
  };
}

/** 确保接口仅在 `ready()` 后可被调用的装饰器 */
function AfterReady(tag: LogTag) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (!(this as any)._isReady) {
        (this as any)._logger.error(tag, `'RCKitApplication.${propertyKey}' failed: not ready yet.`);
        return;
      }
      return originalMethod.apply(this, args);
    };
  };
}

export class RCKitApplication extends EventDispatcher<EventDefined> {
  private readonly _ctx: RCKitContext;

  private readonly _uiModule: UIModule;

  /** 在 ready 前完成语言包注册后应用的初始化语言 */
  private readonly _initialLanguage?: string;

  /** 业务是否已在 ready 前主动设置语言 */
  private _languageSetBeforeReady: boolean = false;

  private _isReady: boolean = false;

  constructor(
    private context: PluginContext,
    private readonly _logger: ILogger,
    opts: IRCKitInitOpts,
  ) {
    super();

    this._initialLanguage = opts.language;
    this._ctx = new RCKitContext(this.context, _logger, this, opts);

    // UI 模块初始化
    this._uiModule = new UIModule(this._ctx);

    // 监听业务层 IM 连接销毁
    this.context.ondestroy = this._onIMDestroy.bind(this);
  }

  // IMLib 反初始化后，IMKit 也需要进行反初始化，
  private _onIMDestroy(): void {
    this.destroy();
  }

  /**
   * 定义功能开关，可通过 `RCKitCommand` 查看所有支持的功能配置项。必须在 `ready` 之前调用。
   */
  @BeforeReady(LogTag.A_SET_COMMAND_SWITCH_O)
  setCommandSwitch(command: RCKitCommand, enable: boolean): void {
    this._ctx.store.setCommandSwitch(command, enable);
  }

  /**
   * 查询功能开关开启状态，可通过 `RCKitCommand` 查看所有支持的功能配置项。
   */
  getCommandSwitch(command: RCKitCommand): boolean {
    return this._ctx.store.getCommandSwitch(command);
  }

  /**
   * 设置会话栏开关
   * @param enable 是否开启
   */
  setConversationBarSwitch(enable: boolean): void {
    this._ctx.store.setConversationBarSwitch(enable);
    this._ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_BAR_SWITCH_CHANGE, enable));
  }

  /**
   * 设置会话详情返回按钮开关
   * @param enable 是否开启
   */
  setConversationDetailBackSwitch(enable: boolean): void {
    this._ctx.store.setConversationDetailBackSwitch(enable);
    this._ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_DETAIL_BACK_SWITCH_CHANGE, enable));
  }

  /**
   * 设置会话栏标题，仅当会话栏开启时才能设置成功
   * @param value 标题内容，undefined 表示使用默认值
   */
  setConversationBarTitle(value?: string): void {
    this._ctx.store.setConversationBarTitle(value);
    this._ctx.dispatch(new RCKitEvent(InnerEvent.CONVERSATION_BAR_TITLE_CHANGE, value));
  }

  /**
   * 注册自定义组件，以替换 SDK 默认组件，必须在 `ready` 之前调用。
   * 自定义组件仅作用于当前次 IMKit 初始化；销毁后再次初始化时，应按本次配置重新注册。
   * 不应依赖内部 `rc-*` tag 在全局 Custom Elements 注册表中的具体实现。
   * @param tag - 自定义组件标签名
   * @param opts - 自定义组件定义
   * @example ```ts
   * app.registerCustomElement(RCKitOverrideAbleComponent.HQVoiceMessageComponent, {
   *    template: '<span class="test" @click="handleClick">{{ content }}</span>',
   *    setup(props, ctx) {
   *      const { computed } = ctx;
   *      const handleClick = () => {
   *        // 处理自定义事件
   *      };
   *      return {
   *        content: computed(() => {
   *          return ctx.getLanguage() === 'en_US' ? 'Hello' : '你好';
   *        }),
   *      },
   *    },
   *    styles: ['.test { color: red; }'],
   * });
   * ```
   */
  @BeforeReady(LogTag.A_REGISTER_CUSTOM_ELEMENT_O)
  registerCustomElement<T extends keyof IRCKitOverrideAbleComponentProps>(tag: T, opts: IRCKitDefineCustomElementOptions<IRCKitOverrideAbleComponentProps[T]>): void {
    this._uiModule.registerCustomElement(tag, opts);
  }

  /**
   * 注册自定义消息类型，必须在 `ready` 之前调用。
   */
  @BeforeReady(LogTag.A_REGISTER_MESSAGE_TYPE_O)
  registerMessageType<T=any>(messageType: string, options: IRCKitRegisterMessageTypeOpts) {
    return this._uiModule.registerMessageType<T>(messageType, options);
  }

  // ******************************************************
  // 多语言 Start
  // ******************************************************

  /**
   * 获取内置语言包词条拷贝
   * @param lang 传参确认要获取的语言包
   */
  cloneLanguageEntries(lang: string): { [key: string]: string } | null {
    // 对外暴露以 [key: stirng]: string 的方式定义，以避免业务层自定义组件或功能需要时编译异常
    // 内部使用严格类型声明，以检查语言包词条是否存在
    return this._ctx.i18n.cloneLanguageEntries(lang) as { [key: string]: string } | null;
  }

  /**
   * 注册语言包，也可用于覆盖既有语言包；仅 `ready` 调用前有效。
   * @param lang - 语言包定义，如 `zh_CN`
   * @param entries - 语言包词条定义
   * @param direction - 语言的行文方向，默认 'ltr'; 仅当首次注册指定语言包时有效。
   */
  @BeforeReady(LogTag.A_REGISTER_LANGUAGE_PACK_O)
  registerLanguagePack(lang: string, entries: { [key: string]: string } | IRCKitLanguageEntries, direction: RCKitLanguageDirection = 'ltr'): void {
    // 对外暴露以 [key: stirng]: string 的方式定义，以避免业务层自定义组件或功能需要时编译异常
    // 内部使用严格类型声明，以检查语言包词条是否存在
    this._ctx.i18n.registerLanguagePack(lang, entries as any as IRCKitLanguageEntries, direction);
  }

  /**
   * 语言切换功能接口
   * @param lang - 要切换的目标语言
   */
  setLanguage(lang: string): void {
    this._ctx.i18n.setLanguage(lang);
    if (!this._isReady && this._ctx.i18n.getLanguage() === lang) {
      this._languageSetBeforeReady = true;
    }
  }

  /**
   * 获取当前使用的语言
   */
  getLanguage(): string {
    return this._ctx.i18n.getLanguage();
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return this._ctx.i18n.getSupportedLanguages();
  }

  // ******************************************************
  // 多语言 End
  // ******************************************************

  /**
   * 设置自定义推送配置钩子，用于在消息发送前，修改移动端接收推送时的标题、内容等。
   * @param hook
   */
  setPushConfigHook(hook: IRCKitPushConfigHook): void {
    this._ctx.store.setPushConfigHook(hook);
  }

  // ******************************************************
  // 用户数据更新 Start
  // ******************************************************

  /**
   * 更新用户信息
   * @param profile
   */
  @AfterReady(LogTag.A_UPDATE_USER_PROFILE_E)
  updateUserProfile(profile: IRCKitUserProfile): void {
    this._ctx.appData.updateUserProfile(profile);
  }

  /**
   * 更新群组信息
   * @param profile
   */
  @AfterReady(LogTag.A_UPDATE_GROUP_PROFILE_E)
  updateGroupProfile(profile: IRCKitGroupProfile): void {
    this._ctx.appData.updateGroupProfile(profile);
  }

  /**
   * 更新用户在线状态
   * @param userId 用户 ID
   * @param online 在线状态
   */
  @AfterReady(LogTag.A_UPDATE_USER_ONLINE_STATE_E)
  updateUserOnlineStatus(userId: string, online: boolean): void {
    this._ctx.appData.updateUserOnlineStatus(userId, online);
  }

  /**
   * 立即刷新用户成员列表，调用该方法会同步更新群组 `memberCount` 信息。
   * 该操作仅影响本地缓存数据与 UI 显示，不会向融云服务端发送请求。
   * @param groupId 群组 ID
   * @param members 成员列表
   */
  @AfterReady(LogTag.A_UPDATE_GROUP_MEMBERS_E)
  updateGroupMembers(groupId: string, members: IRCKitGroupMemberProfile[]): void {
    this._ctx.appData.updateGroupMembers(groupId, members);
  }

  /**
   * 添加群组成员，调用该方法会同步更新群组 `memberCount` 信息。
   * 该操作仅影响本地缓存数据与 UI 显示，不会向融云服务端发送请求。
   */
  @AfterReady(LogTag.A_ADD_GROUP_MEMBERS_E)
  addGroupMembers(groupId: string, members: IRCKitGroupMemberProfile[]): void {
    this._ctx.appData.addGroupMembers(groupId, members);
  }

  /**
   * 删除群组成员，调用该方法会同步更新群组 `memberCount` 信息。
   * 该操作仅影响本地缓存数据与 UI 显示，不会向融云服务端发送请求。
  */
  @AfterReady(LogTag.A_REMOVE_GROUP_MEMBERS_E)
  removeGroupMembers(groupId: string, members: string[]): void {
    this._ctx.appData.removeGroupMembers(groupId, members);
  }

  // ******************************************************
  // 用户数据更新 End
  // ******************************************************

  /**
   * 获取会话菜单拷贝
   * @returns
   */
  cloneConversationMenu(): IRCKitConversationMenuItem[] {
    return this._ctx.conversationMenu.cloneConversationMenu();
  }

  setConversationMenu(menu: IRCKitConversationMenuItem[]): void {
    this._ctx.conversationMenu.setConversationMenu(menu);
  }

  cloneMessageMenu(): IRCKitMessageMenuItem[] {
    return this._ctx.msgMenu.cloneMessageMenu();
  }

  setMessageMenu(menu: IRCKitMessageMenuItem[]) {
    this._ctx.msgMenu.setMessageMenu(menu);
  }

  // ******************************************************
  // 会话 Start
  // ******************************************************

  /**
   * 打开指定会话，若会话不存在于当前显示的会话列表内，新建会话并将其置于会话列表尽可能靠前位置
   * @param conversation
   */
  @AfterReady(LogTag.A_OPEN_CONVERSATION_E)
  openConversation(conversation: IConversationOption, focusInput: boolean = true): Promise<{ code: number }> {
    return this._ctx.conversation.openConversation(conversation, focusInput);
  }

  /**
   * 删除指定会话
   * @param conversation
   */
  @AfterReady(LogTag.A_REMOVE_CONVERSATION_E)
  removeConversation(conversation: IConversationOption): Promise<void> {
    return this._ctx.conversation.removeConversation(conversation);
  }

  /**
   * 获取当前打开中的会话，若未打开任何会话，则返回 null
   * @returns
   */
  getOpenedConversation(): IRCKitCachedConversation | null {
    const data = this._ctx.conversation.getOpenedConversation();
    return data ? { ...data } : null;
  }

  /**
   * 向右侧会话详情面板添加功能拓展，仅在 `ready` 之前调用有效。
   * @param extension
   * @description - 添加拓展后，当用户点击时，会向业务层派发 {@link RCKitEvents.CONVERSATION_EXTENSION_CLICK} 事件。
   */
  @BeforeReady(LogTag.A_SET_CONVERSATION_EXTENSION_E)
  setConversationExtension(extensions: IRCKitConversationExtension[]) {
    this._ctx.store.setConversationExtension(extensions);
  }

  // ******************************************************
  // 会话 End
  // ******************************************************

  // ******************************************************
  // 输入框定制化 Start
  // ******************************************************

  /**
   * 获取输入框菜单配置拷贝
   * @returns
   */
  cloneInputMenu(): IRCKitInputMenu {
    return this._ctx.input.cloneInputMenu();
  }

  /**
   * 设置新的输入框菜单配置
   * @param menu
   */
  @BeforeReady(LogTag.A_SET_INPUT_MENU_E)
  setInputMenu(menu: IRCKitInputMenu): void {
    this._ctx.input.setInputMenu(menu);
  }

  cloneMessageBubbleCfg(): IRCKitMessageBubbleCfg {
    return this._ctx.bubble.cloneMessageBubbleCfg();
  }

  @BeforeReady(LogTag.A_SET_MESSAGE_BUBBLE_CFG_E)
  setMessageBubbleCfg(config: IRCKitMessageBubbleCfg): void {
    this._ctx.bubble.setMessageBubbleCfg(config);
  }

  /**
   * 获取会话列表 Item 配置拷贝
   */
  cloneConversationItemCfg(): IRCKitConversationItemCfg {
    return this._ctx.conversationItem.cloneConversationItemCfg();
  }

  /**
   * 设置会话列表 Item 配置
   * @param config
   */
  @BeforeReady(LogTag.A_SET_CONVERSATION_ITEM_CFG_E)
  setConversationItemCfg(config: IRCKitConversationItemCfg): void {
    this._ctx.conversationItem.setConversationItemCfg(config);
  }

  /**
   * 获取已存在的图片表情库列表拷贝
   * @returns
   */
  cloneImageEmojiLibraries(): IRCKitImageEmojiLibrary[] {
    return this._ctx.input.cloneImageEmojiLibraries();
  }

  /**
   * 设置图片表情库列表
   * @param libraries
   */
  setImageEmojiLibraries(libraries: IRCKitImageEmojiLibrary[]): void {
    this._ctx.input.setImageEmojiLibraries(libraries);
  }

  /**
   * 获取已存在的字符表情库拷贝
   */
  cloneChatEmojiLibrary(): IRCKitChatEmojiLibrary {
    return this._ctx.input.cloneChatEmojiLibrary();
  }

  /**
   * 设置字符表情库
   */
  @BeforeReady(LogTag.A_SET_CHAT_EMOJI_LIBRARY_E)
  setChatEmojiLibrary(library: IRCKitChatEmojiLibrary): void {
    this._ctx.input.setChatEmojiLibrary(library);
  }

  // ******************************************************
  // 输入框定制化 End
  // ******************************************************

  /**
   * 设置发消息时允许携带 quoteInfo 数据的消息类型列表
   * @param typeList
   */
  @BeforeReady(LogTag.A_SET_QUOTE_ENABLE_MESSAGE_TYPE_LIST_O)
  setQuoteEnableMessageTypeList(typeList: string[]): void {
    this._ctx.input.setQuoteEnableMessageTypeList(typeList);
  }

  getQuoteEnableMessageTypeList(): string[] {
    return this._ctx.input.getQuoteEnableMessageTypeList();
  }

  /**
   * 发送消息
   * @param conversation - 会话
   * @param message - 消息
   * @param options - 发送选项
   */
  @AfterReady(LogTag.A_SEND_MESSAGE_E)
  sendMessage(conversation: IConversationOption, message: BaseMessage<any>, options?: ISendMessageOptions): Promise<{ code: number, message?: IAReceivedMessage }> {
    return this._ctx.message.sendMessage(conversation, message, options);
  }

  /**
   * 向本地插入一条消息
   * @param conversation - 会话
   * @param message - 消息
   */
  @AfterReady(LogTag.A_INSERT_MESSAGE_E)
  insertMessage(conversation: IConversationOption, message: BaseMessage<any>): Promise<{ code: number }> {
    return this._ctx.message.insertMessage(conversation, message);
  }

  /**
   * 通知 SDK 配置准备完成，以便 SDK 依据配置进行初始化。
   */
  ready(): void {
    if (this._isReady) {
      this._logger.warn(LogTag.A_READY_O, 'RCKitApplication repeat call \'ready()\'');
      return;
    }

    this._logger.info(LogTag.A_READY_O, 'RCKitApplication \'ready\'');
    if (!this._languageSetBeforeReady && this._initialLanguage && this._ctx.i18n.getLanguage() !== this._initialLanguage) {
      this._ctx.i18n.setLanguage(this._initialLanguage);
    }
    this._uiModule.registerDOMElements();
    this._isReady = true;
  }

  /**
   * 检测 SDK 是否已完成初始化
   * @returns 是否已完成初始化
   */
  ifReady(): boolean {
    return this._isReady;
  }

  getCurrentUserId(): string {
    return this._ctx.userId;
  }

  /**
   * 反初始化
   */
  destroy(): void {
    this.removeAllEventListeners();
    this._ctx.destroy();
    this._uiModule.destroy();
    // UI 状态重置完成后再清空内部事件总线，确保已卸载或尚未卸载的 Provider 都不再持有旧实例。
    this._ctx.removeAllEventListeners();
  }
}
