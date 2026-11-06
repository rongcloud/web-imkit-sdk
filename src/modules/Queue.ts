import {
  BaseMessage, ErrorCode, FileType, IAReceivedMessage, IConversationOption,
  ISendMessageOptions, MessageType, createUploadTask, sendMessage, UploadTask, IUploadInfo, stopUploadTask,
} from '@rongcloud/imlib-next';
import {
  ConversationType, GroupReadReceiptVersion, isObject, SentStatus,
} from '@rongcloud/engine';
import { InnerEvent } from '@lib/core/EventDefined';
import { IRCKitUserCacheSession, RCKitContext } from '@lib/core/RCKitContext';
import { InnerErrorCode } from '@lib/enums/RCKitCode';
import { cloneByJSON } from '@lib/helper/clone';
import { IRCKitCachedMessage } from './MessageDataModule';
import { RCKitModule } from './RCKitModule';
import { RCKitEvent } from '../core/RCKitEvent';
import { LogTag } from '../enums/LogTag';

type Task<T, D> = {
  params: T,
  resolve: (value: { code: number, data?: D }) => void,
  code?: number,
  result?: D
}

type QueueTask = {
  transactionId: number;
  session: IRCKitUserCacheSession;
}

/**
 * 异步任务队列。为提升任务执行效率，任务队列内部可能会并行执行多个任务，但会保证结果按入队顺序返回。
 * @param T 任务参数类型
 * @param D 任务结果类型
 */
export abstract class BaseQueue<T extends QueueTask, D> extends RCKitModule {
  /**
   * 时间戳队列，用于计算每秒执行次数
   */
  private readonly _timestamps: number[] = [];

  /**
   * 队列数据
   */
  protected _queue: Array<Task<T, D>> = [];

  /**
   * 并行执行中的任务队列，队列长度不会超过 _parallel；
   * 队列总是从头部开始清理已完成的任务，若任务未执行完毕则终止清理；以此保证队列中的任务结果顺序与入队顺序一致。
   */
  private _executing: Array<Task<T, D>> = [];

  /**
   * 任务队列名称标识，用于日志记录
   */
  protected abstract _tag: string;

  private _timer: number = -1;

