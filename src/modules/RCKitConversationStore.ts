import { cloneByJSON } from '@lib/helper/clone';
import { ILogger, isUndefined, notEmptyObject } from '@rongcloud/engine';
import { ConversationType } from '@rongcloud/imlib-next';
import { AppStorage } from './RCKitStorage';

interface ILocalConversationData {
  lastReadTime?: number,
  sendReadReceiptTime?: number,
}

type ILocalConversationDataKeys = keyof ILocalConversationData

const CONVER_STATE_KEY = (appKey: string, curUserId: string) => `im-kit-${appKey}-${curUserId}`;

const StorageKey2ConversationKey: {[key: string]: {keyName: string, defaultVal: number}} = {
  lrt: { keyName: 'lastReadTime', defaultVal: 0 },
  srrt: { keyName: 'sendReadReceiptTime', defaultVal: 0 },
};

const ConversationKey2StorageKey: {[key:string]: string} = {};
for (const key in StorageKey2ConversationKey) {
  const { keyName } = StorageKey2ConversationKey[key];
  ConversationKey2StorageKey[keyName] = key;
}

/**
 * 存储本地的会话信息，目前维护字段有：
 * 回执已读时间（单聊）
 */
export class RCKitConversationStore {
  public readonly _localStore: AppStorage

  constructor(
    w: Window,
    _appkey: string,
    _currentUserId: string,
    private logger: ILogger,
  ) {
    this._localStore = new AppStorage(w, CONVER_STATE_KEY(_appkey, _currentUserId));
  }

  private _getStoreKey(type: ConversationType, targetId: string, channelId: string): string {
    return `${channelId}_${type}_${targetId}`;
  }

  /**
   * 获取单个会话本地存储信息
   * @param type
   * @param targetId
   * @param channelId
   * @returns
   */
  get(type: ConversationType, targetId: string, channelId: string = '') {
    const key = this._getStoreKey(type, targetId, channelId);
    const local = this._localStore.get(key) || {};
    const conversation: ILocalConversationData = {};
    for (const key in StorageKey2ConversationKey) {
      const { keyName, defaultVal } = StorageKey2ConversationKey[key];
      conversation[<ILocalConversationDataKeys>keyName] = local[key] || cloneByJSON(defaultVal);
    }
    return conversation;
  }

  /**
   * 设置会话信息
   * @param type
   * @param targetId
   * @param conversation
   * @param channelId
   */
  set(type: ConversationType, targetId: string, conversation: ILocalConversationData, channelId: string) {
    const key = this._getStoreKey(type, targetId, channelId);
    const local = this._localStore.get(key) || {};
    for (const key in conversation) {
      const storageKey = ConversationKey2StorageKey[key];
      const val = conversation[<ILocalConversationDataKeys>key];
      if (isUndefined(storageKey) || isUndefined(val)) {
        continue;
      }

      const { defaultVal } = StorageKey2ConversationKey[storageKey];

      if (val === defaultVal) {
        // 默认值不存储，避免占用存储空间。获取时未获取到的返回默认值
        delete local[storageKey];
      } else {
        local[storageKey] = val;
      }
    }

    if (notEmptyObject(local)) {
      this._localStore.set(key, local);
      return;
    }
    this._localStore.remove(key);
  }

  /**
   * 清除单个会话本地存储信息
   * @param type
   * @param targetId
   * @param channelId
   */
  remove(type: ConversationType, targetId: string, channelId: string) {
    const key = this._getStoreKey(type, targetId, channelId!);
    this._localStore.remove(key);
  }
}
