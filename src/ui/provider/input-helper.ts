import { ref } from 'vue';
import {
  BaseMessage, ConversationType, GIFMessage, IConversationOption, ImageMessage, MentionedType, ReferenceMessage, TextMessage,
  MessageType,
  ISendMessageOptions,
  getAppSettings,
} from '@rongcloud/imlib-next';
import { IRCKitGifImageInfo } from '@lib/modules/InputModule';
import { InnerEvent } from '@lib/core/EventDefined';
import { RCKitEvent } from '@lib/core/RCKitEvent';
import { ctx, replyMessage, selectedGroupMembers } from './context';
import { $tt } from '../i18n-vue';

/** 是否显示二级菜单 */
export const secondaryVisible = ref(false);
/** 显示表情面板 */
export const showEmoji = ref(false);
/** 显示 @ 列表 */
export const showAtList = ref(false);
/** 当前 mentioned 用户列表 */
const mentionedUsers: Map<string, string> = new Map();
/** 是否已添加 @所有人 相关标识 */
let atAll = false;

/**
 * 清空缓存的 @ 信息
 */
export const clearMentionedInfo = () => {
  atAll = false;
  mentionedUsers.clear();
};

/**
 * 添加 @ 人员
 * @param userId
 * @param textarea
 * @returns
 */
export const addMentionedUser = (userId: string, textarea: HTMLTextAreaElement, prefix: boolean = false) => {
  const groupMembers = selectedGroupMembers.value;
  const user = groupMembers.find((member) => member.userId === userId);
  if (!user) {
    return;
  }

  hidePrompt();
  const name = user.nickname || user.name;
  mentionedUsers.set(userId, `@${name}`);
  textarea.focus();
  const txt = prefix ? `@${name} ` : `${name} `;
  textarea.setRangeText(txt, textarea.selectionStart, textarea.selectionEnd, 'end');
};

export const handleAtAll = (textarea: HTMLTextAreaElement) => {
  atAll = true;
  hidePrompt();

  textarea.focus();
  textarea.setRangeText(`${$tt('input.mentioned.all')} `, textarea.selectionStart, textarea.selectionEnd, 'end');
};

/** 隐藏输入相关弹窗 */
export const hidePrompt = () => {
  secondaryVisible.value = false;
  showEmoji.value = false;
  showAtList.value = false;
};

export const showEmojiPanel = () => {
  showEmoji.value = true;
};

export const sendImageEmoji = (evt: CustomEvent, conversation: IConversationOption) => {
  hidePrompt();
  const { detail } = evt;
  const { url, thumbnail, gif } = detail;
  let message: BaseMessage;
  if (gif) {
    const { size, width, height } = gif as IRCKitGifImageInfo;
    message = new GIFMessage({
      gifDataSize: size, width, height, remoteUrl: url,
    });
  } else {
    message = new ImageMessage({ content: thumbnail, imageUri: url });
  }
  const context = ctx();

  let sendOpts: ISendMessageOptions = {};
  const replyMsg = replyMessage.value;
  // 开启引用 v2 的情况下，发送图片消息携带 quoteInfo 字段；
  if (
    replyMsg
    && context.isQuoteMessageV2Enabled
    && context.input.isQuoteInfoEnabledForMessageType(message.messageType)
  ) {
    sendOpts.quoteInfo = {
      messageUId: replyMsg.messageUId,
      senderId: replyMsg.senderUserId,
      objectName: replyMsg.messageType,
    };
  }
  ctx().message.sendMessage(conversation, message, sendOpts, replyMsg);
  // 白名单仅控制是否携带 quoteInfo；V2 下消息提交后均结束本次回复态，避免后续消息误用旧引用。
  if (replyMsg && context.isQuoteMessageV2Enabled && replyMessage.value === replyMsg) {
    replyMessage.value = null;
  }
};

export const insertChatEmoji = (evt: CustomEvent, textarea: HTMLTextAreaElement) => {
  textarea.focus();
  textarea.setRangeText(evt.detail, textarea.selectionStart, textarea.selectionEnd, 'end');
  hidePrompt();
  // 发送输入中状态
  ctx().conversation.sendTypingStatus();
};

const pickFile = (filter: string, handle: (files: File[]) => void) => {
  const element = document.createElement('input');
  element.type = 'file';
  element.accept = filter;
  element.multiple = true;
  element.onchange = () => {
    handle(Array.from(element.files || []));
  };
  // 使用 addEventListener 监听 cancel 事件：TS 4.6 的 lib.dom.d.ts 尚未为 HTMLInputElement 声明 oncancel 属性
  element.addEventListener('cancel', () => {
    handle([]);
  });
  element.click();
};

