import React, { useState } from 'react';
import { ReactorItem, ReactionType, REACTION_CONFIGS, ORDERED_REACTIONS } from '../../lib/socialApi';
import { X, Users } from 'lucide-react';

interface PostReactorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reactors: ReactorItem[];
  reactionBreakdown: Record<ReactionType, number>;
  totalCount: number;
}

export const PostReactorsModal: React.FC<PostReactorsModalProps> = ({
  isOpen,
  onClose,
  reactors,
  reactionBreakdown,
  totalCount,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | ReactionType>('all');

  if (!isOpen) return null;

  const filteredReactors = selectedFilter === 'all'
    ? reactors
    : reactors.filter((r) => r.reactionType === selectedFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#E5E8EF] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#172033]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E8EF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F1F4F9] text-[#C69A35] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172033]">
                Personnes ayant réagi
              </h3>
              <p className="text-[11px] text-[#596273]">
                {totalCount} réaction{totalCount > 1 ? 's' : ''} au total
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#596273] hover:text-[#172033] hover:bg-[#F1F4F9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reaction Filter Tabs */}
        <div className="px-3 py-2 border-b border-[#E5E8EF] flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#F8F9FC]">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-[#172033] text-white shadow-xs'
                : 'bg-white border border-[#E5E8EF] text-[#596273] hover:text-[#172033]'
            }`}
          >
            <span>Toutes</span>
            <span className="text-[10px] opacity-80">({totalCount})</span>
          </button>

          {ORDERED_REACTIONS.map((type) => {
            const count = reactionBreakdown[type] || 0;
            if (count === 0) return null;
            const item = REACTION_CONFIGS[type];
            const isSelected = selectedFilter === type;

            return (
              <button
                key={type}
                onClick={() => setSelectedFilter(type)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-white border-2 border-[#C69A35] text-[#172033] shadow-xs'
                    : 'bg-white border border-[#E5E8EF] text-[#596273] hover:text-[#172033]'
                }`}
              >
                <span>{item.emoji}</span>
                <span className="text-[11px] font-bold">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Reactors List */}
        <div className="p-3 overflow-y-auto divide-y divide-[#E5E8EF]/60 space-y-2 flex-1">
          {filteredReactors.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#596273]">
              Aucune réaction dans cette catégorie.
            </div>
          ) : (
            filteredReactors.map((reactor, i) => {
              const item = REACTION_CONFIGS[reactor.reactionType];
              const initials = (reactor.fullName || 'Membre')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div key={i} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {reactor.avatarUrl ? (
                        <img
                          src={reactor.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-[#E5E8EF]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] font-bold text-xs flex items-center justify-center">
                          {initials}
                        </div>
                      )}
                      {/* Emoji Badge on Avatar */}
                      <span className="absolute -bottom-1 -right-1 text-sm bg-white rounded-full p-0.5 shadow-xs border border-[#E5E8EF] leading-none">
                        {item.emoji}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-[#172033]">
                        {reactor.fullName || 'Membre Afrique Business'}
                      </h4>
                      <span className="text-[10px] text-[#596273]">
                        {item.label} · {new Date(reactor.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full border"
                    style={{
                      color: item.color,
                      backgroundColor: item.badgeBg,
                      borderColor: `${item.color}30`,
                    }}
                  >
                    {item.emoji} {item.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
