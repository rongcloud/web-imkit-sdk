import { RCKitContext } from '@lib/core/RCKitContext';
import { ILogger } from '@rongcloud/engine';
import { RCKitStore } from '../RCKitStore';

export interface ICachedData {
  usingDefault: boolean;
}

/**
 * 业务数据缓存模块
 * @description - 处理并行请求，缓存数据，更新数据，控制请求频率
 */
export abstract class BasicCache<T extends ICachedData, D> {
  protected _cache: Map<string, T> = new Map();

  protected abstract readonly ReqStartTag: string;

  protected abstract readonly ReqFailedTag: string;

  protected abstract readonly ReqSuccessTag: string;

  protected abstract readonly GetDefaultTag: string;

  protected abstract readonly GetDefaultErrorTag: string;

  protected readonly logger: ILogger;

  protected readonly store: RCKitStore;

  constructor(
    protected _ctx: RCKitContext,
    protected _hook: (ids: string[]) => Promise<D[]>,
    protected _defaultHook?: (id: string) => D,
  ) {
    this.logger = _ctx.logger;
    this.store = _ctx.store;
  }

  /**
   * 检测缓存数据是否与请求数据一致，如果不一致，则更新缓存数据。
   * @param data
   */
  protected abstract _checkAndUpdateCacheData(data: D): { cached: T; changed: boolean };

  /**
   * 验证数据业务钩子返回的数据是否非法
   * @param data
   */
  protected abstract _isInvalid(data: D): boolean;

  /**
   * 派发更新通知
   * @param datas
   */
  protected abstract _dispatchUpdateEvent(datas: T[]): void;

  private _requesting: Map<string, Promise<D[]>> = new Map();

  private _waitingList: Set<string> = new Set();

  private _waitingPromise: Promise<void> | undefined;

  /**
   * 将 id 列表推入等待列表，并直到等待队列内容请求完成后返回
   * @param ids
   */
  private async _push2Waiting(ids: string[]): Promise<void> {
    if (this._waitingPromise) {
      // 有等待队列，将新的 id 列表推入等待队列
      ids.forEach((id) => this._waitingList.add(id));
    } else {
      // 没有等待队列，创建等待队列，并在 200ms 后发起请求
      this._waitingList = new Set(ids);
      this._waitingPromise = new Promise((resolve) => {
        setTimeout(() => {
          const list = [...this._waitingList];
          this._waitingList.clear();
          this._request(list);
          this._waitingPromise = undefined;
          resolve();
        }, 200);
      });
    }

    // 等待请求发出
    await this._waitingPromise;
    // 等待请求完成
    await Promise.all(ids.map((id) => this._requesting.get(id)!));
  }

  /**
   * @param ids - ID 列表
   */
  private async _request(ids: string[]): Promise<void> {
    const traceId = this.logger.createTraceId();

    let promise: Promise<D[]> | undefined;
    try {
      this.logger.info(this.ReqStartTag, ids.join(','), traceId);
      // 向业务发起请求
      promise = this._hook(ids);
      // 记录请求
      ids.forEach((id) => {
        this._requesting.set(id, promise!);
      });
      const result: D[] = await promise;
      if (result instanceof Array === false) {
        this.logger.error(this.ReqFailedTag, 'result must be a Array', traceId);
        return;
      }

      const updateList: T[] = [];
      const validResult: D[] = result.filter((data, index) => {
        const bool = !this._isInvalid(data);
        if (!bool) {
          this.logger.warn(this.ReqFailedTag, `invalid value in position ${index}`, traceId);
          // 补充打印错误数据，方便开发者排查问题；不要将 profile 写入日志，因为 profile 可能无法序列化
          console.error(`invalid value in position ${index}: `, data);
        } else {
          const { cached, changed } = this._checkAndUpdateCacheData(data);
          if (changed) {
            updateList.push(cached);
          }
        }
        return bool;
      });

      // 派发更新事件
      if (updateList.length > 0) {
        this._dispatchUpdateEvent(updateList);
      }

      this.logger.info(this.ReqSuccessTag, `valid value length: ${validResult.length}`, traceId);
    } catch (error: any) {
      this.logger.error(this.ReqFailedTag, error.message, traceId);
    } finally {
      // _requesting 只用于合并进行中的请求，已完成请求必须移除才能支持后续强制刷新。
      ids.forEach((id) => {
        if (this._requesting.get(id) === promise) {
          this._requesting.delete(id);
        }
      });
    }
  }

