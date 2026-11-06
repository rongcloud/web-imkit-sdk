import { MessageType } from '@rongcloud/imlib-next';
import { isMobileDevice } from '../helper';
import {
  EMOJI_PANEL_EMOJI_BTN_ICON, INPUT_ICON_EMOJI_HOVER_ICON,
  INPUT_ICON_EMOJI_ICON, INPUT_ICON_FILES_HOVER_ICON, INPUT_ICON_FILES_ICON,
  INPUT_ICON_IMAGES_HOVER_ICON, INPUT_ICON_IMAGES_ICON, INPUT_ICON_PHOTO_HOVER_ICON, INPUT_ICON_PHOTO_ICON,
} from '../assets';
import { RCKitContext } from '../core/RCKitContext';
import { IRCKitCachedConversation } from './conversation/IRCKitCachedConversation';
import { RCKitModule } from './RCKitModule';

/** SDK 内置输入区菜单 ID */
export enum RCKitInputMenuID {
  /** 拍照功能按钮 */
  PHOTO = 'input.menu.item.photo',
  /** 图片选择按钮，允许多选 */
  IMAGES = 'input.menu.item.images',
  /** 文件选择按钮，文件选择允许选择图片，并以文件的方式发送 */
  FILES = 'input.menu.item.files',
  /** 表情按钮 */
  EMOJI = 'input.menu.item.emoji',
  /** + 号按钮 */
  PLUS = 'input.menu.item.plus',
}

/**
 * Emoji 字符表情库 ID
 */
export const RCKitChatEmojiLibraryID = 'RCKitChatEmojiLibraryID';

/** 输入区菜单按钮位置 */
export enum RCKitInputMenuPosition {
  /** 收入 Plus 二级菜单 */
  SECONDARY_MENU,
  /** 输入框左侧显示 */
  LEFT,
}

export interface IRCKitInputMenuItem {
  /** 菜单 ID，SDK 在派发点击事件时包含此数据，同时也通过此 ID 查询多语言 UI 展示文案 */
  id: RCKitInputMenuID | string,
  /** 当存在 position 相同的菜单项时，根据 order 确定排序，order 值越低排序越靠前 */
  order: number,
  /** 菜单图标 */
  icon: string,
  /** 菜单图标 */
  hoverIcon?: string,
  /** 过滤器 */
  filter?: (conversation: IRCKitCachedConversation) => boolean,
  /** 二级菜单项列表，如果存在则点击该菜单项时会显示二级菜单而不是直接执行操作 */
  submenu?: IRCKitInputMenuItem[]
}

export interface IRCKitInputMenu {
  /** 菜单列表 */
  items: IRCKitInputMenuItem[],
}

/**
 * 默认菜单配置
 */
const defaultMenu: IRCKitInputMenu = {
  items: [
    {
      id: RCKitInputMenuID.EMOJI,
      order: 0,
      icon: INPUT_ICON_EMOJI_ICON,
      hoverIcon: INPUT_ICON_EMOJI_HOVER_ICON,
    },
    {
      id: RCKitInputMenuID.IMAGES,
      order: 1,
      icon: INPUT_ICON_IMAGES_ICON,
      hoverIcon: INPUT_ICON_IMAGES_HOVER_ICON,
    },
    {
      id: RCKitInputMenuID.FILES,
      order: 2,
      icon: INPUT_ICON_FILES_ICON,
      hoverIcon: INPUT_ICON_FILES_HOVER_ICON,
    },
    {
      id: RCKitInputMenuID.PHOTO,
      order: 3,
      icon: INPUT_ICON_PHOTO_ICON,
      hoverIcon: INPUT_ICON_PHOTO_HOVER_ICON,
      filter: () => (location.protocol === 'https:' || location.protocol === 'file' || location.hostname === 'localhost') && !isMobileDevice(),
    },
  ],
};

const cloneInputMenu = (menu: IRCKitInputMenu): IRCKitInputMenu => ({
  items: menu.items.map((item) => ({
    id: item.id,
    order: item.order,
    icon: item.icon,
    hoverIcon: item.hoverIcon,
    filter: item.filter,
    submenu: item.submenu
      ? item.submenu.map((subItem) => ({
        id: subItem.id,
        order: subItem.order,
        icon: subItem.icon,
        filter: subItem.filter,
        submenu: subItem.submenu, // 支持多级菜单（虽然当前只实现二级）
      }))
      : undefined,
  })),
});

/**
 * 图片表情库数据
 */
