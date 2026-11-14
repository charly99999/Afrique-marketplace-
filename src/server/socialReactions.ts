import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export const ReactionType = REACTION_TYPES;

export interface ReactorRecord {
  userId: string;
  fullName: string;
  avatarUrl?: string;
  reactionType: ReactionType;
  createdAt: string;
}

export interface ShareRecord {
  id: string;
  userId: string;
  shareType: 'social_feed' | 'whatsapp' | 'facebook' | 'native_share' | 'link_copy';
  commentary?: string;
  createdPostId?: string;
  createdAt: string;
}

interface SocialDataStore {
  reactions: Record<string, ReactorRecord[]>; // postId -> reactors
  shares: Record<string, ShareRecord[]>; // postId -> shares
}

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', 'data') : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'social_interactions.json');

// Supabase client for DB synchronization
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wlvzjhpfcvwcgyelpsnx.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_Gd_1w7RmnkKKeQ5RhobaPw_MPrka48J';
const supabase = createClient(supabaseUrl, supabaseKey);

function ensureDataFile(): SocialDataStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial: SocialDataStore = { reactions: {}, shares: {} };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      reactions: parsed.reactions || {},
      shares: parsed.shares || {},
    };
  } catch (err) {
    console.warn('[SocialStore] Error reading data file, using in-memory store:', err);
    return { reactions: {}, shares: {} };
  }
}

function saveData(data: SocialDataStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('[SocialStore] Error saving data file:', err);
  }
}

// Memory cache
let store: SocialDataStore = ensureDataFile();

export function getPostSocialStats(postId: string, currentUserId?: string) {
  const postReactions = store.reactions[postId] || [];
  const postShares = store.shares[postId] || [];

  const breakdown: Record<ReactionType, number> = {
    like: 0,
    love: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
  };

  let userReaction: ReactionType | null = null;

  for (const r of postReactions) {
    if (breakdown[r.reactionType] !== undefined) {
      breakdown[r.reactionType]++;
    }
    if (currentUserId && r.userId === currentUserId) {
      userReaction = r.reactionType;
    }
  }

  // distinct active emojis used
  const activeEmojis = (Object.keys(breakdown) as ReactionType[]).filter(
    (k) => breakdown[k] > 0
  );

  return {
    postId,
    reactionsCount: postReactions.length,
    reactionBreakdown: breakdown,
    activeEmojis,
    userReaction,
    sharesCount: postShares.length,
    recentReactors: postReactions.slice(-8).reverse(),
  };
}

export function getPostReactorsList(postId: string) {
  const postReactions = store.reactions[postId] || [];
  return postReactions.map((r) => ({
    userId: r.userId,
    fullName: r.fullName,
    avatarUrl: r.avatarUrl,
    reactionType: r.reactionType,
    createdAt: r.createdAt,
  }));
}

export async function setOrToggleReaction(
  postId: string,
  userId: string,
  reactionType: ReactionType,
  userInfo?: { fullName?: string; avatarUrl?: string }
): Promise<{
  action: 'added' | 'removed' | 'updated';
  currentReaction: ReactionType | null;
  stats: ReturnType<typeof getPostSocialStats>;
}> {
  if (!store.reactions[postId]) {
    store.reactions[postId] = [];
  }

  const list = store.reactions[postId];
  const existingIndex = list.findIndex((r) => r.userId === userId);

  let action: 'added' | 'removed' | 'updated' = 'added';
  let currentReaction: ReactionType | null = reactionType;

  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    if (existing.reactionType === reactionType) {
      // Toggle off: removing reaction
      list.splice(existingIndex, 1);
      action = 'removed';
      currentReaction = null;

      // Sync removal to Supabase post_likes
      try {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);
      } catch (dbErr) {
        console.warn('[SocialStore] DB post_likes delete warning:', dbErr);
      }
    } else {
      // Switch to new reaction
      list[existingIndex] = {
        ...existing,
        reactionType,
        fullName: userInfo?.fullName || existing.fullName,
        avatarUrl: userInfo?.avatarUrl || existing.avatarUrl,
        createdAt: new Date().toISOString(),
      };
      action = 'updated';
      currentReaction = reactionType;
    }
  } else {
    // Add new reaction
    list.push({
      userId,
      fullName: userInfo?.fullName || 'Membre Afrique Business',
      avatarUrl: userInfo?.avatarUrl,
      reactionType,
      createdAt: new Date().toISOString(),
    });
    action = 'added';
    currentReaction = reactionType;

    // Sync insertion to Supabase post_likes (for compatibility)
    try {
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existingLike) {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
      }
    } catch (dbErr) {
      console.warn('[SocialStore] DB post_likes insert warning:', dbErr);
    }
  }

  saveData(store);

  return {
    action,
    currentReaction,
    stats: getPostSocialStats(postId, userId),
  };
}

export function recordShareEvent(
  postId: string,
  userId: string,
  shareType: ShareRecord['shareType'],
  commentary?: string,
  createdPostId?: string
): { sharesCount: number } {
  if (!store.shares[postId]) {
    store.shares[postId] = [];
  }

  const shareItem: ShareRecord = {
    id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    shareType,
    commentary,
    createdPostId,
    createdAt: new Date().toISOString(),
  };

  store.shares[postId].push(shareItem);
  saveData(store);

  return { sharesCount: store.shares[postId].length };
}

export function getBatchStats(postIds: string[], currentUserId?: string) {
  const result: Record<string, ReturnType<typeof getPostSocialStats>> = {};
  for (const id of postIds) {
    result[id] = getPostSocialStats(id, currentUserId);
  }
  return result;
}
