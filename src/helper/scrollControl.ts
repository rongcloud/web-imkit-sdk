type ElementRefLike<T> = { value: T };

/**
 * 滚动控制工具
 * 用于在菜单显示时禁用滚动，隐藏时恢复滚动
 * @param scrollElementRef - 滚动容器（可以是 HTMLElement 或形如 { value } 的 ref-like 对象）
 * @returns 返回包含 disableScroll 和 enableScroll 方法的对象
 */
export function createScrollControl(
  scrollElementRef: ElementRefLike<HTMLElement | undefined> | HTMLElement,
) {
  let isScrollDisabled = false;

  // 获取实际的 DOM 元素
  const getElement = (): HTMLElement | null => {
    if (scrollElementRef instanceof HTMLElement) {
      return scrollElementRef;
    }
    return scrollElementRef.value || null;
  };

  // 阻止滚动事件
  const preventScroll = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 阻止键盘滚动
  const preventKeyScroll = (e: KeyboardEvent) => {
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    if (scrollKeys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // 禁用滚动
  const disableScroll = () => {
    if (isScrollDisabled) return;
    isScrollDisabled = true;
    const element = getElement();
    if (element) {
      element.addEventListener('wheel', preventScroll, { passive: false });
      element.addEventListener('touchmove', preventScroll, { passive: false });
      element.addEventListener('keydown', preventKeyScroll, { passive: false });
    }
  };

  // 启用滚动
  const enableScroll = () => {
    if (!isScrollDisabled) return;
    isScrollDisabled = false;
    const element = getElement();
    if (element) {
      element.removeEventListener('wheel', preventScroll);
      element.removeEventListener('touchmove', preventScroll);
      element.removeEventListener('keydown', preventKeyScroll);
    }
  };

  return {
    disableScroll,
    enableScroll,
    get isScrollDisabled() {
      return isScrollDisabled;
    },
  };
}