export interface IRCKitImageEmojiLibrary {
  /**
   * 表情库 ID，业务自行定义
   */
  id: string,
  /**
   * 表情库图标，用于表情面板按钮显示
   */
  icon: string,
  /**
   * 表情面板内的单项显示宽度
   */
  itemWidth: number,
  /**
   * 表情面板内的单项显示高度
   */
  itemHeight: number,
  /**
   * 表情列表
   */
  items: Array<IRCKitImageEmoji>,
  /**
   * 排序值，值越小排序越靠前
   */
  order: number,
}

export interface IRCKitGifImageInfo {
  /**
   * Gif 图片尺寸，单位 Byte
   */
  size: number,
  /**
   * Gif 图片宽度
   */
  width: number,
  /**
   * Gif 图片高度
   */
  height: number,
}

/**
 * 图片表情数据
 */
export interface IRCKitImageEmoji {
  /**
   * 网络资源托管地址, 如：https://xxxxx，地址需确保各端网络环境的可访问性
   */
  url: string,
  /**
   * 缩略图数据，需为 base64 字符串，同时也作为表情面板展示用，以避免直接原图造成流量浪费
   */
  thumbnail: string,
  /**
   * 若图片资源为 Gif 图片，且希望以 Gif 消息形式发送，则需要提供 Gif 图片信息，否则默认以静态图片消息进行发送
   */
  gif?: IRCKitGifImageInfo
}

// 默认支持的 emoji 列表
const defaultEmojis: string[] = [
  // u+1f601 - u+1f64f
  '\u{1f601}', '\u{1f602}', '\u{1f603}', '\u{1f604}', '\u{1f605}', '\u{1f606}', '\u{1f607}', '\u{1f608}',
  '\u{1f609}', '\u{1f60a}', '\u{1f60b}', '\u{1f60c}', '\u{1f60d}', '\u{1f60e}', '\u{1f60f}', '\u{1f610}',
  '\u{1f611}', '\u{1f612}', '\u{1f613}', '\u{1f614}', '\u{1f615}', '\u{1f616}', '\u{1f617}', '\u{1f618}',
  '\u{1f619}', '\u{1f61a}', '\u{1f61b}', '\u{1f61c}', '\u{1f61d}', '\u{1f61e}', '\u{1f61f}', '\u{1f620}',
  '\u{1f621}', '\u{1f622}', '\u{1f623}', '\u{1f624}', '\u{1f625}', '\u{1f626}', '\u{1f627}', '\u{1f628}',
  '\u{1f629}', '\u{1f62a}', '\u{1f62b}', '\u{1f62c}', '\u{1f62d}', '\u{1f62e}', '\u{1f62f}', '\u{1f630}',
  '\u{1f631}', '\u{1f632}', '\u{1f633}', '\u{1f634}', '\u{1f635}', '\u{1f636}', '\u{1f637}', '\u{1f638}',
  '\u{1f639}', '\u{1f63a}', '\u{1f63b}', '\u{1f63c}', '\u{1f63d}', '\u{1f63e}', '\u{1f63f}', '\u{1f640}',
  '\u{1f641}', '\u{1f642}', '\u{1f643}', '\u{1f644}', '\u{1f645}', '\u{1f646}', '\u{1f647}', '\u{1f648}',
  '\u{1f649}', '\u{1f64a}', '\u{1f64b}', '\u{1f64c}', '\u{1f64d}', '\u{1f64e}', '\u{1f64f}',
  // u+1f910 - u+1f92f
  '\u{1f910}', '\u{1f911}', '\u{1f912}', '\u{1f913}', '\u{1f914}', '\u{1f915}', '\u{1f916}', '\u{1f917}',
  '\u{1f918}', '\u{1f919}', '\u{1f91a}', '\u{1f91b}', '\u{1f91c}', '\u{1f91d}', '\u{1f91e}', '\u{1f91f}',
  '\u{1f920}', '\u{1f921}', '\u{1f922}', '\u{1f923}', '\u{1f924}', '\u{1f925}', '\u{1f926}', '\u{1f927}',
  '\u{1f928}', '\u{1f929}', '\u{1f92a}', '\u{1f92b}', '\u{1f92c}', '\u{1f92d}', '\u{1f92e}', '\u{1f92f}',
];

export interface IRCKitChatEmojiLibrary {
  /**
   * 表情库图标，用于表情面板按钮显示
   */
  icon: string,
  /**
   * 字符表情数组
   */
  chats: string[],
}

const defaultChatEmojiLibrary: IRCKitChatEmojiLibrary = {
  icon: EMOJI_PANEL_EMOJI_BTN_ICON,
  chats: defaultEmojis,
};

