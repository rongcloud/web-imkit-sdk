import { QuoteMessageStatus } from '@rongcloud/imlib-next';

export enum RCKitQuoteMessageStatus {
  /** 引用消息加载中 */
  LOADING = 0,
  /** 引用消息已删除 */
  DELETED = QuoteMessageStatus.DELETED,
  /** 引用消息已撤回 */
  RECALLED = QuoteMessageStatus.RECALLED,
  /** 引用消息加载失败 */
  LOAD_ERROR = 4,
  /** 引用消息加载成功 */
  LOADED = 5,
}
