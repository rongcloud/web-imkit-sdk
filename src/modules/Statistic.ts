import { BasicLogger, PluginContext } from '@rongcloud/engine';

export enum StatisticKey {
  /** 会话列表点击选中 */
  CONVERSATION_LIST_ITEM_CLICK = 'ConversationList-Item-Click',
  /** 点击会话菜单功能项 */
  CONVERSATION_LIST_ITEM_OPTION_CLICK = 'ConversationList-Item-Option-Click',
  /** 会话页面 Header 头像与名称点击事件 */
  CONVERSATION_NAVI_CLICK = 'Conversation-Navi-Click', // TODO: 需要补充点击功能
  /** 点击消息菜单功能项 */
  CONVERSATION_MESSAGE_OPTION_CLICK = 'Conversation-Message-Option-Click',
  /** Emoji 按钮点击事件 */
  INPUT_EMOJI_ENTRY_CLICK = 'Input-Emoji-Entry-Click',
  /** 点击打开输入框二级菜单 */
  CONVERSATION_INPUT_EXTEND_CLICK = 'Conversation-InputExtend-Click',
}

/**
 * IMKit 埋点统计模块
 */
export class Statistic {
  /**
   * 记录已上报的埋点数据
   */
  private static _reported: Set<string> = new Set();

  private readonly logger: BasicLogger;

  constructor(ctx: PluginContext) {
    this.logger = ctx.createLogger('IMKit', 'IM');
  }

  /**
   * 对于埋点数据，全生命周期内每个 key 仅记录一次（包括切换 appkey）
   * @param key
   */
  public report(key: StatisticKey | string) {
    if (Statistic._reported.has(key)) {
      return;
    }

    Statistic._reported.add(key);
    // TODO: 上线前更新成正式的埋点上报接口
    this.logger.record(`IMKit-${key}-S`);
  }
}