const cloneChatEmojiLibrary = (library: IRCKitChatEmojiLibrary): IRCKitChatEmojiLibrary => ({
  icon: library.icon,
  chats: [...library.chats],
});

const cloneImageEmojiLibrary = (libraries: IRCKitImageEmojiLibrary[]): IRCKitImageEmojiLibrary[] => libraries.map((library) => ({
  id: library.id,
  icon: library.icon,
  itemWidth: library.itemWidth,
  itemHeight: library.itemHeight,
  items: library.items.map((item) => ({ ...item })),
  order: library.order,
}));

/**
 * 输入模块配置数据管理模块。菜单配置数据全局有效，不因登录用户变更有变化。
 */
export class InputModule extends RCKitModule {
  private _menu: IRCKitInputMenu = cloneInputMenu(defaultMenu);

  /** 发消息时允许携带 quoteInfo 数据的消息类型白名单 */
  private readonly quoteEnableList: string[] = [
    MessageType.TEXT,
    MessageType.IMAGE,
    MessageType.SIGHT,
    MessageType.FILE,
    MessageType.GIF,
    MessageType.LOCATION,
    MessageType.HQ_VOICE,
  ];

  public readonly menuList: IRCKitInputMenuItem[] = [];

  public readonly chatEmojis: IRCKitChatEmojiLibrary = cloneChatEmojiLibrary(defaultChatEmojiLibrary);

  public readonly imageEmojis: IRCKitImageEmojiLibrary[] = [];

  constructor(ctx: RCKitContext) {
    super(ctx);

    this.setInputMenu(defaultMenu);
  }

  protected _onInit(): void {
    // 无需实现
  }

  protected _onInitUserCache(): void {
    // 无需实现
  }

  protected _onDestroyUserCache(): void {
    // 无需实现
  }

  public destroy(): void {
    this.chatEmojis.chats.length = 0;
    this.imageEmojis.length = 0;
    this.setInputMenu(defaultMenu);
  }

  /**
   * 获取输入区按钮列表拷贝
   */
  cloneInputMenu(): IRCKitInputMenu {
    return cloneInputMenu(this._menu);
  }

  /** RCKitApplication 会确保该函数仅在 `ready` 前被调用 */
  setInputMenu(menu: IRCKitInputMenu): void {
    this._menu = cloneInputMenu(menu);
    this._resetMenu();
  }

  private _resetMenu(): void {
    // 清理既有数据
    this.menuList.length = 0;

    // 获取过滤后的菜单
    const { items } = this._menu;

    const sort = (a: IRCKitInputMenuItem, b: IRCKitInputMenuItem) => a.order - b.order;

    this.menuList.splice(0, this.menuList.length, ...items.sort(sort));
  }

  cloneChatEmojiLibrary(): IRCKitChatEmojiLibrary {
    return cloneChatEmojiLibrary(this.chatEmojis);
  }

  setChatEmojiLibrary(library: IRCKitChatEmojiLibrary): void {
    this.chatEmojis.chats.splice(0, this.chatEmojis.chats.length, ...library.chats);
    this.chatEmojis.icon = library.icon;
  }

  cloneImageEmojiLibraries(): IRCKitImageEmojiLibrary[] {
    return cloneImageEmojiLibrary(this.imageEmojis);
  }

  setImageEmojiLibraries(emojis: IRCKitImageEmojiLibrary[]): void {
    const newEmojis = cloneImageEmojiLibrary(emojis).sort((a, b) => a.order - b.order);
    this.imageEmojis.splice(0, this.imageEmojis.length, ...newEmojis);
  }

  /**
   * 添加自定义图片表情库
   * @param id - 表情库 ID
   * @param icon - 表情库图标，用于表情面板切换按钮展示
   * @abstract
   */
  addImageEmoji(id: string, icon: string, emojis: IRCKitImageEmoji[]): void {
    throw new Error('TODO: addImageEmoji');
  }

  /**
   * 设置发消息时允许携带 quoteInfo 数据的消息类型列表
   * @param typeList
   */
  setQuoteEnableMessageTypeList(typeList: string[]): void {
    this.quoteEnableList.splice(0, this.quoteEnableList.length, ...typeList);
  }

  /**
   * 检查消息类型是否在允许携带 quoteInfo 数据的消息类型列表中
   * @param messageType
   * @returns
   */
  isQuoteInfoEnabledForMessageType(messageType: string): boolean {
    return this.ctx.isQuoteMessageV2Enabled && this.quoteEnableList.includes(messageType);
  }

  /**
   * 获取允许携带 quoteInfo 数据的消息类型列表
   */
  getQuoteEnableMessageTypeList(): string[] {
    return this.quoteEnableList.slice();
  }
}
