import { clone } from '../helper';

/**
 * 事件基类 Event<T, D = void, R = void>
 * @template T 事件类型
 * @template D 事件实例包含的数据类型定义
 * @template R 事件处理器通过 `evt.sendResult(data)` 回传给事件派发者的数据类型定义
 */
export class RCKitEvent<T extends string, D=void, R = void> {
  /**
   * 事件处理器通过 `evt.sendResult(data)` 回传给事件派发者的数据
   * - false 表示并未等待事件处理器回传数据
   * - true 表示事件处理器已经回传了数据
   * - function 表示事件处理器正在等待回传数据
   */
  private _resolve: boolean | ((value: R | PromiseLike<R>) => void) = false;

  private _promise?: Promise<R>;

  private _stopped = false;

  private _defaultPrevented = false;

  /**
   * 事件实例包含的数据
   */
  public readonly data: D;

  constructor(
    /**
     * 事件类型
     */
    public readonly type: T,
    data?: D,
  ) {
    this.data = data!;
  }

  /**
   * @returns 是否阻止了事件的传播
   */
  public isImmediatePropagationStopped(): boolean {
    return this._stopped;
  }

  /**
   * 阻止同类型监听器的调用
   */
  public stopImmediatePropagation(): void {
    this._stopped = true;
  }

  /**
   * @returns 是否阻止了事件的默认行为
   */
  public isDefaultPrevented(): boolean {
    return this._defaultPrevented;
  }

  /**
   * 阻止事件的默认行为
   * @description 该方法不会阻止事件的传播，也并非所有事件都有默认行为
   */
  public preventDefault(): void {
    this._defaultPrevented = true;
  }

  /**
   * 向事件派发者发送数据
   * @param data
   */
  public sendResult(data: R): void {
    if (typeof this._resolve === 'function') {
      this._resolve(data);
      this._resolve = true;
      return;
    }

    const errormsg = this._resolve ? 'Cannot resubmit.' : 'There is no transaction waiting event result.';
    console.error(errormsg, 'event type:', this.type);
  }

  /**
   * 等待时间监听者回传数据
   * @returns
   */
  public async awaitResult(): Promise<R> {
    if (!this._promise) {
      this._promise = new Promise<R>((resolve) => {
        this._resolve = resolve;
      });
    }
    return this._promise;
  }

  /**
   * 克隆事件实例
   * @param ignoreResult 是否忽略回传数据，若为 true，则克隆的事件实例通过 `evt.sendResult(data)` 无法回传数据
   * @returns
   */
  public clone(ignoreResult: boolean): RCKitEvent<T, D, R> {
    const evt: RCKitEvent<T, D, R> = new RCKitEvent(this.type, clone(this.data));
    if (!ignoreResult) {
      evt.sendResult = this.sendResult.bind(this);
    }
    return evt;
  }
}