const pickFileOnSafari = (filter: string, handle: (files: File[]) => void) => {
  const element = document.createElement('input');
  element.type = 'file';
  element.accept = filter;
  element.multiple = true;
  // Safari 对未挂载到 DOM 的临时 file input 兼容性不稳定，挂到 body 上更稳一些
  element.style.position = 'fixed';
  element.style.left = '-9999px';
  element.style.top = '-9999px';
  element.style.width = '1px';
  element.style.height = '1px';
  element.style.opacity = '0';
  element.style.pointerEvents = 'none';
  document.body.appendChild(element);

  let handled = false;
  const pendingTimeouts: ReturnType<typeof globalThis.setTimeout>[] = [];

  const clearPendingTimeouts = () => {
    for (const id of pendingTimeouts) {
      globalThis.clearTimeout(id);
    }
    pendingTimeouts.length = 0;
  };

  const cleanup = () => {
    clearPendingTimeouts();
    globalThis.removeEventListener('focus', onWindowFocus, true);
    element.onchange = null;
    element.removeEventListener('cancel', finalizeCancel);
    if (element.parentNode) {
      element.remove();
    }
  };

  const readFiles = () => Array.from(element.files || []);

  const finalizeSuccess = () => {
    if (handled) {
      return;
    }
    const files = readFiles();
    if (files.length === 0) {
      // 空数组绝不能提前占 handled，否则晚到的 onchange 会被丢弃（Safari 兼容性问题）
      return;
    }
    handled = true;
    cleanup();
    handle(files);
  };

  const finalizeCancel = () => {
    if (handled) {
      return;
    }

    handled = true;
    cleanup();
    handle([]);
  };

  const onWindowFocus = () => {
    clearPendingTimeouts();
    const delays = [0, 50, 100, 200, 400, 700, 1100, 1700, 2500];
    for (const ms of delays) {
      pendingTimeouts.push(
        globalThis.setTimeout(finalizeSuccess, ms),
      );
    }
    // 处理最后一次轮询之后才到达的文件，或结束空选择。
    pendingTimeouts.push(
      globalThis.setTimeout(() => {
        if (readFiles().length > 0) {
          finalizeSuccess();
        } else {
          finalizeCancel();
        }
      }, 2800),
    );
  };

  element.value = '';
  // Safari Bug：onchange 事件可能不会立即触发，需要依靠 focus 窗口回焦后检查文件是否存在
  globalThis.addEventListener('focus', onWindowFocus, true);
  element.onchange = finalizeSuccess;
  // 使用 addEventListener 监听 cancel 事件：TS 4.6 的 lib.dom.d.ts 尚未为 HTMLInputElement 声明 oncancel 属性
  element.addEventListener('cancel', finalizeCancel);
  element.click();
};

function isSafari(): boolean {
  // 1. 首先，通过特性检测是否为 WebKit 内核 (快速筛选)
  const isWebKit = 'GestureEvent' in window;

  // 2. 如果不是 WebKit，直接返回 false
  if (!isWebKit) return false;

  // 3. 如果是 WebKit，再通过 UA 字符串过滤掉 Chrome 等非 Safari 浏览器
  const ua = navigator.userAgent;
  const isSafariUA = /Safari/.test(ua) && !/Chrome|CriOS|Edg|FxiOS|OPiOS/i.test(ua);

  // 4. 可选：使用 navigator.vendor 进行二次确认
  const isAppleVendor: boolean = Boolean(navigator.vendor) && navigator.vendor.indexOf('Apple') > -1;

  // 返回最终结果
  return isSafariUA && isAppleVendor;
}

/** 选择文件 */
export const pickFiles = isSafari() ? pickFileOnSafari : pickFile;

/**
 * 展示输入框 DOM 二级菜单
 * @param event
 * @param dom
 */
export const showInputBoxSecondaryMenu = (event: MouseEvent, dom: HTMLElement) => {
  dom.style.bottom = '50px';
  secondaryVisible.value = true;
};

/**
 * shift 键是否按下
 */
let shiftDown = false;

/**
 * 键盘按下事件
 * @param e
 */
export const onKeyDown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Backspace':
      hidePrompt();
      break;
    case 'Shift':
      shiftDown = true;
      break;
    case 'ArrowRight':
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'ArrowDown':
      break;
    default:
      break;
  }
};

/**
 * 处理 Enter 快捷发送。
 * 这里放在 keydown 阶段执行，避免依赖 Safari 兼容性较差的 keypress 事件。
 */
export const handleEnterOnKeyDown = (
  e: KeyboardEvent,
  hidden: HTMLDivElement,
  container: HTMLDivElement,
  bar: HTMLDivElement,
) => {
  if (e.key === 'Enter') {
    _handleEnter(e, hidden, container, bar);
  }
};

