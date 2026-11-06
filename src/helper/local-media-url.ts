// 只记录 Kit 自己创建的 URL，避免释放业务传入的 Blob URL。
const localMediaUrls = new WeakMap<object, string>();

export const registerLocalMediaUrl = <T extends object>(message: T, url: string): T => {
  localMediaUrls.set(message, url);
  return message;
};

export const takeLocalMediaUrl = (message: object): string | undefined => {
  const url = localMediaUrls.get(message);
  localMediaUrls.delete(message);
  return url;
};

export const releaseLocalMediaUrl = (message: object): void => {
  const url = takeLocalMediaUrl(message);
  if (url) URL.revokeObjectURL(url);
};
