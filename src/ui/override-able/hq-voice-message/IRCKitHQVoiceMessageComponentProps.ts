import { RCKitMessageComponentRenderPosition } from '@lib/ui/interface';

export interface IRCKitHQVoiceMessageComponentProps {
  /**
   * 是否为己方发送的消息
   */
  isOwner: boolean,
  /**
   * 播放状态
   */
  playing: boolean,
  /**
   * 播放进度
   */
  progress: number,
  /**
   * 语音消息时长
   */
  duration: number,
  /**
   * 切换播放与暂停状态
   */
  toggle: () => void,
  /**
   * 消息渲染位置
   */
  position: RCKitMessageComponentRenderPosition,
}
