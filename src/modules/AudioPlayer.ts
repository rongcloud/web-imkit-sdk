import { InnerEvent, AudioPlayState } from '../core/EventDefined';
import { RCKitEvent } from '../core/RCKitEvent';
import { RCKitModule } from './RCKitModule';

/**
 * 音频管理模块，记录当前播放进度，提供播放、暂停、停止等方法
 * @description 同一时刻仅允许播放一条音频
 */
export class AudioPlayer extends RCKitModule {
  private _audio: HTMLAudioElement = new Audio();

  private _status: 'playing' | 'stopped' = 'stopped';

  private _progress: number = 0;

  private _messageUId: string = '';

  private _transactionId: number = 0;

  private _playRequestId: number = 0;

  protected _onInitUserCache(): void {
    this._audio.addEventListener('ended', this._onEnded);
    this._audio.addEventListener('timeupdate', this._onTimeUpdate);
    this._audio.addEventListener('error', this._onError);
  }

  protected _onDestroyUserCache(): void {
    this._audio.removeEventListener('ended', this._onEnded);
    this._audio.removeEventListener('timeupdate', this._onTimeUpdate);
    this._audio.removeEventListener('error', this._onError);
    this.stop();
  }

  public destroy(): void {
    this.ctx.removeEventListener(InnerEvent.DESTROY_USER_CACHE, this._onDestroyUserCache, this);
    this.ctx.removeEventListener(InnerEvent.INIT_USER_CACHE, this._onInitUserCache, this);
    this._onDestroyUserCache();
  }

  private _onError = () => {
    this._progress = 0;
    this._status = 'stopped';
    this._dispatch();
  }

  private _onTimeUpdate = () => {
    if (this._status === 'stopped') {
      // 停止播放后，audio 会继续触发 timeupdate 事件，需要进行屏蔽
      return;
    }
    const { currentTime, duration } = this._audio;
    this._progress = Math.floor(currentTime / duration * 100);
    this._dispatch();
  }

  private _onEnded = () => {
    this._progress = 100;
    this._status = 'stopped';
    this._dispatch();
  }

  /**
   * 获取当前播放状态
   */
  public getCurrentState(): AudioPlayState {
    return {
      progress: this._progress,
      status: this._status,
      messageUId: this._messageUId,
      transactionId: this._transactionId,
    };
  }

  private _dispatch() {
    this.ctx.dispatch(new RCKitEvent(InnerEvent.AUDIO_PLAY_EVENT, this.getCurrentState()), false);
  }

  private _playAudio(): void {
    const requestId = ++this._playRequestId;
    this._audio.play().catch((error: DOMException) => {
      // 暂停、停止或后续播放会使旧请求失效，即使再次播放的是同一资源。
      if (requestId !== this._playRequestId || error.name === 'AbortError' || this._status === 'stopped') {
        return;
      }
      this._onError();
    });
  }

  /**
   * 播放音频
   * @param url 音频地址
   * @param messageUId 音频资源所属的消息 uid，本地上行消息可能为 ''
   * @param transactionId 本地上行消息的 transactionId，上行消息无 uid，因此需要传递 transactionId 以标识唯一消息
   */
  play(url: string, messageUId: string, transactionId?: number): void {
    if ((this._messageUId && this._messageUId === messageUId) || (this._transactionId && this._transactionId === transactionId)) {
      // 继续播放
      if (this._status === 'stopped') {
        this._status = 'playing';
        this._playAudio();
        this._onTimeUpdate();
      }
      return;
    }

    this._status = 'playing';
    this._messageUId = messageUId;
    this._transactionId = 0;
    this._progress = 0;

    this._audio.src = url;
    this._playAudio();
    this._dispatch();
  }

  /**
   * 停止播放，并清空播放进度
   */
  stop() {
    this._playRequestId += 1;
    this._status = 'stopped';
    this._messageUId = '';
    this._transactionId = 0;
    this._progress = 0;

    if (this._audio.src) {
      this._audio.pause();
      this._audio.removeAttribute('src');
      this._audio.load();
    }
    this._dispatch();
  }

  /**
   * 暂停播放，进行中的播放进度
   */
  pause() {
    if (this._status === 'stopped') {
      return;
    }
    this._playRequestId += 1;
    this._status = 'stopped';
    this._audio.pause();
    this._dispatch();
  }
}
