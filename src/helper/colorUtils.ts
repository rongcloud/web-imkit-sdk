/**
 * 颜色工具函数
 * 用于统一处理颜色格式转换
 */

/**
 * 将颜色值标准化为 CSS 颜色字符串
 * @param color - 颜色值，支持以下格式：
 *   - 数字: 0xD2E1FE 或 13820414
 *   - 16进制字符串: "#D2E1FE" 或 "D2E1FE"
 * @returns CSS 颜色字符串，格式为 "#rrggbb"
 * @example
 * normalizeColor(0xD2E1FE) // "#d2e1fe"
 * normalizeColor("#D2E1FE") // "#d2e1fe"
 * normalizeColor("D2E1FE") // "#d2e1fe"
 * normalizeColor(13820414) // "#d2e1fe"
 */
export function normalizeColor(color: number | string | undefined): string {
  if (color === undefined || color === null) {
    return '#000000';
  }

  if (typeof color === 'string') {
    // 已经是字符串，确保有 # 前缀并转为小写
    const trimmed = color.trim();
    return trimmed.startsWith('#') ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
  }

  // 数字转 16 进制
  return `#${color.toString(16).padStart(6, '0')}`;
}

/**
 * 将 16 进制颜色字符串转换为数字
 * @param hex - 16进制颜色字符串，如 "#D2E1FE" 或 "D2E1FE"
 * @returns 数字格式的颜色值
 * @example
 * hexToNumber("#D2E1FE") // 13820414
 * hexToNumber("D2E1FE") // 13820414
 */
export function hexToNumber(hex: string): number {
  const cleaned = hex.replace('#', '').trim();
  return parseInt(cleaned, 16);
}

/**
 * 将数字颜色值转换为 16 进制字符串
 * @param num - 数字格式的颜色值
 * @returns 16进制颜色字符串，格式为 "#rrggbb"
 * @example
 * numberToHex(13820414) // "#d2e1fe"
 * numberToHex(0xD2E1FE) // "#d2e1fe"
 */
export function numberToHex(num: number): string {
  return `#${num.toString(16).padStart(6, '0')}`;
}
