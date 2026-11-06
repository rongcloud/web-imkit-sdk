import { LogTag } from '@lib/enums/LogTag';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { InnerEvent } from '@lib/core/EventDefined';
import { DEFAULT_GROUP_PORTRAIT_SVG } from '@lib/assets';
import { RCKitContext } from '@lib/core/RCKitContext';
import { BasicCache } from './BasicCache';

export interface IRCKitGroupProfile {
  /**
   * 群组 ID
   */
  groupId: string;
  /**
   * 群组名称
   */
  name: string;
  /**
   * 群组头像 url
   */
  portraitUri?: string;
  /**
   * 群组成员数量
   */
  memberCount: number;
}

/**
 * 群组成员信息
 */
export interface IRCKitGroupMemberProfile {
  /**
   * 用户 ID
   */
  userId: string;
  /**
   * 群内显示的昵称，若无昵称，则显示用户名称
   */
  nickname?: string;
}

/**
 * 缓存的群组数据
 */
export interface ICacheGroupProfile extends IRCKitGroupProfile {
  /**
   * 正在使用默认数据，通常是由于从业务获取数据失败导致
   */
  usingDefault: boolean;
  portraitUri: string;
}

export class GroupCache extends BasicCache<ICacheGroupProfile, IRCKitGroupProfile> {
  protected readonly ReqStartTag: string = LogTag.L_REQ_GROUP_PROFILE_HOOK_T;

  protected readonly ReqFailedTag: string = LogTag.L_REQ_GROUP_PROFILE_HOOK_E;

  protected readonly ReqSuccessTag: string = LogTag.L_REQ_GROUP_PROFILE_HOOK_R;

  protected readonly GetDefaultTag: string = LogTag.L_GET_DEFAULT_GROUP_PROFILE_HOOK_O;

  protected readonly GetDefaultErrorTag: string = LogTag.L_GET_DEFAULT_GROUP_PROFILE_HOOK_E;

  /**
   * 群组成员缓存数据
   * * key: groupId
   * * value: `IRCKitGroupMemberProfile[]`
   */
  private _groupMembers: Map<string, IRCKitGroupMemberProfile[]> = new Map();

  constructor(
    ctx: RCKitContext,
    hook: (groupIds: string[]) => Promise<IRCKitGroupProfile[]>,
    private _reqGroupMembers: (groupId: string) => Promise<IRCKitGroupMemberProfile[]>,
    defaultHook?: (groupId: string) => IRCKitGroupProfile,
  ) {
    super(ctx, hook, defaultHook);
  }

  protected _checkAndUpdateCacheData(profile: IRCKitGroupProfile): { cached: ICacheGroupProfile; changed: boolean; } {
    const { name, groupId, portraitUri } = profile;

    let cacheProfile = this._cache.get(groupId);
    let changed = false;

    if (cacheProfile) {
      if (!this._isSameGroupProfile(cacheProfile, profile)) {
        // 更新缓存数据
        this._updateCacheGroupProfile(cacheProfile, profile);
        changed = true;
      }
    } else {
      changed = true;
      cacheProfile = {
        name,
        groupId,
        portraitUri: portraitUri || DEFAULT_GROUP_PORTRAIT_SVG,
        memberCount: 0,
        usingDefault: false,
      };
      this._cache.set(groupId, cacheProfile);
    }

    return { changed, cached: cacheProfile };
  }

  protected _isInvalid(profile: IRCKitGroupProfile): boolean {
    return (
      typeof profile !== 'object'
      || !profile.groupId
      || typeof profile.groupId !== 'string'
      || !profile.name
      || typeof profile.name !== 'string'
      || (!!profile.portraitUri && typeof profile.portraitUri !== 'string')
      || typeof profile.memberCount !== 'number'
      || profile.memberCount < 0
    );
  }

  private _isSameGroupProfile(a: ICacheGroupProfile, b: IRCKitGroupProfile): boolean {
    return (
      a.groupId === b.groupId
      && a.name === b.name
      && a.memberCount === b.memberCount
      && a.portraitUri === b.portraitUri
    );
  }

  protected _dispatchUpdateEvent(profiles: ICacheGroupProfile[]): void {
    if (profiles.length === 0) {
      return;
    }
    this._ctx.dispatch(new RCKitEvent(InnerEvent.GROUP_PROFILES_UPDATE, profiles));
  }

