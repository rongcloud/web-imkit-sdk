import {
  ConversationType, IAReceivedMessage, MessageDirection, MessageType, SentStatus,
} from '@rongcloud/imlib-next';
import { MessageModifyStatus } from '@rongcloud/engine';
import type { IRCKitCachedMessage } from './MessageDataModule';
import { RCKitMessageEditStatus } from '../enums/RCKitMessageEditStatus';

/** Only authoritative successful modification data can produce an edited marker. */
export const getSuccessfulEditTimestamp = (message: Pick<IAReceivedMessage, 'modifyInfo'>): number | undefined => {
  const info = message.modifyInfo;
  return info && info.status === MessageModifyStatus.SUCCESS && Number.isFinite(info.timestamp) && info.timestamp > 0
    ? info.timestamp
    : undefined;
};

export const canEditMessage = (
  message: IRCKitCachedMessage,
  userId: string,
  enabled: boolean,
  minutes: number | undefined,
  now: number,
  activeMessageUId?: string,
): boolean => enabled && !!message.messageUId && message.senderUserId === userId
  && message.messageDirection === MessageDirection.SEND
  && message.sentStatus === SentStatus.SENT
  && [ConversationType.PRIVATE, ConversationType.GROUP].includes(message.conversationType)
  && (message.messageType === MessageType.TEXT || message.messageType === MessageType.REFERENCE)
  && message.editStatus !== RCKitMessageEditStatus.UPDATING
  && message.messageUId !== activeMessageUId
  && Number.isFinite(minutes) && minutes! > 0
  && Number.isFinite(message.sentTime) && now - message.sentTime < minutes! * 60000;
