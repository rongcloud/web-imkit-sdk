import { LogTag } from '@lib/enums/LogTag';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { InnerEvent } from '@lib/core/EventDefined';
import { DEFAULT_SYSTEM_PORTRAIT_SVG } from '@lib/assets';
import { BasicCache } from './BasicCache';

export interface IRCKitSystemProfile {
  /**
   * 系统会话 ID
   */
  systemId: string;
  /**
   * 系统会话名称
   */
  name: string;
  /**
   * 会话头像 url
   */
  portraitUri?: string;
}

export interface ICacheSystemProfile extends IRCKitSystemProfile {
  /**
   * 标识为默认数据，必要时需要从业务获取更新数据
   */
  usingDefault: boolean;
  portraitUri: string;
}

export class SystemCache extends BasicCache<ICacheSystemProfile, IRCKitSystemProfile> {
  protected readonly ReqStartTag: string = LogTag.L_REQ_SYSTEM_PROFILE_HOOK_T;

  protected readonly ReqFailedTag: string = LogTag.L_REQ_SYSTEM_PROFILE_HOOK_E;

  protected readonly ReqSuccessTag: string = LogTag.L_REQ_SYSTEM_PROFILE_HOOK_R;

  protected readonly GetDefaultTag: string = LogTag.L_GET_DEFAULT_SYSTEM_PROFILE_HOOK_O;

  protected readonly GetDefaultErrorTag: string = LogTag.L_GET_DEFAULT_SYSTEM_PROFILE_HOOK_E;

  protected _checkAndUpdateCacheData(profile: IRCKitSystemProfile): { cached: ICacheSystemProfile; changed: boolean; } {
    const { name, systemId, portraitUri } = profile;

    let cacheProfile = this._cache.get(systemId);
    let changed = false;

    if (cacheProfile) {
      if (!this._isSameSystemProfile(cacheProfile, profile)) {
        // 更新缓存数据
        this._updateCacheSystemProfile(cacheProfile, profile);
        changed = true;
      }
    } else {
      changed = true;
      cacheProfile = {
        name,
        systemId,
        portraitUri: portraitUri || DEFAULT_SYSTEM_PORTRAIT_SVG,
        usingDefault: false,
      };
      this._cache.set(systemId, cacheProfile);
    }

    return { changed, cached: cacheProfile };
  }

  private _isSameSystemProfile(
    a: IRCKitSystemProfile,
    b: IRCKitSystemProfile,
  ): boolean {
    return a.systemId === b.systemId && a.name === b.name && a.portraitUri === b.portraitUri;
  }

  /** 更新既有的缓存数据，同时 usingDefault 将被置位 false */
  private _updateCacheSystemProfile(
    target: ICacheSystemProfile,
    source: IRCKitSystemProfile,
  ) {
    target.name = source.name;
    target.portraitUri = source.portraitUri || target.portraitUri;
    target.usingDefault = false;
  }

  protected _isInvalid(profile: IRCKitSystemProfile): boolean {
    return (
      typeof profile !== 'object'
      || !profile.systemId
      || typeof profile.systemId !== 'string'
      || !profile.name
      || typeof profile.name !== 'string'
      || (!!profile.portraitUri && typeof profile.portraitUri !== 'string')
    );
  }

  protected _dispatchUpdateEvent(profiles: ICacheSystemProfile[]): void {
    if (profiles.length === 0) return;
    this._ctx.dispatch(new RCKitEvent(InnerEvent.SYSTEM_PROFILES_UPDATE, profiles));
  }

  protected _createDefaultCache(systemId: string, defaultProfile?: IRCKitSystemProfile | undefined): ICacheSystemProfile {
    const result: ICacheSystemProfile = defaultProfile
      ? {
        ...defaultProfile,
        portraitUri: defaultProfile.portraitUri || DEFAULT_SYSTEM_PORTRAIT_SVG,
        usingDefault: true,
      }
      : {
        systemId,
        name: `${systemId}`,
        portraitUri: DEFAULT_SYSTEM_PORTRAIT_SVG,
        usingDefault: true,
      };
    return result;
  }
}
