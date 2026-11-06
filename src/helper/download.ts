import { getDownloadAuth } from '@rongcloud/imlib-next';
import type { IRCKitCachedMessage } from '@lib/modules/MessageDataModule';

const MESSAGE_URL_KEYS = ['sightUrl', 'imageUri', 'remoteUrl', 'fileUrl'] as const;

const appendDownloadToken = (url: string, token: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${token}`;
};

/** 获取当前构建环境下可直接使用的媒体下载地址。 */
export const getAuthorizedDownloadUrl = async (url: string): Promise<string | undefined> => {
  if (!url) {
    return undefined;
  }
  if (!__IS_ENTERPRISE__ || /^(blob:|data:)/i.test(url)) {
    return url;
  }

  const result = await getDownloadAuth(url);
  if (!result.isOk || !result.data) {
    return undefined;
  }

  const { token, downloadAuthInfo } = result.data;
  if (token) {
    return appendDownloadToken(url, token);
  }
  if (!downloadAuthInfo || downloadAuthInfo.type === 0) {
    return url;
  }
  if (downloadAuthInfo.type === 1) {
    return downloadAuthInfo.url;
  }

  return undefined;
};

/** 创建携带临时鉴权 URL 的消息副本，避免污染消息缓存中的原始地址。 */
export const createAuthorizedDownloadMessage = async (message: IRCKitCachedMessage): Promise<IRCKitCachedMessage | undefined> => {
  const { content } = message;
  if (!content) {
    return undefined;
  }

  const key = MESSAGE_URL_KEYS.find((item) => typeof content[item] === 'string' && content[item]);
  if (!key) {
    return undefined;
  }

  const url = await getAuthorizedDownloadUrl(content[key]);
  if (!url) {
    return undefined;
  }

  return {
    ...message,
    content: {
      ...content,
      [key]: url,
    },
  };
};
