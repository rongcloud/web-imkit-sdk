import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitEvent } from '../core/RCKitEvent';
import { LogTag } from '../enums/LogTag';
import { IRCKitLanguageEntries, RCKitLanguageDirection, languagePacks } from '../languages';
import { RCKitModule } from './RCKitModule';

export class I18nModule extends RCKitModule {
  protected _onInitUserCache(): void {
    // 无需处理
  }

  protected _onDestroyUserCache(): void {
    // 无需处理
  }

  public destroy(): void {
    // 无需处理
  }

  /**
   * 获取内置语言包词条拷贝
   * @param lang 传参确认要获取的语言包
   */
  cloneLanguageEntries(lang: string): IRCKitLanguageEntries | null {
    if (!languagePacks[lang]) {
      this.logger.error(LogTag.A_CLONE_LANGUAGE_ENTRIES_O, `Language pack '${lang}' not found.`);
      return null;
    }

    this.logger.info(LogTag.A_CLONE_LANGUAGE_ENTRIES_O, `lang: ${lang}`);
    return { ...languagePacks[lang].entries };
  }

  /**
   * 注册语言包，也可用于覆盖既有语言包；仅 `ready` 调用前有效。
   * @param lang - 语言包定义，如 `zh_CN`
   * @param entries - 语言包词条定义
   * @param direction - 语言的行文方向，默认 'LTR'; 仅当首次注册指定语言包时有效。
   */
  registerLanguagePack(lang: string, entries: IRCKitLanguageEntries, direction: RCKitLanguageDirection = 'ltr'): void {
    this.logger.info(LogTag.A_REGISTER_LANGUAGE_PACK_O, `lang: ${lang}, direction: ${direction}`);
    languagePacks[lang] = { direction, entries };
  }

  private _language: string = 'zh_CN';

  /**
   * 语言切换
   * @param lang - 要切换的目标语言
   */
  setLanguage(lang: string): void {
    if (!languagePacks[lang]) {
      this.logger.error(LogTag.A_SET_LANGUAGE_O, `Language pack '${lang}' not found.`);
      return;
    }

    if (this._language === lang) {
      this.logger.warn(LogTag.A_SET_LANGUAGE_O, `Language '${lang}' already in use.`);
      return;
    }

    this.logger.info(LogTag.A_SET_LANGUAGE_O, `current: ${this._language}, target: ${lang}`);

    const { direction } = languagePacks[lang];
    this._language = lang;

    // 派发语言包切换事件通知，以便 UI 层刷新
    this.ctx.dispatch(new RCKitEvent(InnerEvent.LANGUAGE_CHANGE, { lang, direction }));
  }

  /**
   * 获取当前使用的语言
   */
  getLanguage(): string {
    return this._language;
  }

  /**
   * 获取支持的语言列表
   * @returns
   */
  getSupportedLanguages(): string[] {
    return Object.keys(languagePacks);
  }

  /**
   * 获取当前语言下指定词条字符串定义
   * @param key
   */
  getEntryString(key: keyof IRCKitLanguageEntries): string {
    return languagePacks[this._language]?.entries[key];
  }

  /**
   * 根据 key 获取当前语言下指定词条字符串定义，如果有参数，将使用参数替换词条中的占位符
   * @param key
   * @param args
   */
  format(key: keyof IRCKitLanguageEntries, ...args: Array<string | number>): string {
    const entry = languagePacks[this._language].entries[key];
    if (!entry) {
      return key as string;
    }
    return entry.replace(/\{\d+\}/g, (match, index) => args[parseInt(match.substring(1, match.length - 1), 10)].toString());
  }
}
