import { ref, computed, ComputedRef } from 'vue';
import { EventDefined, InnerEvent } from '@lib/core/EventDefined';
import { RCKitContext } from '../core/RCKitContext';
import { IRCKitLanguageEntries, RCKitLanguageDirection, languagePacks } from '../languages';

/**
 * 当前语言行文方向
 */
export const direction = ref<RCKitLanguageDirection>('ltr');

/**
 * 当前使用的语言包
 */
export const lang = ref('zh_CN');

let i18nContext: RCKitContext | null = null;

const onLanguageChange = (event: EventDefined['LANGUAGE_CHANGE']): void => {
  lang.value = event.data.lang;
  direction.value = event.data.direction;
};

export function destroy(ctx: RCKitContext): void {
  if (i18nContext !== ctx) {
    return;
  }
  ctx.removeEventListener(InnerEvent.LANGUAGE_CHANGE, onLanguageChange);
  i18nContext = null;
  lang.value = 'zh_CN';
  direction.value = 'ltr';
}

export function init(ctx: RCKitContext): void {
  if (i18nContext) {
    // i18n 与 Provider 一样保持单实例，后初始化实例接管全局语言状态。
    destroy(i18nContext);
  }
  i18nContext = ctx;
  ctx.addEventListener(InnerEvent.LANGUAGE_CHANGE, onLanguageChange);
}

/**
 * 多语言数据匹配，返回计算属性，当语言变更时，自动变更显示
 */
export function $t(key: keyof IRCKitLanguageEntries, ...args: Array<string | number>): ComputedRef<string> {
  return computed(() => $tt(key, ...args));
}

/**
 * 获取当前语言环境下指定词条的字符串定义
 */
export function $tt(key: keyof IRCKitLanguageEntries, ...args: Array<string | number>): string {
  const entry = languagePacks[lang.value].entries[key as keyof IRCKitLanguageEntries];
  if (!entry) {
    return key as string;
  }
  if (args.length === 0) {
    return entry;
  }
  return entry.replace(/\{\d+\}/g, (match, index) => args[parseInt(match.substring(1, match.length - 1), 10)].toString());
}

/**
 * 查询指定词条在当前语言环境下是否有定义
 * @param key
 * @returns
 */
export function $has(key: keyof IRCKitLanguageEntries): boolean {
  return !!languagePacks[lang.value].entries[key as keyof IRCKitLanguageEntries];
}
