import { ILogger } from '@rongcloud/engine';
import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitContext } from '../core/RCKitContext';
import { RCKitStore } from './RCKitStore';

export abstract class RCKitModule {
  protected readonly logger: ILogger;

  protected readonly store: RCKitStore;

  constructor(protected ctx: RCKitContext) {
    this.logger = ctx.logger;
    this.store = ctx.store;

    this.ctx.addEventListener(InnerEvent.DESTROY_USER_CACHE, this._onDestroyUserCache, this);
    this.ctx.addEventListener(InnerEvent.INIT_USER_CACHE, this._onInitUserCache, this);
    this._onInit();
  }

  /**
   * 模块初始化
   */
  protected _onInit(): void {
    // 暂不处理
  }

  /**
   * 用户级缓存数据初始化
   */
  protected abstract _onInitUserCache(): void;

  /**
   * 销毁用户级缓存数据
   */
  protected abstract _onDestroyUserCache(): void;

  /**
   * 模块反初始化
   */
  public abstract destroy(): void;
}