  /**
   * 从业务层请求数据，当数据请求成功后，会更新缓存数据并派发更新通知。
   * @param ids - ID 列表
   * @param ignoreCache - 是否忽略缓存
   */
  public async reqData(ids: string[], ignoreCache: boolean = false): Promise<T[]> {
    if (ids.length === 0) {
      return [];
    }

    const needRequestIds: string[] = ignoreCache
      ? ids.slice()
      : ids.filter((id) => {
        const profile = this._cache.get(id);
        return !profile || profile.usingDefault;
      });

    // 无需更新缓存
    if (needRequestIds.length === 0) {
      return this.getCache(ids, true);
    }

    // 对 needRequestIds 进行分组，筛选出已经在请求中的 id 和需要新发起请求的 id
    const inRequestingList: Promise<any>[] = [];
    const reqIds: string[] = [];

    needRequestIds.forEach((id) => {
      const reqPromise = this._requesting.get(id);
      if (reqPromise) {
        if (!inRequestingList.includes(reqPromise)) {
          inRequestingList.push(reqPromise);
        }
      } else {
        reqIds.push(id);
      }
    });

    if (reqIds.length > 0) {
      inRequestingList.push(this._push2Waiting(reqIds));
    }

    if (inRequestingList.length > 0) {
      await Promise.all(inRequestingList);
    }

    // 重新根据 ids 顺序获取缓存记录
    return this.getCache(ids, true);
  }

  /**
   * 同步获取缓存数据。当无缓存记录，则返回默认数据，同时向业务发起数据请求。
   * 请求是异步发起的，待数据请求完成后，会更新缓存数据并派发通知。
   * @param ids - ID 列表
   * @param cancelReq - 取消请求检查，当为 true 时，不会向业务发起数据请求
   */
  public getCache(ids: string[], cancelReq?: boolean): T[] {
    if (ids.length === 0) {
      return [];
    }

    // 记录需要从业务请求的 id 列表
    const needRequestIds: string[] = [];

    const profiles: T[] = ids.map((id) => {
      const profile = this._cache.get(id);
      if (profile) {
        // 如果用户信息使用默认数据，需要从业务请求
        if (profile.usingDefault) {
          needRequestIds.push(id);
        }
        return profile;
      }

      needRequestIds.push(id);

      // 创建默认数据
      const defaultProfile: T = this._getDefaultCache(id);
      // 以默认数据更新缓存记录
      this._cache.set(id, defaultProfile);
      return defaultProfile;
    });

    if (!cancelReq && needRequestIds.length > 0) {
      this.reqData(needRequestIds, true);
    }

    return profiles;
  }

  private _getDefaultCache(id: string): T {
    let defaultProfile: D | undefined;

    if (this._defaultHook) {
      this.logger.info(this.GetDefaultTag, `id: ${id}`);
      try {
        defaultProfile = this._defaultHook(id);
      } catch (error: any) {
        this.logger.error(this.GetDefaultErrorTag, error.message);
      }

      if (defaultProfile && this._isInvalid(defaultProfile)) {
        this.logger.error(this.GetDefaultErrorTag, `id: ${id}`);
        defaultProfile = undefined;
      }
    }

    const result: T = this._createDefaultCache(id, defaultProfile);
    return result;
  }

  /**
   * 创建默认数据
   * @param id - ID
   * @param defaultProfile - 从业务层获取到的默认数据
   */
  protected abstract _createDefaultCache(id: string, defaultProfile?: D): T;

  public clear(): void {
    this._cache.clear();
  }
}