  protected _createDefaultCache(groupId: string, defaultProfile?: IRCKitGroupProfile | undefined): ICacheGroupProfile {
    const result: ICacheGroupProfile = defaultProfile
      ? {
        ...defaultProfile,
        portraitUri: defaultProfile.portraitUri || DEFAULT_GROUP_PORTRAIT_SVG,
        usingDefault: true,
      }
      : {
        groupId,
        name: `${groupId}`,
        portraitUri: DEFAULT_GROUP_PORTRAIT_SVG,
        usingDefault: true,
        memberCount: 0,
      };
    return result;
  }

  /**
   * 更新既有的缓存数据，同时 usingDefault 将被置位 false
   */
  private _updateCacheGroupProfile(
    target: ICacheGroupProfile,
    source: IRCKitGroupProfile,
  ) {
    target.name = source.name;
    target.portraitUri = source.portraitUri || target.portraitUri;
    target.memberCount = source.memberCount;
    target.usingDefault = false;
  }

  public updateGroupProfile(profile: IRCKitGroupProfile): void {
    const traceId = this.logger.createTraceId();
    this.logger.warn(LogTag.A_UPDATE_GROUP_PROFILE_T, undefined, traceId);

    // 合法性校验
    if (this._isInvalid(profile)) {
      this.logger.error(
        LogTag.A_UPDATE_GROUP_PROFILE_E,
        'invalid group profile',
        traceId,
      );
      return;
    }

    const {
      groupId, name, portraitUri, memberCount,
    } = profile;

    let cacheProfile = this._cache.get(groupId);
    if (cacheProfile && this._isSameGroupProfile(cacheProfile, profile)) {
      this.logger.warn(LogTag.A_UPDATE_GROUP_PROFILE_R, `group profile not changed: ${groupId}`, traceId);
      return;
    }

    if (!cacheProfile) {
      cacheProfile = {
        groupId,
        name,
        portraitUri: portraitUri || DEFAULT_GROUP_PORTRAIT_SVG,
        usingDefault: false,
        memberCount,
      };
      this._cache.set(groupId, cacheProfile);
    } else {
      this._updateCacheGroupProfile(cacheProfile, profile);
    }

    this.logger.info(
      LogTag.A_UPDATE_GROUP_PROFILE_R,
      `groupId: ${groupId}, name: ${name}, portraitUri: ${portraitUri}, memberCount: ${memberCount}`,
      traceId,
    );

    // 派发事件
    this._dispatchUpdateEvent([cacheProfile]);
  }

  /**
   * 拷贝群组成员信息，以避免与业务层共享内存
   */
  private _cloneGroupMember(member: IRCKitGroupMemberProfile): IRCKitGroupMemberProfile {
    const { userId, nickname } = member;
    return { userId, nickname };
  }

  /**
   * 获取群组成员信息列表
   * @param groupId - 群组 ID
   * @param ignoreCache - 是否忽略缓存，默认为 `true`
   */
  async reqGroupMembers(groupId: string, ignoreCache: boolean = true): Promise<IRCKitGroupMemberProfile[]> {
    const traceId = this.logger.createTraceId();

    if (!ignoreCache) {
      // 从缓存中获取群组成员信息
      const cacheMembers = this._groupMembers.get(groupId);
      if (cacheMembers) {
        return [...cacheMembers];
      }
    }

    let members: IRCKitGroupMemberProfile[];

    // 从业务请求群组成员信息
    try {
      this.logger.info(
        LogTag.L_REQ_GROUP_MEMBERS_HOOK_T,
        `groupId: ${groupId}`,
        traceId,
      );
      members = await this._reqGroupMembers(groupId);
    } catch (error: any) {
      this.logger.error(
        LogTag.L_REQ_GROUP_MEMBERS_HOOK_E,
        error.message,
        traceId,
      );
      return [];
    }

    // members 合法性校验
    if (!members || !Array.isArray(members)) {
      this.logger.error(
        LogTag.L_REQ_GROUP_MEMBERS_HOOK_E,
        'result must be a Array',
        traceId,
      );
      return [];
    }

    const validMembers = members
      .filter((member, index) => {
        if (this._isInvalidGroupMemberProfile(member)) {
          this.logger.error(
            LogTag.L_REQ_GROUP_MEMBERS_HOOK_E,
            `result[${index}] is invalid`,
            traceId,
          );
          return false;
        }
        return true;
      })
      .map(this._cloneGroupMember);

    this.logger.info(
      LogTag.L_REQ_GROUP_MEMBERS_HOOK_R,
      `groupId: ${groupId}, memberCount: ${members.length}`,
      traceId,
    );

    // 更新缓存
    this._groupMembers.set(groupId, validMembers);
    return validMembers;
  }

