import { IRCKitCachedMessage } from '@lib/modules/MessageDataModule';

export interface IRCKitReplyPreviewBarComponentProps {
  /**
   * 被引用消息数据原始数据
   */
  message: IRCKitCachedMessage
  /**
   * 被引用消息发送者名称
   */
  username: string,
  /**
   * 被引用消息预览信息
   */
  previewText: string,
  /**
   * 缩率图数据，仅被回复消息为图片消息或小视频消息时有值
   */
  thumbnail?: string,
  /**
   * 取消回复
   */
  cancel: () => void,
}
