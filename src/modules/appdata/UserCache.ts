import { LogTag } from '@lib/enums/LogTag';
import { DEFAULT_USER_PORTRAIT_SVG } from '@lib/assets';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitCommand } from '@lib/enums/RCKitCommand';
import { RCKitContext } from '@lib/core/RCKitContext';
import { BasicCache } from './BasicCache';

export interface IRCKitUserProfile {
  /**
   * 用户 ID
   */
  userId: string;
  /**
   * 用户名
   */
  name: string;
  /**
   * 头像 url
   */
  portraitUri?: string;
}

/**
 * 缓存的用户数据
 */
export interface ICacheUserProfile extends IRCKitUserProfile {
  /**
   * 标识用户数据为默认数据，必要时需要从业务获取更新数据
   */
  usingDefault: boolean;
  /**
   * 头像 url
   */
  portraitUri: string;
  /**
   * 在线状态
   */
  online: boolean;
}

export interface IRCKitUserViewProfile extends ICacheUserProfile {
  /**
   * 用户在群组内的显示昵称，仅在查询用户在群内显示数据时有值
   */
  nickname?: string,
}

export interface IRCKitUserOnlineStatus {
  /**
   * 用户 ID
   */
  userId: string;
  /**
   * 在线状态
   */
  online: boolean;
}

/**
 * 用户数据缓存模块
 */
export class UserCache extends BasicCache<ICacheUserProfile, IRCKitUserProfile> {
  protected readonly GetDefaultTag: string = LogTag.L_GET_DEFAULT_USER_PROFILE_HOOK_O;

  protected readonly GetDefaultErrorTag: string = LogTag.L_GET_DEFAULT_USER_PROFILE_HOOK_E;

  protected readonly ReqStartTag: string = LogTag.L_REQ_USER_PROFILE_HOOK_T;

  protected readonly ReqFailedTag: string = LogTag.L_REQ_USER_PROFILE_HOOK_E;

  protected readonly ReqSuccessTag: string = LogTag.L_REQ_USER_PROFILE_HOOK_R;

  constructor(
    ctx: RCKitContext,
    hook: (ids: string[]) => Promise<IRCKitUserProfile[]>,
    defaultHook?: (id: string) => IRCKitUserProfile,
  ) {
    super(ctx, hook, defaultHook);
  }

  private _isSameUserProfile(a: IRCKitUserProfile, b: IRCKitUserProfile): boolean {
    return a.name === b.name && a.userId === b.userId && a.portraitUri === b.portraitUri;
  }

  private _updateCacheUserProfile(cache: ICacheUserProfile, profile: IRCKitUserProfile): void {
    cache.name = profile.name;
    cache.portraitUri = profile.portraitUri || cache.portraitUri;
    cache.usingDefault = false;
  }

  protected _checkAndUpdateCacheData(profile: IRCKitUserProfile): { cached: ICacheUserProfile; changed: boolean; } {
    const { name, userId, portraitUri } = profile;

    let cacheProfile = this._cache.get(userId);
    let changed = false;

    if (cacheProfile) {
      if (!this._isSameUserProfile(cacheProfile, profile)) {
        // 更新缓存数据
        this._updateCacheUserProfile(cacheProfile, profile);
        changed = true;
      }
    } else {
      changed = true;
      cacheProfile = {
        name,
        userId,
        portraitUri: portraitUri || DEFAULT_USER_PORTRAIT_SVG,
        usingDefault: false,
        online: false,
      };
      this._cache.set(userId, cacheProfile);
    }

    return { changed, cached: cacheProfile };
  }

  protected _isInvalid(profile: IRCKitUserProfile): boolean {
    return (
      typeof profile !== 'object'
      || !profile.userId
      || typeof profile.userId !== 'string'
      || !profile.name
      || typeof profile.name !== 'string'
      || (!!profile.portraitUri && typeof profile.portraitUri !== 'string')
    );
  }

  protected _dispatchUpdateEvent(datas: ICacheUserProfile[]): void {
    if (datas.length === 0) {
      return;
    }

    this._ctx.dispatch(new RCKitEvent(InnerEvent.USER_PROFILES_UPDATE, datas));
  }

  protected _createDefaultCache(userId: string, defaultProfile: IRCKitUserProfile): ICacheUserProfile {
    const result: ICacheUserProfile = defaultProfile
      ? {
        ...defaultProfile,
        portraitUri: defaultProfile.portraitUri || DEFAULT_USER_PORTRAIT_SVG,
        usingDefault: true,
        online: false,
      }
      : {
        userId,
        name: userId,
        portraitUri: DEFAULT_USER_PORTRAIT_SVG,
        usingDefault: true,
        online: false,
      };
    return result;
  }

  /**
   * @param profiles
   */
  public updateUserProfile(profile: IRCKitUserProfile): void {
    const traceId = this.logger.createTraceId();
    this.logger.warn(LogTag.A_UPDATE_USER_PROFILE_T, undefined, traceId);

    // 合法性校验
    if (this._isInvalid(profile)) {
      this.logger.error(
        LogTag.A_UPDATE_USER_PROFILE_E,
        'invalid user profile',
        traceId,
      );
      return;
    }

    const { userId, name, portraitUri } = profile;

    let cacheProfile = this._cache.get(userId);
    if (cacheProfile && this._isSameUserProfile(cacheProfile, profile)) {
      this.logger.warn(
        LogTag.A_UPDATE_USER_PROFILE_R,
        `user profile not changed: ${userId}`,
        traceId,
      );
      return;
    }

    if (!cacheProfile) {
      cacheProfile = {
        userId,
        name,
        portraitUri: portraitUri || DEFAULT_USER_PORTRAIT_SVG,
        usingDefault: false,
        online: false,
      };
      this._cache.set(userId, cacheProfile);
    } else {
      this._updateCacheUserProfile(cacheProfile, profile);
    }

    this.logger.info(
      LogTag.A_UPDATE_USER_PROFILE_R,
      `userId: ${userId}, name: ${name}, portraitUri: ${portraitUri}`,
      traceId,
    );

    // 派发事件
    this._dispatchUpdateEvent([cacheProfile]);
  }

  updateUserOnlineStatus(userId: string, online: boolean): void {
    const traceId = this.logger.createTraceId();
    this.logger.info(
      LogTag.A_UPDATE_USER_ONLINE_STATE_T,
      `userId: ${userId}, online: ${online}`,
      traceId,
    );
    if (!this.store.getCommandSwitch(RCKitCommand.SHOW_USER_ONLINE_STATE)) {
      this.logger.warn(
        LogTag.A_UPDATE_USER_ONLINE_STATE_R,
        'command switch is off',
        traceId,
      );
      return;
    }
    // 提前创建的默认缓存会保留 usingDefault 标记，后续正常读取时仍会请求真实用户资料
    const profile = this.getCache([userId], true)[0];

    if (profile.online === online) {
      this.logger.warn(
        LogTag.A_UPDATE_USER_ONLINE_STATE_R,
        `user online state not changed: ${userId}`,
        traceId,
      );
      return;
    }

    profile.online = online;
    this.logger.info(
      LogTag.A_UPDATE_USER_ONLINE_STATE_R,
      `userId: ${userId}, online: ${online}`,
      traceId,
    );

    // 派发事件
    this._dispatchUpdateEvent([profile]);
  }
}