  /**
   * 刷新群组成员信息。若 SDK 发现群组成员列表与群组缓存信息中的 `memberCount` 字段不一致，
   * SDK 会内部更新群组缓存信息中的 `memberCount` 字段，并派发相关事件。
   * @param groupId - 群组 ID
   * @param members - 新的群组成员信息列表
   */
  updateGroupMembers(groupId: string, members: IRCKitGroupMemberProfile[]): void {
    const traceId = this.logger.createTraceId();
    this.logger.info(
      LogTag.A_UPDATE_GROUP_MEMBERS_T,
      `groupId: ${groupId}`,
      traceId,
    );

    // members 合法性校验
    if (!members || !Array.isArray(members)) {
      this.logger.error(
        LogTag.A_UPDATE_GROUP_MEMBERS_E,
        "param 'members' must be a Array",
        traceId,
      );
      return;
    }

    // members 中的若任意一项为非法数据，则不更新缓存
    if (
      members.some((member, index) => {
        if (this._isInvalidGroupMemberProfile(member)) {
          this.logger.error(
            LogTag.A_UPDATE_GROUP_MEMBERS_E,
            `param 'members[${index}]' is invalid`,
            traceId,
          );
          return true;
        }
        return false;
      })
    ) {
      return;
    }

    // 更新缓存
    const cache = members.map(this._cloneGroupMember);
    this._groupMembers.set(groupId, cache);
    this._dispatchGroupMembersUpdateEvent(groupId, cache);

    // 更新群组缓存信息中的 memberCount 字段
    const cacheProfile = this._cache.get(groupId);
    if (!cacheProfile) {
      this.logger.warn(
        LogTag.A_UPDATE_GROUP_MEMBERS_E,
        `group profile not found: ${groupId}`,
        traceId,
      );
    } else if (cacheProfile.memberCount !== members.length) {
      // 更新群组缓存信息中的 memberCount 字段
      cacheProfile.memberCount = members.length;
      // 派发通知事件
      this._dispatchUpdateEvent([cacheProfile]);
    }

    this.logger.info(
      LogTag.A_UPDATE_GROUP_MEMBERS_R,
      `groupId: ${groupId}, memberCount: ${members.length}`,
      traceId,
    );
  }

  /**
   * 向群组中添加成员，可能触发群组成员数量变更事件。
   * @param groupId
   * @param members
   */
  addGroupMembers(groupId: string, members: IRCKitGroupMemberProfile[]): void {
    const traceId = this.logger.createTraceId();
    this.logger.info(
      LogTag.A_ADD_GROUP_MEMBERS_T,
      `groupId: ${groupId}`,
      traceId,
    );

    // members 合法性校验
    if (!members || !Array.isArray(members)) {
      this.logger.error(
        LogTag.A_ADD_GROUP_MEMBERS_E,
        "param 'members' must be a Array",
        traceId,
      );
      return;
    }

    // members 中的若任意一项为非法数据，则不更新缓存
    const invalid = members.some((member, index) => {
      const bool = this._isInvalidGroupMemberProfile(member);
      if (bool) {
        this.logger.error(LogTag.A_ADD_GROUP_MEMBERS_E, `param 'members[${index}]' is invalid`, traceId);
      }
      return bool;
    });
    if (invalid) {
      return;
    }

    // 更新成员列表信息，注意排重
    const cacheMembers = this._groupMembers.get(groupId) || [];
    const newMembers = members.filter(
      (member) => !cacheMembers.some(
        (cacheMember) => cacheMember.userId === member.userId,
      ),
    );

    // 无新成员则不更新缓存
    if (newMembers.length === 0) {
      this.logger.warn(
        LogTag.A_ADD_GROUP_MEMBERS_R,
        `no new members to add: ${groupId}`,
        traceId,
      );
      return;
    }

    const updatedMembers = [
      ...cacheMembers,
      ...newMembers.map(this._cloneGroupMember),
    ];
    this._groupMembers.set(groupId, updatedMembers);
    this._dispatchGroupMembersUpdateEvent(groupId, updatedMembers);

    // 更新群组信息缓存
    const cacheProfile = this._cache.get(groupId);
    if (cacheProfile) {
      // 不排除群组信息和成员信息数量不一致的情况，所以这里需要重复检查
      if (cacheProfile.memberCount !== updatedMembers.length) {
        // 更新群组缓存信息中的 memberCount 字段
        cacheProfile.memberCount = updatedMembers.length;
        // 派发通知事件
        this._dispatchUpdateEvent([cacheProfile]);
      }
    } else {
      this.logger.warn(LogTag.A_ADD_GROUP_MEMBERS_E, `group profile not found: ${groupId}`, traceId);
    }

    this.logger.info(
      LogTag.A_ADD_GROUP_MEMBERS_R,
      `groupId: ${groupId}, members: ${members
        .map((member) => member.userId)
        .join(',')}`,
      traceId,
    );
  }

