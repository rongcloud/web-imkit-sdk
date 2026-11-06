import { ILogger, IPushConfig } from '@rongcloud/engine';
import { RCKitCommand } from '../enums/RCKitCommand';
import { LogTag } from '../enums/LogTag';
import { IRCKitCachedConversation } from './conversation/IRCKitCachedConversation';
import { IRCKitCachedMessage } from './MessageDataModule';

/**
 * 会话面板标题栏功能拓展定义
 */
export type IRCKitConversationExtension = {
  /** 功能 ID，业务层自行定义 */
  id: string,
  /** 功能图标 */
  icon: string,
  /** 过滤器，用于控制对哪些会话可见，不配置的情况下默认所有会话可见 */
  filter?: (conversation: IRCKitCachedConversation) => boolean
};

export type IRCKitPushConfigHook = (message: IRCKitCachedMessage) => IPushConfig;

export class RCKitStore {
  private _commands: Map<RCKitCommand, boolean> = new Map();

  /**
   * 会话栏标题，仅H5平台当会话栏开启时才能设置成功
   */
  private _conversationBarTitle?: string | undefined;

  /**
   * 是否显示会话栏，仅 H5 有效
   * * true - 显示（Default）
   * * false - 隐藏
   */
  private _conversationBarSwitch: boolean = true;

  /**
   * 是否显示会话详情返回按钮，仅 H5 有效
   * * true - 显示（Default）
   * * false - 隐藏
   */
  private _conversationDetailBackSwitch: boolean = true;

  constructor(
    private readonly logger: ILogger,
  ) {
    this._init();
  }

  private _init(): void {
    // 定义开关默认值
    this._commands.set(RCKitCommand.SHOW_CONNECTION_STATUS, true);
    this._commands.set(RCKitCommand.SHOW_MESSAGE_STATE, false);
    this._commands.set(RCKitCommand.FOCUS_ON_LATEST_MESSAGE, true);
    this._commands.set(RCKitCommand.AT_ALL, false);
    this._commands.set(RCKitCommand.SHOW_USER_ONLINE_STATE, false);
    this._commands.set(RCKitCommand.PROMPT_SENDER_WHEN_QUOTE_MESSAGE, false);
    this._commands.set(RCKitCommand.DELETE_MESSAGES_WHILE_DELETE_CONVERSATION, true);
    this._commands.set(RCKitCommand.USE_QUOTE_MESSAGE_V2, false);
    this._commands.set(RCKitCommand.MESSAGE_REACTION_ENABLED, false);
    this._commands.set(RCKitCommand.SHOW_MESSAGE_REACT_USERS, false);
    this._commands.set(RCKitCommand.MESSAGE_EDIT_ENABLED, false);
  }

  /**
   * 修改功能开关
   * @param command
   * @param enable
   */
  setCommandSwitch(command: RCKitCommand, enable: boolean): void {
    this.logger.info(LogTag.A_SET_COMMAND_SWITCH_O, `command: ${command}, enable: ${!!enable}`);
    this._commands.set(command, !!enable);
  }

  getCommandSwitch(command: RCKitCommand): boolean {
    return !!this._commands.get(command);
  }

  /**
   * 设置会话栏标题
   * @param value 标题内容
   */
  setConversationBarTitle(value?: string): void {
    // 如果会话栏未开启，则不允许设置标题
    if (!this._conversationBarSwitch) {
      return;
    }

    this._conversationBarTitle = value;
  }

  /**
   * 设置会话栏开关
   * @param enable 是否开启
   */
  setConversationBarSwitch(enable: boolean): void {
    this._conversationBarSwitch = enable;
  }

  /**
   * 设置会话详情返回按钮开关
   * @param enable 是否开启
   */
  setConversationDetailBackSwitch(enable: boolean): void {
    this._conversationDetailBackSwitch = enable;
  }

  /**
   * 获取会话栏开关
   * @returns 是否开启
   */
  getConversationBarSwitch(): boolean {
    return this._conversationBarSwitch;
  }

  /**
   * 获取会话详情返回按钮开关
   * @returns 是否开启
   */
  getConversationDetailBackSwitch(): boolean {
    return this._conversationDetailBackSwitch;
  }

  /**
   * 获取会话栏标题
   * @returns 标题内容
   */
  getConversationBarTitle(): string | undefined {
    return this._conversationBarTitle;
  }

  getConversationExtension(): IRCKitConversationExtension[] {
    return this._extensions;
  }

  private _extensions: IRCKitConversationExtension[] = [];

  /**
   * 为会话标题栏添加拓展功能
   */
  setConversationExtension(extensions: IRCKitConversationExtension[]): void {
    this._extensions.splice(0, this._extensions.length, ...extensions);
  }

  private _pushConfigHook?: IRCKitPushConfigHook;

  setPushConfigHook(hook: IRCKitPushConfigHook): void {
    this._pushConfigHook = hook;
  }

  getPushConfig(message: IRCKitCachedMessage): IPushConfig | undefined {
    if (!this._pushConfigHook) {
      return;
    }

    let conf: IPushConfig | undefined;
    try {
      conf = this._pushConfigHook({ ...message });
    } catch (error: any) {
      this.logger.error(LogTag.L_GET_PUSH_CONFIG_HOOK_E, JSON.stringify({
        messageType: message.messageType,
        error: error?.message,
      }));
      console.error(error);
    }
    return conf;
  }

  destroy(): void {
    this._commands.clear();
  }
}
