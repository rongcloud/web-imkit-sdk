import { InnerEvent } from './EventDefined';
import { RCKitEvent } from './RCKitEvent';

type Item = {
  target: any,
  once?: boolean,
  listener: any;
}

export class EventDispatcher<T> {
  private _listeners: Map<string | keyof T, Item[]> = new Map();

  addEventListener<K extends keyof T>(type: K | string, listener: (evt: T[K]) => void, target?: any): void {
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.push({ target, listener });
    } else {
      this._listeners.set(type, [{ target, listener }]);
    }
  }

  onceEventListener<K extends keyof T>(type: K | string, listener: (evt: T[K]) => void, target?: any): void {
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.push({ target, listener, once: true });
    } else {
      this._listeners.set(type, [{ target, listener, once: true }]);
    }
  }

  removeEventListener<K extends keyof T>(type: K | string, listener: (evt: T[K]) => void, target?: any): void {
    const listeners = this._listeners.get(type);
    if (listeners) {
      const index = listeners.findIndex((item) => item.listener === listener && item.target === target);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private _removeListenerItem(type: string, item: Item): void {
    const listeners = this._listeners.get(type);
    const index = listeners?.indexOf(item) ?? -1;
    if (listeners && index !== -1) {
      listeners.splice(index, 1);
    }
  }

  removeEventListeners(type: string | keyof T): void {
    this._listeners.delete(type);
  }

  removeAllEventListeners(): void {
    this._listeners.clear();
  }

  /**
   * 派发事件，以同步或异步的方式执行事件监听器。
   * @description
   * 当 `defer` 为 `true` 时，会将事件监听器的执行推迟到下一个事件循环中，而非立即执行。
   * 监听器执行过程中新增的监听器从下一次派发起生效；执行前被移除的监听器不再调用。
   * @param event - 事件对象
   * @param defer - 异步执行事件监听器，默认为 `true`。
   */
  dispatch<K extends keyof T>(event: T[K], defer: boolean = true): void {
    if (defer) {
      setTimeout(() => this._handleDispatchEvent(event), 0);
    } else {
      this._handleDispatchEvent(event);
    }
  }

  private _handleDispatchEvent<K extends keyof T>(_evt: T[K]): void {
    const event: RCKitEvent<string> = _evt as any;
    const listeners = this._listeners.get(event.type);

    if (__DEV__ && ![InnerEvent.FILE_UPLOAD_PROGRESS, InnerEvent.AUDIO_PLAY_EVENT].includes(event.type as InnerEvent)) {
      console.debug('dispatchEvent -> type: ', event.type, ' data: ', event.data);
    }

    if (!listeners || listeners.length === 0) {
      return;
    }

    // 遍历快照，避免移除监听器导致后续项被跳过。
    for (const item of [...listeners]) {
      if (event.isImmediatePropagationStopped()) {
        return;
      }

      // 派发过程中已移除的注册项不再执行，包括嵌套派发已消耗的 once 项。
      if (!this._listeners.get(event.type)?.includes(item)) {
        continue;
      }

      const { target, once, listener } = item;
      // 调用前按注册项移除，避免递归派发重复执行或误删同函数的其他注册项。
      if (once) {
        this._removeListenerItem(event.type, item);
      }

      try {
        listener.call(target, event);
      } catch (error) {
        console.error(error);
      }
    }
  }
}
