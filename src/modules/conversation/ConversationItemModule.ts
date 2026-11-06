import { RCKitModule } from '../RCKitModule';
import { RCKitContext } from '../../core/RCKitContext';

const cloneConversationItemCfg = (config: IRCKitConversationItemCfg) => ({ ...config });

export interface IRCKitConversationItemCfg {
  /**
   * 会话 item 圆角大小
   */
  radius?: number;
  /**
   * 头像大小
   */
  portraitSize?: 'large' | 'small';
  /**
   * 置顶背景颜色，支持数字 (0xEFF4FF) 或 16 进制字符串 ("#EFF4FF")
   */
  topBackgroundColor?: number | string;
  /**
   * hover 背景颜色，支持数字 (0xF3F5FA) 或 16 进制字符串 ("#F3F5FA")
   */
  hoverBackgroundColor?: number | string;
  /**
   * 选中背景颜色，支持数字 (0xD2E1FE) 或 16 进制字符串 ("#D2E1FE")
   */
  activeBackgroundColor?: number | string;
}

export const defaultConversationItemCfg: IRCKitConversationItemCfg = {
  radius: 20,
  portraitSize: 'large',
  topBackgroundColor: '#EFF4FF',
  hoverBackgroundColor: '#F3F5FA',
  activeBackgroundColor: '#D2E1FE',
};

export class ConversationItemModule extends RCKitModule {
  public conversationItemCfg: IRCKitConversationItemCfg = {};

  constructor(ctx: RCKitContext) {
    super(ctx);
    this.setConversationItemCfg(defaultConversationItemCfg);
  }

  protected _onInit(): void {
    // 无需实现
  }

  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    // 无需实现
  }

  public destroy(): void {
    this.setConversationItemCfg(defaultConversationItemCfg);
  }

  cloneConversationItemCfg(): IRCKitConversationItemCfg {
    return cloneConversationItemCfg(this.conversationItemCfg);
  }

  setConversationItemCfg(cfg: IRCKitConversationItemCfg): void {
    this.conversationItemCfg = { ...this.conversationItemCfg, ...cfg };
  }
}
