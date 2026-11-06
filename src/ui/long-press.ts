/**
 * iOS Safari 的触摸长按不派发 contextmenu 事件（Android 会派发），
 * 消息/会话菜单在 iOS 上需要用 touch 事件自行检测长按后复用 contextmenu 的菜单逻辑。
 */

interface ILongPressPoint {
  clientX: number;
  clientY: number;
}

const LONG_PRESS_DURATION_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

// iOS 家族（含 iPadOS 与 WKWebView 内核的第三方浏览器）：有触点且非 Android。
// Android 保留原生 contextmenu 长按，这里跳过以避免双重触发
const isTouchWithoutContextMenu = typeof navigator !== 'undefined'
  && navigator.maxTouchPoints > 0
  && !/Android/i.test(navigator.userAgent);

// 模块级单例状态：单指触摸同一时刻至多只有一条进行中的长按
let timer: number | undefined;
let fired = false;
let startPoint: ILongPressPoint | undefined;
let trigger: ((point: ILongPressPoint) => void) | undefined;

const resetLongPress = (): void => {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  trigger = undefined;
  startPoint = undefined;
};

export const longPressTouchStart = (e: TouchEvent, onTrigger: (point: ILongPressPoint) => void): void => {
  resetLongPress();
  fired = false;
  if (!isTouchWithoutContextMenu || e.touches.length !== 1) {
    return;
  }
  const { clientX, clientY } = e.touches[0];
  startPoint = { clientX, clientY };
  trigger = onTrigger;
  timer = window.setTimeout(() => {
    timer = undefined;
    if (trigger && startPoint) {
      trigger(startPoint);
    }
    trigger = undefined;
    fired = true;
  }, LONG_PRESS_DURATION_MS);
};

export const longPressTouchMove = (e: TouchEvent): void => {
  if (timer === undefined || !startPoint) {
    return;
  }
  const { clientX, clientY } = e.touches[0];
  if (Math.abs(clientX - startPoint.clientX) > LONG_PRESS_MOVE_TOLERANCE_PX
    || Math.abs(clientY - startPoint.clientY) > LONG_PRESS_MOVE_TOLERANCE_PX) {
    resetLongPress();
  }
};

export const longPressTouchEnd = (e: TouchEvent): void => {
  if (fired) {
    // 长按已触发菜单，阻止触摸结束合成的 click，避免同时打开会话/触发气泡点击
    e.preventDefault();
  }
  fired = false;
  resetLongPress();
};

export const longPressTouchCancel = (): void => {
  fired = false;
  resetLongPress();
};

/**
 * 以触摸点构造 MouseEvent 形状的事件对象，供 contextmenu 菜单逻辑复用。
 * target/currentTarget 是只读属性，且事件派发结束后会被浏览器置空，
 * 必须在 touchstart 时同步捕获后再通过本方法写回
 */
export const createLongPressSyntheticEvent = (
  point: ILongPressPoint,
  target: EventTarget | null,
  currentTarget: EventTarget | null,
): MouseEvent => {
  const event = new MouseEvent('contextmenu', { clientX: point.clientX, clientY: point.clientY });
  Object.defineProperty(event, 'target', { value: target });
  Object.defineProperty(event, 'currentTarget', { value: currentTarget });
  return event;
};
