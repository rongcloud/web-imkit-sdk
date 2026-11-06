/** 群组会话中的汇总 @ 信息类型 */
export enum RCKitMentionedType {
  /**
   * 无 @ 信息
   */
  NONE = 0,
  /**
   * 有人在群内 @ 所有人
   */
  AT_ALL = 1,
  /**
   * 有人在群内 @ 我
   */
  AT_ME = 2,
}