  /**
   * 从群组中移除成员，可能触发群组成员数量变更事件。
   * @param groupId - 群组 ID
   * @param userIds - 要移除的成员 ID 列表
   */
  removeGroupMembers(groupId: string, userIds: string[]): void {
    const traceId = this.logger.createTraceId();
    this.logger.info(
      LogTag.A_REMOVE_GROUP_MEMBERS_T,
      `groupId: ${groupId}`,
      traceId,
    );

    // memberIds 合法性校验
    if (!userIds || !Array.isArray(userIds)) {
      this.logger.error(
        LogTag.A_REMOVE_GROUP_MEMBERS_E,
        "param 'userIds' must be a Array",
        traceId,
      );
      return;
    }

    // 祛除 memberIds 中的非法数据
    const validMemberIds = userIds.filter((userId, index) => {
      if (typeof userId !== 'string' || userId.length === 0) {
        this.logger.error(
          LogTag.A_REMOVE_GROUP_MEMBERS_E,
          `param 'userIds[${index}]' is invalid`,
          traceId,
        );
        return false;
      }
      return true;
    });

    if (validMemberIds.length === 0) {
      this.logger.warn(
        LogTag.A_REMOVE_GROUP_MEMBERS_R,
        `no valid members to remove: ${groupId}`,
        traceId,
      );
      return;
    }

    const cacheMembers = this._groupMembers.get(groupId);
    if (!cacheMembers) {
      this.logger.warn(
        LogTag.A_REMOVE_GROUP_MEMBERS_E,
        `group members not found: ${groupId}`,
        traceId,
      );
      return;
    }

    // 移除成员
    const updatedMembers = cacheMembers.filter(
      (member) => !validMemberIds.includes(member.userId),
    );
    this._groupMembers.set(groupId, updatedMembers);
    this._dispatchGroupMembersUpdateEvent(groupId, updatedMembers);

    // 更新群组信息缓存
    const cacheProfile = this._cache.get(groupId);
    if (cacheProfile) {
      // 不排除群组信息和成员信息数量不一致的情况，所以这里需要重复检查
      if (cacheProfile.memberCount !== updatedMembers.length) {
        // 更新群组缓存信息中的 memberCount 字段
        cacheProfile.memberCount = updatedMembers.length;
        // 派发通知事件
        this._dispatchUpdateEvent([cacheProfile]);
      }
    } else {
      this.logger.warn(
        LogTag.A_REMOVE_GROUP_MEMBERS_E,
        `group profile not found: ${groupId}`,
        traceId,
      );
    }

    this.logger.info(
      LogTag.A_REMOVE_GROUP_MEMBERS_R,
      `groupId: ${groupId}, members: ${validMemberIds.join(',')}`,
      traceId,
    );
  }

  private _isInvalidGroupMemberProfile(
    profile: IRCKitGroupMemberProfile,
  ): boolean {
    return (
      typeof profile !== 'object'
      || !profile.userId
      || typeof profile.userId !== 'string'
      || (!!profile.nickname && typeof profile.nickname !== 'string')
    );
  }

  private _dispatchGroupMembersUpdateEvent(
    groupId: string,
    members: IRCKitGroupMemberProfile[],
  ) {
    this._ctx.dispatch(new RCKitEvent(InnerEvent.GROUP_MEMBERS_UPDATE, { groupId, members }));
  }

  public clear(): void {
    super.clear();
    this._groupMembers.clear();
  }
}
