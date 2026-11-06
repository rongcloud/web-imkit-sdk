import type { IRCKitCachedMessage } from '../modules/MessageDataModule';
import type { IRCKitDefineCustomElementOptions } from './override-able';
import { RCKitMessageComponentRenderPosition } from '../enums/RCKitMessageComponentRenderPosition';

export { RCKitMessageComponentRenderPosition };

/**
 * 消息组件 Props 数据结构定义
 */
export type IRCKitMessageComponentProps = {
  /**
   * 消息数据
   */
  message: IRCKitCachedMessage,
  /**
   * 标识组件被渲染的位置
   */
  position: RCKitMessageComponentRenderPosition
};

export interface IRCKitCustomMessageComponentOpts extends IRCKitDefineCustomElementOptions<IRCKitMessageComponentProps> {
  /**
   * 消息组件标签
   */
  tag: string
  /**
   * 是否禁用 IMKit 默认的消息气泡内容内边距，默认值为 false。
   * 设置为 true 时，自定义消息组件需自行管理与气泡边界之间的间距。
   */
  disableDefaultBubblePadding?: boolean
}

/**
 * 自定义消息注册配置
 */
export interface IRCKitRegisterMessageTypeOpts {
  /** 是否计数 */
  isCounted?: boolean
  /**
   * 消息是否存储
   * @description
   * - `true`: 消息将进入数据库存储，并将在消息列表中显示，开发者必须提供 `digest` 摘要函数，同时可定义 `component` 组件来声明其在消息列表中的展示方式。
   * - `false`: 消息不会进入数据库存储，也不会在消息列表中显示。SDK 会将消息通过 `RCKitEvents.UNSCHEDULED_MESSAGES` 事件抛给开发者自行处理。
   */
  isPersited?: boolean
  /** 是否为状态消息：状态消息不计数不存储，且不进入离线补偿，仅限在线时收取 */
  isStatusMessage?: boolean
  /** 检索消息 key，用于消息搜索匹配 */
  searchProps?: string[]
  /**
   * 消息摘要计算函数，用于自定义消息在会话列表和消息列表中的展示。
   * 在同时定义了 `component` 与 `digest` 属性的情况下，SDK 会优先使用 `component` 组件进行消息渲染。
   */
  digest?: (message: IRCKitCachedMessage, language: string) => string
  /**
   * 当 `isPersited` 为 `true` 时，可通过赋值 `component` 属性来定义相应的气泡 UI 渲染组件。
   * 当该值为空时，SDK 将通过 `digest` 摘要计算函数，渲染消息为灰条消息进行展示。
   */
  component?: IRCKitCustomMessageComponentOpts,
}
