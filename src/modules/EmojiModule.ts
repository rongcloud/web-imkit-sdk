import { RCKitModule } from './RCKitModule';

/**
 * Emoji 配置均未初始化前配置，因此可以不必考虑用户生命周期
 */
export class EmojiModule extends RCKitModule {
  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    // 无需实现，emoji 表情配置
  }

  public destroy(): void {
    // TODO: 清理配置
    throw new Error('Method not implemented.');
  }
}