  constructor(
    ctx: RCKitContext,
    /**
     * 可并行的任务数量
     */
    private readonly _parallel: number = 5,
    /**
     * 每秒最大执行次数
    */
    private readonly _fps: number = 5,
  ) {
    super(ctx);
  }

  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    this.clear();
  }

  public destroy(): void {
    this.clear();
  }

  /**
   * 清理所有任务。执行中的发送请求无法被 SDK 中止，只能解除队列等待并丢弃其结果。
   */
  public clear(): void {
    const waiting = this._queue.splice(0);
    const executing = this._executing.splice(0);

    waiting.forEach((task) => {
      task.resolve({ code: InnerErrorCode.TASK_CANCEL, data: this._getCancelResult(task.params) });
    });

    executing.forEach((task) => {
      this._try2CancelExecutingTask(task.params.transactionId);
      task.resolve({ code: InnerErrorCode.TASK_CANCEL, data: this._getCancelResult(task.params) });
    });

    this._timestamps.length = 0;
    clearTimeout(this._timer);
    this._timer = -1;
  }

  async push(data: T): Promise<{ code: number, data?: D }> {
    return new Promise((resolve) => {
      // 加入等待队列
      this._queue.push({ params: data, resolve });
      this.logger.info(LogTag.L_PUSH_2_QUEUE_O, `${this._tag}: queue length: ${this._queue.length}`);
      this._execute();
    });
  }

  /**
   * 移除任务
   * TODO：直接移除任务，不等待队列前部任务执行完毕
   * @param transactionId
   * @description - 任务可能存在两种状态，进行中与等待中，由于任务序列要保证结果返回顺序，因此取消任务只能做标记取消，不可修改任务列表
   * @returns true 表示标记取消成功，否则为不可取消
   */
  remove(transactionId: number): boolean {
    // 1. 从等待队列中查找，若找到，标记为已取消
    let index = this._queue.findIndex((item) => item.params.transactionId === transactionId);
    if (index !== -1) {
      const task = this._queue[index];
      task.code = InnerErrorCode.TASK_CANCEL;
      return true;
    }

    // 2. 从执行队列中查找，若找到，尝试取消执行中的动作，并标记结果为已取消
    index = this._executing.findIndex((item) => item.params.transactionId === transactionId);
    if (index !== -1) {
      const task = this._executing[index];
      // 尝试取消执行中的动作，需注意，并非所有动作都可执行取消操作
      const bool = this._try2CancelExecutingTask(transactionId);
      if (bool) {
        task.code = InnerErrorCode.TASK_CANCEL;
      }
      return bool;
    }

    // 未找到任务
    return false;
  }

  /**
   * 尝试取消执行中的任务，若任务无法取消，返回 false
   * @param transactionId
   */
  protected abstract _try2CancelExecutingTask(transactionId: number): boolean;

  protected _getCancelResult(_data: T): D | undefined {
    return undefined;
  }

  protected _isCurrentTask(data: T): boolean {
    return data.session.userId === this.ctx.userId
      && data.session.generation === this.ctx.userCacheGeneration;
  }

  private async _execute(): Promise<void> {
    if (this._paused || this._queue.length === 0 || this._executing.length >= this._parallel) {
      // 等待队列为空，或并行队列已满
      return;
    }

    // 限频检查
    if (this._timestamps.length >= this._fps) {
      this.logger.warn(LogTag.L_TASK_QUEUE_EXECUTE_O, `${this._tag}: trigger limiting`);
      return;
    }

    // 限频计时器
    if (this._timer === -1) {
      this._timer = window.setTimeout(() => {
        // 重置限频检查条件
        this._timestamps.length = 0;
        this._timer = -1;
        // 重启任务执行
        this._execute();
      }, 1000);
    }

    // 取出一个任务，执行存入执行队列
    const item = this._queue.shift()!;
    this._executing.push(item);
    // 记录执行时间
    this._timestamps.push(Date.now());

    this.logger.info(LogTag.L_TASK_QUEUE_EXECUTE_O, `${this._tag}: queue length: ${this._queue.length}, executing length: ${this._executing.length}`);

    // 已标记取消或所属用户缓存已失效的任务不再执行。
    let promise: Promise<{ code: number, data?: D }>;
    if (item.code !== undefined) {
      promise = Promise.resolve({ code: item.code, data: this._getCancelResult(item.params) });
    } else if (this._isCurrentTask(item.params)) {
      promise = this._handle(item.params);
    } else {
      promise = Promise.resolve({ code: InnerErrorCode.TASK_CANCEL, data: this._getCancelResult(item.params) });
    }

    // 递归检查
    this._execute();

    // 等待任务执行结果
    const { code, data } = await promise;
    if (item.code === undefined) {
      item.code = code;
      item.result = data;
    } else {
      item.result = this._getCancelResult(item.params);
    }

    this._checkResolve();
  }

  private _checkResolve() {
    // 检查执行队列中的任务，按入队顺序清理已完成的任务
    while (this._executing.length && this._executing[0].code !== undefined) {
      const {
        resolve, code, result,
      } = this._executing.shift()!;
      resolve({ code: code!, data: result });
    }

    this._execute();
  }

  protected abstract _handle(data: T): Promise<{ code: number, data?: D }>

  private _paused: boolean = false;
}

type MessageSendQueueTask = {
  conversation: IConversationOption,
  message: IRCKitCachedMessage,
  options?: ISendMessageOptions,
  transactionId: number,
  session: IRCKitUserCacheSession,
}

/**
 * 消息发送队列
 */
export class MessageSendQueue extends BaseQueue<MessageSendQueueTask, IAReceivedMessage> {
  protected _tag: string = 'MessageSendQueue';

  constructor(ctx: RCKitContext) {
    super(ctx, 1, 5);
  }

  protected async _handle(opts: MessageSendQueueTask) {
    const { conversation, message, options } = opts;
    const { conversationType, targetId, channelId } = conversation;
    const traceId = this.logger.createTraceId();
    this.logger.info(LogTag.L_SEND_MSG_T, `type: ${message.messageType}, conversationType: ${conversationType}, targetId: ${targetId}, channelId: ${channelId || ''}`, traceId);
    const {
      isCounted, isPersited, content, messageType, quoteInfo,
    } = message;
    const baseMsg = new BaseMessage<any>(messageType, content, isPersited, isCounted);
    if (isObject(baseMsg.content)) {
      // 消息 content 进行拷贝，防止 Proxy 数据导致 Electron 发送消息报错导致消息状态一直是发送中
      try {
        baseMsg.content = cloneByJSON(baseMsg.content);
      } catch (error: any) {
        this.logger.warn(LogTag.A_SEND_MESSAGE_E, error.message);
      }
    }
    const sentOptions: ISendMessageOptions = {
      ...options,
      onSendBefore: (msg: IAReceivedMessage) => {
        if (this._isCurrentTask(opts)) {
          message.messageId = msg.messageId;
          options?.onSendBefore?.(msg);
        }
      },
      pushConfig: this.ctx.store.getPushConfig(message),
      quoteInfo,
    };

    // V5 发消息需要携带 needReceipt 参数
    if (this.ctx.readReceiptVersion === GroupReadReceiptVersion.V5) {
      // 判断是否开启已读回执
      const isSupport = [ConversationType.PRIVATE, ConversationType.GROUP].includes(conversation.conversationType);
      const isDirected = options?.isMentioned;
      if (isSupport && !isDirected) {
        sentOptions.needReceipt = true;
      }
    }

    const { code, data } = await sendMessage(conversation, baseMsg, sentOptions);
    if (code !== ErrorCode.SUCCESS) {
      this.logger.warn(LogTag.L_SEND_MSG_R, `code: ${code}`, traceId);
    } else {
      this.logger.info(LogTag.L_SEND_MSG_R, 'success', traceId);
    }
    return { code, data };
  }

