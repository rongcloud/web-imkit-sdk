/**
 * 消息组件被渲染位置位置标识，开发者可根据不同的渲染位置调整 UI 状态
 */
export enum RCKitMessageComponentRenderPosition {
  /**
   * 消息列表渲染
   */
  MESSAGE_LIST = 0,
  /**
   * 显示在消息被引用时
   */
  QUOTE_INFO = 1,
}
