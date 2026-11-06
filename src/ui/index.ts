// @ts-ignore
import {
  defineCustomElement, computed, ref, reactive,
} from 'vue';

import { ILogger } from '@rongcloud/engine';

import { BaseMessage, registerMessageType } from '@rongcloud/imlib-next';
import { RCKitContext } from '../core/RCKitContext';
import { LogTag } from '../enums/LogTag';

import { components } from './component';
import { providers } from './provider';
import {
  IRCKitOverrideAbleComponentProps, OverrideAbleComponentTagInner,
  IRCKitDefineCustomElementOptions, IRCKitComponentContext, overrideAbleComponents,
} from './override-able';

import { destroy as destroyI18n, init, lang } from './i18n-vue';
import {
  destroyProviderContext, initProviderContext, setCustomMessageDigestHandler, regMessageTypeComponentTag,
  setOverrideAbleComponentTags,
} from './provider/context';
import type { IRCKitMessageComponentProps, IRCKitRegisterMessageTypeOpts } from './interface';
import { InnerEvent } from '../core/EventDefined';
import { RCKitEvent } from '../core/RCKitEvent';

let uiModuleInstanceId = 0;

export class UIModule {
  private readonly logger: ILogger;

  private readonly _instanceId = ++uiModuleInstanceId;

  /**
   * 业务层注册的自定义消息组件
   */
  private readonly _customMessageComponents: Record<string, any> = {};

  /**
   * 可重写组件
   */
  private readonly _overrideAbleComponents: Record<string, any> = { ...overrideAbleComponents };

  /** 当前实例中各 origin tag 实际渲染的组件 tag */
  private readonly _overrideAbleComponentTags: Record<string, string> = Object.keys(overrideAbleComponents)
    .reduce((tags, tag) => ({ ...tags, [tag]: tag }), {});

  private readonly _overrideCtx: IRCKitComponentContext;

  constructor(private readonly ctx: RCKitContext) {
    this.logger = ctx.logger;

    this._overrideCtx = {
      computed,
      ref,
      reactive,
      getLanguage: () => lang.value,
      getCurrentUserId: () => this.ctx.userId,
    };

    // 初始化 i18n
    init(ctx);
    // 初始化 provider context
    initProviderContext(ctx);
    setOverrideAbleComponentTags(this._overrideAbleComponentTags);
  }

  public registerCustomElement<T extends keyof IRCKitOverrideAbleComponentProps>(tag: T, opt: IRCKitDefineCustomElementOptions<IRCKitOverrideAbleComponentProps[T]>): void {
    const originTag = OverrideAbleComponentTagInner[tag];

    if (!originTag) {
      this.logger.error(LogTag.A_REGISTER_CUSTOM_ELEMENT_O, `Tag is either illegal or cannot be rewritten: OverrideAbleComponentTag[${tag}]`);
      return;
    }

    this.logger.info(LogTag.A_REGISTER_CUSTOM_ELEMENT_O, `tag: ${originTag}`);

    // 埋点记录
    this.ctx.statistic(`Override_${tag}`);

    // 获取原始组件定义，使用本次初始化唯一的自定义组件标签
    const component = overrideAbleComponents[originTag];
    const customTag = `${originTag.replace(/^rc-/, 'rc-override-')}-${this._instanceId}`;

    const ctx = this._overrideCtx;
    this._overrideAbleComponents[customTag] = {
      // 保留原始组件 props 定义
      props: { ...component.props },
      setup(props: IRCKitOverrideAbleComponentProps[T]) {
        return opt.setup(props, ctx);
      },
      // 检测 rc-origin 标签，若存在替换为默认组件标签
      template: opt.template.replace(/rc-origin/g, originTag),
      styles: opt.styles,
    };
    this._overrideAbleComponentTags[originTag] = customTag;
    setOverrideAbleComponentTags(this._overrideAbleComponentTags);
  }

  /**
   * 向浏览器注册自定义组件
   */
  public registerDOMElements(): void {
    this.logger.info(LogTag.L_REGISTER_DOM_ELEMENTS_O);

    // 可复写组件注册
    Object.entries(this._overrideAbleComponents).forEach(([tag, component]) => {
      if (!customElements.get(tag)) {
        customElements.define(tag, defineCustomElement(component));
      }
    });

    // 注册其他 Component 组件
    Object.entries(components).forEach(([tag, component]) => {
      if (!customElements.get(tag)) {
        customElements.define(tag, defineCustomElement(component));
      }
    });

    // 自定义消息组件注册
    Object.entries(this._customMessageComponents).forEach(([tag, component]) => {
      if (!customElements.get(tag)) {
        customElements.define(tag, component);
      }
    });

    // 注册 Provider 容器组件
    Object.entries(providers).forEach(([tag, provider]) => {
      if (!customElements.get(tag)) {
        customElements.define(tag, defineCustomElement(provider));
      }
    });
  }

  /**
   * 注册自定义消息
   * @param messageType
   * @param options
   */
  registerMessageType<T = any>(messageType: string, options: IRCKitRegisterMessageTypeOpts): new (content: T) => BaseMessage<T> {
    // IMLib 自定义消息注册
    const define = registerMessageType<T>(messageType, !!options.isPersited, !!options.isCounted, options.searchProps, !!options.isStatusMessage);

    // 注册消息摘要计算函数
    if (options.digest) {
      setCustomMessageDigestHandler(messageType, options.digest);
    }
    // 注册消息组件
    if (options.component) {
      const { component } = options;

      // 注册气泡消息组件，追加 `rc-custom-` 前缀，以统一业务 demo 配置时的 Web Component 标签检测
      const tag = `rc-custom-${component.tag}`;
      regMessageTypeComponentTag(messageType, tag, component.disableDefaultBubblePadding);

      const context = this._overrideCtx;

      const { setup, styles, template } = component;
      // this.registerCustomElement(tag, options.component, true);
      // 记录消息类型与组件 tag 的映射关系
      this._customMessageComponents[tag] = defineCustomElement({
        props: ['message', 'position'],
        setup(props: any) {
          return setup(props, context);
        },
        styles,
        template,
      });
    }
    return define;
  }

  public destroy(): void {
    this.ctx.dispatch(new RCKitEvent(InnerEvent.DESTROY_USER_CACHE), false);
    destroyProviderContext(this.ctx);
    destroyI18n(this.ctx);
  }
}
