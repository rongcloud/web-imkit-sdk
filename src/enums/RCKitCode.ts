import { ErrorCode } from '@rongcloud/imlib-next';

/**
 * 不可直接对外暴露，对外暴露直接使用 Number 类型
 */
export enum InnerErrorCode {
  SUCCESS = ErrorCode.SUCCESS,
  /** 会话参数无效 */
  INVALID_CONVERSATION = 39001,
  /** 任务已取消 */
  TASK_CANCEL = 39002,
  /** 会话列表尚未准备同步完毕 */
  CONVERSATION_LIST_NOT_READY = 39003,
}
