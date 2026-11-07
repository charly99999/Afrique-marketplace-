import React from 'react';
import { ReactionType, REACTION_CONFIGS, ORDERED_REACTIONS } from '../../lib/socialApi';

interface ReactionPickerProps {
  onSelectReaction: (type: ReactionType) => void;
  onClose?: () => void;
  currentReaction?: ReactionType | null;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelectReaction,
  onClose,
  currentReaction,
}) => {
  return (
    <div
      className="absolute bottom-full left-0 mb-2 z-40 bg-white border border-[#E5E8EF] rounded-full px-2.5 py-1.5 shadow-xl flex items-center gap-1.5 animate-reaction-pop select-none"
      style={{
        boxShadow: '0 10px 25px -5px rgba(23, 32, 51, 0.15), 0 8px 10px -6px rgba(23, 32, 51, 0.1)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {ORDERED_REACTIONS.map((type, index) => {
        const item = REACTION_CONFIGS[type];
        const isSelected = currentReaction === type;

        return (
          <button
            key={type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectReaction(type);
              onClose?.();
            }}
            className="group relative p-1.5 rounded-full hover:bg-[#F1F4F9] transition-transform duration-150 transform hover:scale-135 active:scale-110 cursor-pointer flex items-center justify-center min-w-[38px] min-h-[38px]"
            style={{
              animationDelay: `${index * 30}ms`,
            }}
            title={item.label}
          >
            {/* Tooltip Label */}
            <span className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-[#172033] text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none whitespace-nowrap shadow-md z-50">
              {item.label}
            </span>

            {/* Emoji with bouncing scale */}
            <span
              className={`text-2xl transition-transform leading-none ${
                isSelected ? 'scale-115 filter drop-shadow-sm' : ''
              }`}
            >
              {item.emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
};
