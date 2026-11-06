import { RCKitContext } from '../../core/RCKitContext';
import { RCKitModule } from '../RCKitModule';
import {
  IRCKitUserProfile, ICacheUserProfile, UserCache, IRCKitUserOnlineStatus, IRCKitUserViewProfile,
} from './UserCache';
import {
  IRCKitGroupProfile, ICacheGroupProfile, GroupCache, IRCKitGroupMemberProfile,
} from './GroupCache';
import { ICacheSystemProfile, IRCKitSystemProfile, SystemCache } from './SystemCache';

export interface IRCKitServiceHooks {
  /**
   * 根据 userId 批量获取用户信息
   * @param userIds - 用户 ID 列表
   */
  reqUserProfiles(userIds: string[]): Promise<IRCKitUserProfile[]>;
  /**
   * 根据 groupId 批量获取群组信息
   * @param groupIds - 群组 ID 列表
   */
  reqGroupProfiles(groupIds: string[]): Promise<IRCKitGroupProfile[]>;
  /**
   * 批量获取系统会话信息，当会话列表中存在 ConversationType.SYSTEM 类型时，会调用此方法获取系统会话信息
   * @param targetIds - 系统会话 ID 列表
   */
  reqSystemProfiles(targetIds: string[]): Promise<IRCKitSystemProfile[]>;
  /**
   * 获取群组成员信息
   * @param groupId - 群组 ID
  */
  reqGroupMembers(groupId: string): Promise<IRCKitGroupMemberProfile[]>;
  /**
    * [可选]定义默认用户信息，以替换 SDK 默认初始数据，如头像、名称规则等
    * @param userId - 用户 ID
    */
  getDefaultUserProfile?(userId: string): IRCKitUserProfile;
  /**
    * [可选]定义默认群组信息，以替换 SDK 默认数据，，如头像、名称规则等
    * @param groupId - 群组 ID
    */
  getDefaultGroupProfile?(groupId: string): IRCKitGroupProfile;
  /**
    * [可选]定义默认系统会话信息，以替换 SDK 默认数据，，如头像、名称规则等
    * @param systemId - 系统会话 ID
    */
  getDefaultSystemProfile?(systemId: string): IRCKitSystemProfile;
  /**
   * @deprecated - 开发者需要自行调用 `updateUserOnlineStatus` 来主动维护用户在线状态
   */
  reqUserOnlineStatus?(userIds: string[]): Promise<IRCKitUserOnlineStatus[]>;
}

/**
 * 业务数据模块
 */
export class AppDataModule extends RCKitModule {
  /**
   * 用户数据缓存
   */
  private _users: UserCache;

  /**
   * 群组数据缓存
   */
  private _groups: GroupCache;

  /**
   * 系统会话数据缓存
   */
  private _systems: SystemCache;

  constructor(ctx: RCKitContext, private _hooks: IRCKitServiceHooks) {
    super(ctx);

    this._users = new UserCache(ctx, this._hooks.reqUserProfiles, this._hooks.getDefaultUserProfile);
    this._groups = new GroupCache(ctx, this._hooks.reqGroupProfiles, this._hooks.reqGroupMembers, this._hooks.getDefaultGroupProfile);
    this._systems = new SystemCache(ctx, this._hooks.reqSystemProfiles, this._hooks.getDefaultSystemProfile);
  }

  protected _onInit(): void {
    // 无需实现
  }

  protected _onInitUserCache(): void {
    // 业务数据不存在对某个具体的人的特殊存储，因此不需要清理和重新初始化，缓存数据对所有登录用户有效
  }

  protected _onDestroyUserCache(): void {
    // 业务数据不存在对某个具体的人的特殊存储，因此不需要清理和重新初始化，缓存数据对所有登录用户有效
  }

  public destroy(): void {
    this._systems.clear();
    this._users.clear();
    this._groups.clear();
  }

  /**
   * 从业务请求用户信息，当用户信息新增或有变更时，对外派发用户信息更新事件
   * @param userIds - 用户 ID 列表
   * @param ignoreCache - 是否忽略缓存
   */
  async requestUserProfiles(userIds: string[], ignoreCache: boolean = false): Promise<ICacheUserProfile[]> {
    return this._users.reqData(userIds, ignoreCache);
  }

  /**
   * 从业务请求系统会话信息，当系统会话信息新增或有变更时，对外派发系统会话信息更新事件
   * @param systemIds - 系统会话 ID 列表
   * @param ignoreCache - 是否忽略缓存
   */
  async requestSystemProfiles(systemIds: string[], ignoreCache: boolean = false): Promise<ICacheSystemProfile[]> {
    return this._systems.reqData(systemIds, ignoreCache);
  }

  /**
   * 从业务请求群组信息，当群组信息新增或有变更时，对外派发群组信息更新事件
   * @param groupIds - 群组 ID 列表
   * @param ignoreCache - 是否忽略缓存
   */
  async requestGroupProfiles(groupIds: string[], ignoreCache: boolean = false): Promise<ICacheGroupProfile[]> {
    return this._groups.reqData(groupIds, ignoreCache);
  }

