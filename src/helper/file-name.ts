interface IntlSegmenterLike {
  segment(value: string): Iterable<{ segment: string }>;
}

type IntlWithSegmenter = typeof Intl & {
  Segmenter?: new (
    locales?: string | string[],
    options?: { granularity: 'grapheme' },
  ) => IntlSegmenterLike;
};

const Segmenter = typeof Intl !== 'undefined'
  ? (Intl as IntlWithSegmenter).Segmenter
  : undefined;
const graphemeSegmenter = typeof Segmenter === 'function'
  ? new Segmenter(undefined, { granularity: 'grapheme' })
  : null;

/**
 * 将文本拆分为用户可感知字符。旧环境降级为 code point，至少避免截断 UTF-16 代理对。
 */
const splitGraphemes = (value: string): string[] => {
  if (!graphemeSegmenter) {
    return Array.from(value);
  }
  return Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment);
};

const FILE_NAME_TAIL_MAX_LENGTH = 12;
const FILE_NAME_EXTENSION_MAX_LENGTH = 10;

/** 保留短扩展名及其前一个字符，长名称的前缀由布局负责省略。 */
export const splitFileNameForDisplay = (name: string): { prefix: string; tail: string } => {
  const characters = splitGraphemes(name);
  const dotIndex = characters.lastIndexOf('.');
  const extensionLength = characters.length - dotIndex - 1;
  const hasValidExtension = dotIndex > 0
    && extensionLength > 0
    && extensionLength <= FILE_NAME_EXTENSION_MAX_LENGTH;
  const tailStart = hasValidExtension
    ? dotIndex - 1
    : Math.max(0, characters.length - FILE_NAME_TAIL_MAX_LENGTH);

  return {
    prefix: characters.slice(0, tailStart).join(''),
    tail: characters.slice(tailStart).join(''),
  };
};

/**
 * 格式化超长文件名，保留文件名首尾并在中间显示省略号。
 * @param name 文件名
 * @param maxLength 最大显示字符数，包含三个英文句点
 * @param endLength 结尾保留字符数
 */
export const formatFileName = (name: string, maxLength: number = 40, endLength: number = 8): string => {
  if (!name) return name;

  const graphemes = splitGraphemes(name);
  if (graphemes.length <= maxLength) return name;

  const startLength = maxLength - endLength - 3;
  if (startLength <= 0) return name;

  return `${graphemes.slice(0, startLength).join('')}...${graphemes.slice(-endLength).join('')}`;
};
