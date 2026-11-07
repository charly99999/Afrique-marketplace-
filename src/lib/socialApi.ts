export type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

export interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
  badgeBg: string;
}

export const REACTION_CONFIGS: Record<ReactionType, ReactionConfig> = {
  like: {
    type: 'like',
    emoji: '👍',
    label: "J'aime",
    color: '#1877F2',
    badgeBg: '#EBF5FF',
  },
  love: {
    type: 'love',
    emoji: '❤️',
    label: "J'adore",
    color: '#E0245E',
    badgeBg: '#FDF2F8',
  },
  haha: {
    type: 'haha',
    emoji: '😂',
    label: 'Haha',
    color: '#D97706',
    badgeBg: '#FEF3C7',
  },
  wow: {
    type: 'wow',
    emoji: '😮',
    label: 'Wouah',
    color: '#D97706',
    badgeBg: '#FEF3C7',
  },
  sad: {
    type: 'sad',
    emoji: '😢',
    label: 'Triste',
    color: '#CA8A04',
    badgeBg: '#FEF9C3',
  },
  angry: {
    type: 'angry',
    emoji: '😡',
    label: 'Grrr',
    color: '#DC2626',
    badgeBg: '#FEE2E2',
  },
};

export const ORDERED_REACTIONS: ReactionType[] = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];

export interface ReactorItem {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  reactionType: ReactionType;
  createdAt: string;
}

export interface PostSocialStats {
  postId: string;
  reactionsCount: number;
  reactionBreakdown: Record<ReactionType, number>;
  activeEmojis: ReactionType[];
  userReaction: ReactionType | null;
  sharesCount: number;
  recentReactors: ReactorItem[];
}

export async function fetchBatchSocialStats(
  postIds: string[],
  currentUserId?: string
): Promise<Record<string, PostSocialStats>> {
  if (postIds.length === 0) return {};
  try {
    const url = `/api/social/stats?postIds=${encodeURIComponent(postIds.join(','))}${
      currentUserId ? `&userId=${encodeURIComponent(currentUserId)}` : ''
    }`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    return data.stats || {};
  } catch (err) {
    console.warn('Error fetching batch social stats:', err);
    return {};
  }
}

export async function fetchPostReactors(
  postId: string,
  currentUserId?: string
): Promise<{ stats: PostSocialStats; reactors: ReactorItem[] } | null> {
  try {
    const url = `/api/social/reactions/${encodeURIComponent(postId)}${
      currentUserId ? `?userId=${encodeURIComponent(currentUserId)}` : ''
    }`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      stats: data.stats,
      reactors: data.reactors || [],
    };
  } catch (err) {
    console.warn('Error fetching post reactors:', err);
    return null;
  }
}

export async function sendPostReaction(
  postId: string,
  userId: string,
  reactionType: ReactionType,
  userInfo?: { fullName?: string; avatarUrl?: string }
): Promise<{ action: 'added' | 'removed' | 'updated'; currentReaction: ReactionType | null; stats: PostSocialStats } | null> {
  try {
    const res = await fetch('/api/social/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        userId,
        reactionType,
        userInfo,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error sending post reaction:', err);
    return null;
  }
}

export async function recordPostShare(
  postId: string,
  userId: string,
  shareType: 'social_feed' | 'whatsapp' | 'facebook' | 'native_share' | 'link_copy',
  commentary?: string,
  createdPostId?: string
): Promise<{ sharesCount: number } | null> {
  try {
    const res = await fetch('/api/social/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        userId,
        shareType,
        commentary,
        createdPostId,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Error recording post share:', err);
    return null;
  }
}