  /**
   * 获取用户信息
   * @param userId
   */
  getUserProfile(userId: string): ICacheUserProfile {
    return this.getUserProfiles([userId])[0];
  }

  getGroupProfile(groupId: string): ICacheGroupProfile {
    return this.getGroupProfiles([groupId])[0];
  }

  /**
   * 同步获取用户信息。当用户信息无缓存记录，则返回默认数据，同时向业务发起数据请求。
   * 请求是异步发起的，待数据请求完成后，会更新缓存数据并派发通知。
   * @param userIds - 用户 ID 列表
   * @param cancelReq - 取消请求检查，当为 true 时，不会向业务发起数据请求
   */
  getUserProfiles(userIds: string[], cancelReq: boolean = false): ICacheUserProfile[] {
    return this._users.getCache(userIds, cancelReq);
  }

  /**
   * 同步获取系统会话信息。当系统会话信息无缓存记录，则返回默认数据，同时向业务发起数据请求。
   * 请求是异步发起的，待数据请求完成后，会更新缓存数据并派发通知。
   * @param systemIds - 系统会话 ID 列表
   * @param cancelReq - 取消必要请求时的请求动作
   */
  getSystemProfiles(systemIds: string[], cancelReq: boolean = false): ICacheSystemProfile[] {
    return this._systems.getCache(systemIds, cancelReq);
  }

  /**
   * 同步获取群组信息。当群组信息无缓存记录，则返回默认数据，同时向业务发起数据请求。
   * 请求是异步发起的，待数据请求完成后，会更新缓存数据并派发通知。
   * @param groupIds - 群组 ID 列表
   * @param cancelReq - 取消必要请求时的请求动作
   */
  getGroupProfiles(groupIds: string[], cancelReq: boolean = false): ICacheGroupProfile[] {
    return this._groups.getCache(groupIds, cancelReq);
  }

  /**
   * 强制更新用户信息，若用户信息有变更，将对外派发用户信息更新通知。
   * 注意：仅限业务层调用
   * @param profile
   */
  updateUserProfile(profile: IRCKitUserProfile): void {
    this._users.updateUserProfile(profile);
  }

  /**
   * 更新群组信息
   * @param profile
   */
  updateGroupProfile(profile: IRCKitGroupProfile): void {
    this._groups.updateGroupProfile(profile);
  }

  /**
   * 更新用户在线状态
   * @param userId 用户 ID
   * @param online 在线状态
   */
  updateUserOnlineStatus(userId: string, online: boolean): void {
    this._users.updateUserOnlineStatus(userId, online);
  }

  /**
   * 获取群组成员信息列表
   * @param groupId - 群组 ID
   * @param ignoreCache - 是否忽略缓存，默认为 `true`
   */
  async reqGroupMembers(groupId: string, ignoreCache: boolean = true): Promise<IRCKitGroupMemberProfile[]> {
    return this._groups.reqGroupMembers(groupId, ignoreCache);
  }

  /**
   * 刷新群组成员信息。若 SDK 发现群组成员列表与群组缓存信息中的 `memberCount` 字段不一致，
   * SDK 会内部更新群组缓存信息中的 `memberCount` 字段，并派发相关事件。
   * @param groupId - 群组 ID
   * @param members - 新的群组成员信息列表
   */
  updateGroupMembers(groupId: string, members: IRCKitGroupMemberProfile[]): void {
    return this._groups.updateGroupMembers(groupId, members);
  }

  /**
   * 向群组中添加成员，可能触发群组成员数量变更事件。
   * @param groupId
   * @param members
   */
  addGroupMembers(groupId: string, members: IRCKitGroupMemberProfile[]): void {
    return this._groups.addGroupMembers(groupId, members);
  }

  /**
   * 从群组中移除成员，可能触发群组成员数量变更事件。
   * @param groupId - 群组 ID
   * @param userIds - 要移除的成员 ID 列表
   */
  removeGroupMembers(groupId: string, userIds: string[]): void {
    return this._groups.removeGroupMembers(groupId, userIds);
  }

  /**
   * 请求用户用于显示的数据信息
   * @param userIds - 待请求用户 id 列表
   * @param groupId 当需要优先显示用于处于群内的昵称时，需要传递该指定群组 ID
   */
  async requestUserViewProfiles(
    userIds: string[],
    groupId?: string,
  ): Promise<Map<string, IRCKitUserViewProfile>> {
    const result: Map<string, IRCKitUserViewProfile> = new Map();
    const profiles = await this.requestUserProfiles(userIds);
    profiles.forEach((item) => {
      result.set(item.userId, { ...item });
    });
    if (groupId) {
      const members = await this.reqGroupMembers(groupId);
      members.forEach((item) => {
        const profile = result.get(item.userId);
        if (profile) {
          profile.nickname = item.nickname;
        }
      });
    }
    return result;
  }
}
