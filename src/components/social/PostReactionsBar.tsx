import React, { useState, useRef, useEffect } from 'react';
import { 
  ReactionType, REACTION_CONFIGS, PostSocialStats, 
  sendPostReaction, fetchPostReactors, ReactorItem 
} from '../../lib/socialApi';
import { ReactionPicker } from './ReactionPicker';
import { ThumbsUp } from 'lucide-react';

interface PostReactionsBarProps {
  postId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  initialStats?: PostSocialStats;
  onRequireAuth: () => void;
  onOpenReactorsModal: (reactors: ReactorItem[], stats: PostSocialStats) => void;
}

export const PostReactionsBar: React.FC<PostReactionsBarProps> = ({
  postId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  initialStats,
  onRequireAuth,
  onOpenReactorsModal,
}) => {
  const [stats, setStats] = useState<PostSocialStats>(() => {
    return (
      initialStats || {
        postId,
        reactionsCount: 0,
        reactionBreakdown: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
        activeEmojis: [],
        userReaction: null,
        sharesCount: 0,
        recentReactors: [],
      }
    );
  });

  const [showPicker, setShowPicker] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when initialStats change from parent batch loading
  useEffect(() => {
    if (initialStats) {
      setStats(initialStats);
    }
  }, [initialStats]);

  // Close picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleSelectReaction = async (reactionType: ReactionType) => {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }

    // Trigger visual pop animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Optimistic state update
    const prevReaction = stats.userReaction;
    const isRemoving = prevReaction === reactionType;
    const nextReaction = isRemoving ? null : reactionType;

    const newBreakdown = { ...stats.reactionBreakdown };
    if (prevReaction) {
      newBreakdown[prevReaction] = Math.max(0, newBreakdown[prevReaction] - 1);
    }
    if (nextReaction) {
      newBreakdown[nextReaction] = (newBreakdown[nextReaction] || 0) + 1;
    }

    const newTotal = Object.values(newBreakdown).reduce((a, b) => a + b, 0);
    const newActiveEmojis = (Object.keys(newBreakdown) as ReactionType[]).filter(
      (k) => newBreakdown[k] > 0
    );

    setStats((prev) => ({
      ...prev,
      reactionsCount: newTotal,
      reactionBreakdown: newBreakdown,
      activeEmojis: newActiveEmojis,
      userReaction: nextReaction,
    }));

    setShowPicker(false);

    // Send to backend and persist
    try {
      const res = await sendPostReaction(postId, currentUserId, reactionType, {
        fullName: currentUserName,
        avatarUrl: currentUserAvatar,
      });
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  // Quick tap: toggle default 'like'
  const handleQuickTap = () => {
    if (!currentUserId) {
      onRequireAuth();
      return;
    }
    // If user already has a reaction, quick tap removes it
    // If unreacted, quick tap sets 'like'
    handleSelectReaction(stats.userReaction || 'like');
  };

  // Touch Long-press handler
  const handleTouchStart = () => {
    setIsPressing(true);
    longPressTimerRef.current = setTimeout(() => {
      setShowPicker(true);
      setIsPressing(false);
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setIsPressing(false);
  };

  // Desktop hover handler
  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setShowPicker(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  };

  // Open reactors modal
  const handleViewReactors = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (stats.reactionsCount === 0) return;
    const res = await fetchPostReactors(postId, currentUserId);
    if (res) {
      onOpenReactorsModal(res.reactors, res.stats);
    } else {
      onOpenReactorsModal(stats.recentReactors, stats);
    }
  };

  // Current user reaction configuration
  const activeConfig = stats.userReaction ? REACTION_CONFIGS[stats.userReaction] : null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      {/* Floating Reaction Picker */}
      {showPicker && (
        <ReactionPicker
          currentReaction={stats.userReaction}
          onSelectReaction={handleSelectReaction}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Main Interactive Reaction Button */}
      <div
        className="relative flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={handleQuickTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[38px] ${
            isPressing ? 'scale-95 bg-[#F1F4F9]' : ''
          } ${isAnimating ? 'animate-bounce-subtle' : ''} ${
            activeConfig
              ? 'bg-[#F8F9FC] border border-[#E5E8EF]'
              : 'text-[#596273] hover:text-[#172033] hover:bg-[#F8F9FC]'
          }`}
          style={activeConfig ? { color: activeConfig.color } : {}}
          title={activeConfig ? `Vous avez réagi : ${activeConfig.label}` : "Réagir à la publication"}
        >
          {activeConfig ? (
            <span className="text-base leading-none select-none">
              {activeConfig.emoji}
            </span>
          ) : (
            <ThumbsUp className="w-4 h-4 text-[#596273]" />
          )}

          <span className="tracking-tight select-none">
            {activeConfig ? activeConfig.label : "J'aime"}
          </span>
        </button>
      </div>

      {/* Distinct Emojis Stack + Total Reactions Count */}
      {stats.reactionsCount > 0 && (
        <button
          type="button"
          onClick={handleViewReactors}
          className="ml-2 flex items-center gap-1 text-xs text-[#596273] hover:text-[#172033] cursor-pointer transition-colors py-1 px-1.5 rounded-lg hover:bg-[#F8F9FC]"
          title="Voir qui a réagi"
        >
          {/* Stacked Distinct Emoji Bubbles (Max 3) */}
          <div className="flex -space-x-1.5 items-center mr-0.5">
            {stats.activeEmojis.slice(0, 3).map((type) => (
              <span
                key={type}
                className="w-4 h-4 rounded-full bg-white flex items-center justify-center text-[11px] shadow-xs border border-[#E5E8EF] leading-none"
              >
                {REACTION_CONFIGS[type].emoji}
              </span>
            ))}
          </div>

          <span className="font-bold tabular-nums text-[#172033]">
            {stats.reactionsCount}
          </span>
        </button>
      )}
    </div>
  );
};
