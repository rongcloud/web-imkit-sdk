import {
  addEventListener,
  removeEventListener,
  Events,
  ErrorCode,
  IAReceivedMessage,
  requestSpeechToTextForMessage,
  MessageType,
} from '@rongcloud/imlib-next';
import { ILogger } from '@rongcloud/engine';
import { LogTag } from '../enums/LogTag';
import { EventDispatcher } from '../core/EventDispatcher';
import { EventDefined, InnerEvent } from '../core/EventDefined';
import { RCKitEvent } from '../core/RCKitEvent';

/**
 * 语音转文字内存态管理器
 * - 仅缓存成功结果，按 messageUId 作为 key
 * - LRU 上限 200 条
 */
export class SpeechToTextStore {
  /** 仅存储成功转换的文本结果 */
  private cache = new Map<string, string>();

  /** 正在转换中的 messageUId 集合 */
  private convertingTTSList = new Set<string>();

  /** 转换失败的 messageUId 集合（用于 UI 标记，可重试） */
  private errorTTSList = new Set<string>();

  /** 每次请求的超时计时器 */
  private timers = new Map<string, any>();

  /** 缓存最大条数（LRU） */
  static readonly MAX_CACHE_SIZE = 200;

  /** 请求超时时间（毫秒） */
  static readonly REQUEST_TIMEOUT = 30000;

  constructor(
    private readonly logger: ILogger,
    private readonly eventDispatcher?: EventDispatcher<EventDefined>,
  ) {
    addEventListener(Events.SPEECH_TO_TEXT_RESPONSE, this.#onResponse);
  }

  /** 派发状态变更事件 */
  private dispatchStateChange(
    messageUId: string,
    status: 'converting' | 'success' | 'error',
    text?: string,
    errorCode?: ErrorCode,
  ): void {
    if (this.eventDispatcher) {
      this.eventDispatcher.dispatch(
        new RCKitEvent(InnerEvent.SPEECH_TO_TEXT_STATE_CHANGE, {
          messageUId,
          status,
          text,
          errorCode,
        }),
      );
    }
  }

  /** 获取转换文本（命中缓存时返回） */
  public getSTTText(messageUId: string): string | undefined {
    return this.cache.get(messageUId);
  }

  /** 是否处于转换中 */
  public isConverting(messageUId: string): boolean {
    return this.convertingTTSList.has(messageUId);
  }

  /** 是否处于失败态 */
  public hasError(messageUId: string): boolean {
    return this.errorTTSList.has(messageUId);
  }

  /** 是否已转换成功 */
  public hasConverted(messageUId: string): boolean {
    return this.cache.has(messageUId);
  }

  /**
   * 发起语音转文字请求：若缓存命中或正在转换则直接返回 SUCCESS
   */
  public async requestForMessage(message: Pick<IAReceivedMessage, 'messageUId' | 'messageType' | 'content'>): Promise<ErrorCode> {
    const { messageUId } = message;

    if (this.cache.has(messageUId)) {
      return ErrorCode.SUCCESS;
    }

    if (this.convertingTTSList.has(messageUId)) {
      return ErrorCode.SUCCESS;
    }

    this.errorTTSList.delete(messageUId);
    this.convertingTTSList.add(messageUId);

    // 派发转换中状态事件
    this.dispatchStateChange(messageUId, 'converting');

    const opts = {
      messageType: MessageType.HQ_VOICE,
      remoteUrl: message.content.remoteUrl,
      duration: message.content.duration,
      sampleRate: message.content.sampleRate,
      numberOfChannels: message.content.numberOfChannels,
    };

    try {
      this.logger?.info(LogTag.L_STT_REQUEST_T, `[STT] request: ${messageUId}, opts: ${JSON.stringify(opts)}`);
      const { code, msg } = await requestSpeechToTextForMessage(messageUId, opts);
      this.logger?.info(LogTag.L_STT_REQUEST_R, `[STT] request response: ${messageUId}, code: ${code}`);

      if (code === ErrorCode.SUCCESS) {
        // 启动超时定时器，最终结果通过事件返回
        const timer = setTimeout(() => {
          this.timers.delete(messageUId);
          if (this.convertingTTSList.has(messageUId)) {
            this.convertingTTSList.delete(messageUId);
            this.errorTTSList.add(messageUId);
            this.logger?.warn(LogTag.D, `[STT] timeout: ${messageUId}`);
            // 派发超时失败状态事件
            this.dispatchStateChange(messageUId, 'error');
          }
        }, SpeechToTextStore.REQUEST_TIMEOUT);

        this.timers.set(messageUId, timer);
      } else {
        this.convertingTTSList.delete(messageUId);
        this.errorTTSList.add(messageUId);
        this.logger?.warn(LogTag.L_STT_REQUEST_E, `[STT] request failed: code=${code}, uid=${messageUId}, msg=${msg}`);
        // 派发请求失败状态事件
        this.dispatchStateChange(messageUId, 'error', undefined, code);
      }

      return code;
    } catch (e) {
      this.convertingTTSList.delete(messageUId);
      this.errorTTSList.add(messageUId);
      this.logger?.warn(LogTag.L_STT_REQUEST_E, `[STT] request exception: ${e}`);
      // 派发异常失败状态事件
      this.dispatchStateChange(messageUId, 'error');
      return -1;
    }
  }

  /** 事件回调：接收 SDK 转换结果 */
  #onResponse = (response: any) => {
    try {
      const { code, messageUId, sttInfo } = response || {};
      this.logger?.info(LogTag.L_STT_RESPONSE_R, `[STT] response: ${messageUId}, code: ${code}`);

      const timer = this.timers.get(messageUId);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(messageUId);
      }

      if (code === ErrorCode.SUCCESS) {
        // 写入缓存并做 LRU
        const { text } = sttInfo;
        this.cache.set(messageUId, text);
        while (this.cache.size > SpeechToTextStore.MAX_CACHE_SIZE) {
          const firstKey = this.cache.keys().next().value || '';
          this.cache.delete(firstKey);
        }

        this.errorTTSList.delete(messageUId);
        this.convertingTTSList.delete(messageUId);
        this.logger?.info(LogTag.L_STT_RESPONSE_O, `[STT] success: ${messageUId}`);
        // 派发转换成功状态事件
        this.dispatchStateChange(messageUId, 'success', text);
      } else {
        this.convertingTTSList.delete(messageUId);
        this.errorTTSList.add(messageUId);
        this.logger?.warn(LogTag.L_STT_RESPONSE_E, `[STT] failed: code=${code}, uid=${messageUId}`);
        // 派发转换失败状态事件
        this.dispatchStateChange(messageUId, 'error');
      }
    } catch (e) {
      this.logger?.warn(LogTag.L_STT_RESPONSE_E, `[STT] exception: ${e}`);
    }
  };

  /** 清理内存态数据 */
  public clearMemoryData() {
    this.cache.clear();
    this.convertingTTSList.clear();
    this.errorTTSList.clear();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }

  /** 销毁 */
  public destroy() {
    removeEventListener(Events.SPEECH_TO_TEXT_RESPONSE, this.#onResponse);
    this.clearMemoryData();
  }
}
