import enUS from './en_US';
import zhCN from './zh_CN';

import { IRCKitLanguageEntries } from './IRCKitLanguageEntries';
import { IRCKitLanguagePack, RCKitLanguageDirection } from './IRCKitLanguagePack';

export type { IRCKitLanguageEntries, IRCKitLanguagePack, RCKitLanguageDirection };

/**
 * 语言包集合，仅限内部使用
 */
export const languagePacks: Record<string, IRCKitLanguagePack> = {
  en_US: { direction: 'ltr', entries: enUS },
  zh_CN: { direction: 'ltr', entries: zhCN },
};