/**
 * 键盘抬起事件
 * @param e
 */
export const onKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    shiftDown = false;
  }
};

const isComposingInput = (e: KeyboardEvent): boolean => e.isComposing || e.keyCode === 229;

export const handleInput = (textarea: HTMLTextAreaElement, hidden: HTMLDivElement, container: HTMLDivElement, event: InputEvent) => {
  const { value } = textarea;
  resizeTextarea(textarea, hidden, container);

  // Safari 在 Shift + 2 输入 @ 时，可能只触发 input，不触发 keypress。
  // 因此改为根据本次实际插入的文本来决定是否展示 @ 面板。
  const insertedText = event.data ?? '';
  const shouldShowAtList = event.inputType === 'insertText' && insertedText.includes('@');
  if (shouldShowAtList) {
    const conversation = ctx().conversation.getOpenedConversation();
    if (conversation?.conversationType === ConversationType.GROUP) {
      hidePrompt();
      showAtList.value = true;
    }
  } else {
    showAtList.value = false;
  }

  // 判断 mentionedUsers 是否有变更，用户可能从任何位置增加或删除字符
  mentionedUsers.forEach((reg, userId) => {
    if (!value.includes(reg)) {
      mentionedUsers.delete(userId);
    }
  });

  // 检查 @all 是否仍有效
  if (atAll) {
    const atAllTag = `@${$tt('input.mentioned.all')}`;
    if (!value.includes(atAllTag)) {
      atAll = false;
    }
  }

  ctx().conversation.sendTypingStatus();
};

/**
 * 调整消息列表滚动位置，确保最后一条消息不被输入框遮挡
 * 当输入框高度变化时（如添加引用消息、输入多行文字），如果消息列表在底部，需要调整滚动位置
 */
export const adjustMessageListScroll = () => {
  requestAnimationFrame(() => {
    ctx().dispatch(new RCKitEvent(InnerEvent.ADJUST_MESSAGE_LIST_SCROLL));
  });
};

let lastHeight = -1;

export const resizeTextarea = (textarea: HTMLTextAreaElement, hidden: HTMLDivElement, container: HTMLDivElement, deferred: boolean = false) => {
  // 测量节点只写入纯文本，避免输入内容被解析为 HTML；末尾占位符用于保留结尾换行的高度。
  hidden.textContent = textarea.value.endsWith('\n') ? `${textarea.value}.` : textarea.value;

  // textarea 不再包含内边距，clientWidth 即实际文字宽度（不含滚动条）。
  const textareaWidth = textarea.clientWidth;
  // 会话切换或组件重挂载瞬间，输入框可能尚未完成布局（clientWidth 为 0），此时测量结果恒为 1 行，
  // 会导致恢复的多行草稿被压回单行高度；延迟到下一帧布局完成后再测量。
  if (textareaWidth === 0) {
    if (!deferred) {
      requestAnimationFrame(() => resizeTextarea(textarea, hidden, container, true));
    }
    return;
  }
  if (Math.abs(hidden.offsetWidth - textareaWidth) > 1) {
    hidden.style.width = `${textareaWidth}px`;
    // 强制重排以确保宽度更新生效
    hidden.getBoundingClientRect();
  }

  const lineHeight = 21;
  const maxLines = 4;
  const overflowHintHeight = 6;

  // 使用 hidden div 的 scrollHeight 来测量实际内容高度
  // hidden div 没有 padding，所以 scrollHeight 就是纯内容高度
  const contentHeight = hidden.scrollHeight;

  // 计算实际行数：内容高度除以行高，向上取整，至少为1行
  const lineCount = Math.max(1, Math.ceil(contentHeight / lineHeight));

  // 溢出时显示四行完整内容，并露出相邻一行的 6px；上下留白仍由外层提供。
  const maxHeight = lineHeight * maxLines + overflowHintHeight;
  const finalHeight = Math.min(lineHeight * lineCount, maxHeight);
  const containerStyle = window.getComputedStyle(container);
  const padding = (Number.parseFloat(containerStyle.paddingTop) || 0)
    + (Number.parseFloat(containerStyle.paddingBottom) || 0);
  const containerHeight = finalHeight + padding;

  textarea.style.height = `${finalHeight}px`;
  container.style.height = `${containerHeight}px`;

  // 如果内容超过4行，显示滚动条
  if (lineCount > maxLines) {
    textarea.style.overflowY = 'auto';
  } else {
    textarea.style.overflowY = 'hidden';
  }

  // 如果高度发生变化才去调整滚动位置
  if (lastHeight !== containerHeight) {
    lastHeight = containerHeight;
    // 调整消息列表滚动位置
    adjustMessageListScroll();
  }

  // 切换/挂载后布局可能继续变化（如 H5 过渡动画），下一帧复核宽度，
  // 与测量时不一致则按最终布局重算一次高度
  if (!deferred) {
    requestAnimationFrame(() => {
      if (textarea.isConnected && textarea.clientWidth !== textareaWidth) {
        resizeTextarea(textarea, hidden, container, true);
      }
    });
  }
};

