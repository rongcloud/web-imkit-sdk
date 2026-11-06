/**
 * Controls how a message component is inset inside its bubble.
 */
export enum MessageBubbleContentLayout {
  /** The bubble owns the standard 20 px content inset. */
  STANDARD = 'standard',
  /** The message renderer owns all outer spacing. */
  EDGE_TO_EDGE = 'edge-to-edge',
  /** Standalone content is edge-to-edge, decorated content uses the standard inset. */
  ADAPTIVE = 'adaptive',
}

export const normalizeMessageBubbleContentLayout = (
  layout?: MessageBubbleContentLayout | string,
): MessageBubbleContentLayout => {
  switch (layout) {
    case MessageBubbleContentLayout.EDGE_TO_EDGE:
    case MessageBubbleContentLayout.ADAPTIVE:
      return layout;
    default:
      return MessageBubbleContentLayout.STANDARD;
  }
};

export const resolveCustomMessageBubbleContentLayout = (
  disableDefaultBubblePadding = false,
): MessageBubbleContentLayout => (
  disableDefaultBubblePadding
    ? MessageBubbleContentLayout.EDGE_TO_EDGE
    : MessageBubbleContentLayout.STANDARD
);

export const shouldInsetMessageBubbleContent = (
  layout: MessageBubbleContentLayout | string | undefined,
  hasQuote: boolean,
  hasReactions: boolean,
): boolean => {
  const normalized = normalizeMessageBubbleContentLayout(layout);
  if (normalized === MessageBubbleContentLayout.EDGE_TO_EDGE) {
    return false;
  }
  if (normalized === MessageBubbleContentLayout.ADAPTIVE) {
    return hasQuote || hasReactions;
  }
  return true;
};
