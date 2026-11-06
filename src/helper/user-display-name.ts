export interface IRCKitDisplayProfile {
  userId: string;
  name?: string;
  nickname?: string;
}

export const resolveUserDisplayName = (
  profile?: IRCKitDisplayProfile | null,
  fallback = '',
): string => profile?.nickname || profile?.name || fallback;