/**
 * 重置输入框内容，并重置元素尺寸
 */
export const resetTextareaValue = (textarea: HTMLTextAreaElement, hidden: HTMLDivElement, container: HTMLDivElement, bar: HTMLDivElement, value?: string) => {
  textarea.value = value || '';
  resizeTextarea(textarea, hidden, container);
};

/**
 * 发送消息的核心逻辑
 */
export const sendText = (textarea: HTMLTextAreaElement, hidden: HTMLDivElement, container: HTMLDivElement, bar: HTMLDivElement) => {
  const conversation = ctx().conversation.getOpenedConversation()!;
  if (!conversation) {
    return;
  }

  const content = textarea.value;
  if (!content.trim().length) {
    return;
  }

  const mentionedType = atAll ? MentionedType.ALL : MentionedType.SINGAL;
  const context = ctx();
  const replyMsg = replyMessage.value;

  // 发送消息
  let msg: BaseMessage;
  const sendOpts: ISendMessageOptions = {};

  if (replyMsg) {
    if (context.isQuoteMessageV2Enabled) {
      // 开启已读 v2 的情况下，发普通消息，携带 quoteInfo 字段
      msg = new TextMessage({ content });
      // 只有当消息类型支持引用消息功能时，才携带 quoteInfo 字段
      if (context.input.isQuoteInfoEnabledForMessageType(msg.messageType)) {
        sendOpts.quoteInfo = {
          messageUId: replyMsg.messageUId,
          senderId: replyMsg.senderUserId,
          objectName: replyMsg.messageType,
        };
      }
    } else {
      msg = new ReferenceMessage({
        content,
        referMsg: { ...replyMsg.content },
        referMsgUserId: replyMsg.senderUserId,
        objName: replyMsg.messageType,
        referMsgUid: replyMsg.messageUId,
      });
    }
  } else {
    msg = new TextMessage({ content });
  }

  sendOpts.isMentioned = atAll || mentionedUsers.size > 0;

  if (sendOpts.isMentioned) {
    msg.content.mentionedInfo = {
      type: mentionedType,
      userIdList: Array.from(mentionedUsers.keys()),
    };
  }
  const types: string[] = [MessageType.TEXT, MessageType.REFERENCE];
  const verifyMessageType = types.includes(msg.messageType);

  // 产品定义：当存在配置时，可输入长度修改为 1500，否则保持 5000 向前兼容
  const maxLength = (getAppSettings()?.messageSizeLimit || 0) ? 1500 : 5000;
  if (verifyMessageType && msg.content.content.length > maxLength) {
    ctx().alert('alert.send.message.maxcount', maxLength);
    return;
  }
  context.message.sendMessage(conversation, msg, sendOpts, replyMsg);
  // 消息通过本地校验并提交后结束回复态；白名单未命中只影响 quoteInfo，不应保留旧回复。
  if (replyMsg && replyMessage.value === replyMsg) {
    replyMessage.value = null;
  }

  // 清空内容，重置高度
  clearMentionedInfo();
  textarea.value = '';
  resizeTextarea(textarea, hidden, container);
};

const _handleEnter = (e: KeyboardEvent, hidden: HTMLDivElement, container: HTMLDivElement, bar: HTMLDivElement) => {
  const target = e.target as HTMLTextAreaElement;
  if (isComposingInput(e)) {
    return;
  }

  if (shiftDown) {
    // 正常换行行为
    return;
  }

  // 取消默认事件
  e.preventDefault();
  sendText(target, hidden, container, bar);
};

export const onPaste = (event: ClipboardEvent) => {
  const paste: DataTransfer | null = event.clipboardData;
  if (!paste) {
    return;
  }

  if (paste.files.length === 0) {
    return;
  }

  event.preventDefault();

  const context = ctx();
  const conversation = context.conversation.getOpenedConversation()!;

  // 处理文件类型数据
  const files = Array.from(paste.files);
  if (files.length > 100) {
    context.alert('alert.pickfiles.maxcount', '100');
    return;
  }

  const validFiles = files.filter((file) => file.size > 0);
  if (validFiles.length === 0) {
    return;
  }

  context.message.sendFiles(conversation, validFiles);
};
