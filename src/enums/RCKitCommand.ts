/**
 * 功能开关定义
 */
export enum RCKitCommand {
  /** 已发送消息编辑，默认关闭；编辑时限使用服务端配置。 */
  MESSAGE_EDIT_ENABLED = 'MESSAGE_EDIT_ENABLED',
  /**
   * 显示打开的会话界面的链接状态提醒
   * * true - 显示（Default）
   * * false - 隐藏
   */
  SHOW_CONNECTION_STATUS = 'SHOW_CONNECTION_STATUS',
  /**
   * 显示消息已读与已发送状态
   * * true - 开启（Default）
   * * false - 关闭，仅展示发送中、发送失败状态
   */
  SHOW_MESSAGE_STATE = 'SHOW_MESSAGE_STATE',
  /**
   * 进入会话时是否默认展示最新消息，仅 Electron 平台支持修改，Web 平台默认展示最新消息，修改无效。
   * * true - 进入会话，会话中展示的是最新消息（Default）
   * * false - 进入会话，会话中展示的是最近已读消息
   */
  FOCUS_ON_LATEST_MESSAGE = 'FOCUS_ON_LATEST_MESSAGE',
  /**
   * '@所有人'功能开关
   * * true - 开启
   * * false - 关闭（Default）
   */
  AT_ALL = 'AT_ALL',
  /**
   * 显示用户在线状态显示，开启后需用户主动调用 `updateUserOnlineStatus` 接口来更新用户在线状态信息。
   * * true - 显示
   * * false - 隐藏（Default）
   */
  SHOW_USER_ONLINE_STATE = 'SHOW_USER_ONLINE_STATE',
  /**
   * 引用或回复消息时，默认 @ 消息发送者
   * * true - 开启
   * * false - 关闭（Default）
   */
  PROMPT_SENDER_WHEN_QUOTE_MESSAGE = 'PROMPT_SENDER_WHEN_QUOTE_MESSAGE',
  /**
   * 删除会话的同时，删除本地与远端的消息
   * * true - 开启（Default）
   * * false - 关闭
   */
  DELETE_MESSAGES_WHILE_DELETE_CONVERSATION = 'DELETE_MESSAGES_WHILE_DELETE_CONVERSATION',
  /**
   * 使用 V2 版本引用消息
   * * true - 开启
   * * false - 关闭（Default）
   * @since 5.38.0
   */
  USE_QUOTE_MESSAGE_V2 = 'USE_QUOTE_MESSAGE_V2',
  /**
   * 消息回应功能开关
   * * false - 关闭（Default）
   * * true - 开启
   * @since 5.42.0
   */
  MESSAGE_REACTION_ENABLED = 'MESSAGE_REACTION_ENABLED',
  /**
   * 消息气泡中显示详细的回应用户名称，需配合 `MESSAGE_REACTION_ENABLED` 开启消息回应功能才能生效
   * * false - 关闭（Default），默认仅显示回应用户数量
   * * true - 开启，显示回应用户名称列表
   * @since 5.42.0
   */
  SHOW_MESSAGE_REACT_USERS = 'SHOW_MESSAGE_REACT_USERS',
}
