import { ILogger } from '@rongcloud/engine';
import { RCKitContext } from './RCKitContext';

export interface CustomElementConstructor {
  new (...params: any[]): HTMLElement;
}

export abstract class RCKitProvider {
  protected readonly logger: ILogger;

  constructor(
    protected readonly ctx: RCKitContext,
  ) {
    this.logger = ctx.logger;
  }

  /**
   * 定义 Provider 组件
   */
  protected abstract defineComponent(): CustomElementConstructor;

  /**
   * 定义 Provider 组件 tag
   */
  protected abstract getTag(): string;

  /**
   * 注册 DOM 组件
   */
  public registerDOMComponent(): void {
    const tag = this.getTag();
    if (!customElements.get(tag)) {
      customElements.define(tag, this.defineComponent());
    }
  }
}
