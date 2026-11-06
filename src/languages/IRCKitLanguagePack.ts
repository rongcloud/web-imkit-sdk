import { IRCKitLanguageEntries } from './IRCKitLanguageEntries';

/**
 * 语言行文方向
 */
export type RCKitLanguageDirection = 'ltr' | 'rtl';

/**
 * 语言包数据
 */
export interface IRCKitLanguagePack {
  /**
   * 语言包行文方向，默认 `ltr`
   */
  direction: RCKitLanguageDirection;
  /**
   * 语言包词条集合
   */
  entries: IRCKitLanguageEntries;
}