  // 发送动作不可取消
  protected _try2CancelExecutingTask(transactionId: number): boolean {
    return false;
  }
}

type FileUploadQueueTask = {
  message: IRCKitCachedMessage,
  transactionId: number,
  session: IRCKitUserCacheSession,
}

/**
 * 文件上传队列
 */
export class FileUploadQueue extends BaseQueue<FileUploadQueueTask, { message: IRCKitCachedMessage, httpUrl?: string }> {
  protected _tag: string = 'FileUploadQueue';

  private _clients: Map<number, UploadTask> = new Map();

  private _getFileType(messageType: string): FileType {
    switch (messageType) {
      case MessageType.IMAGE:
      case MessageType.GIF:
        return FileType.IMAGE;
      case MessageType.SIGHT:
        return FileType.SIGHT;
      case MessageType.COMBINE:
        return FileType.COMBINE_HTML;
      default:
        return FileType.FILE;
    }
  }

  protected async _handle(task: FileUploadQueueTask) {
    const { message, transactionId } = task;
    const file = message.file!;
    const fileType = this._getFileType(message.messageType);
    const uploadInfo: IUploadInfo = {
      file,
      fileType,
      onProgress: (loaded: number, total: number) => {
        if (!this._isCurrentTask(task)) {
          return;
        }
        this.logger.debug(LogTag.L_UPLOAD_FILE_O, `name: ${file.name}, progress: ${loaded}/${total}`);
        const progress = Math.floor(loaded * 100 / total);
        message.progress = progress;
        // 派发进度事件
        this.ctx.dispatch(new RCKitEvent(InnerEvent.FILE_UPLOAD_PROGRESS, { progress, message }));
      },
    };
    const traceId = this.logger.createTraceId();
    this.logger.info(LogTag.L_UPLOAD_FILE_T, `name: ${file.name}, size: ${file.size}`, traceId);

    const res = await createUploadTask(uploadInfo);
    if (!this._isCurrentTask(task)) {
      if (res.code === ErrorCode.SUCCESS && res.data) {
        await stopUploadTask(res.data.id);
      }
      return { code: InnerErrorCode.TASK_CANCEL, data: { message } };
    }

    if (res.code !== ErrorCode.SUCCESS) {
      // 上传失败
      this.logger.warn(LogTag.L_UPLOAD_FILE_R, `code: ${res.code}`, traceId);
      return { code: res.code, data: { message } };
    }

    const client = res.data!;
    this._clients.set(transactionId, client);

    try {
      const { code, data } = await client.awaitResult();
      if (!this._isCurrentTask(task)) {
        return { code: InnerErrorCode.TASK_CANCEL, data: { message } };
      }
      if (code !== ErrorCode.SUCCESS) {
        this.logger.warn(LogTag.L_UPLOAD_FILE_R, `code: ${code}`, traceId);
        // 更新消息状态
        message.progress = -1;
        message.sentStatus = SentStatus.FAILED;
        this.ctx.dispatch(new RCKitEvent(InnerEvent.MESSAGE_STATE_CHANGE, [message]));
        return { code, data: { message } };
      }
      this.logger.info(LogTag.L_UPLOAD_FILE_R, 'success', traceId);
      return { code, data: { message, httpUrl: data!.downloadUrl } };
    } finally {
      if (this._clients.get(transactionId) === client) {
        this._clients.delete(transactionId);
      }
    }
  }

  protected _getCancelResult(task: FileUploadQueueTask) {
    return { message: task.message };
  }

  protected _try2CancelExecutingTask(transactionId: number): boolean {
    const client = this._clients.get(transactionId);
    if (client) {
      stopUploadTask(client.id);
      this._clients.delete(transactionId);
      return true;
    }
    return false;
  }
}
