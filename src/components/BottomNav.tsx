import React from 'react';
import { Home, Compass, Plus, MessageSquare, User } from 'lucide-react';

export type NavTab = 'feed' | 'explore' | 'sell' | 'messages' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  unreadMessagesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadMessagesCount = 0,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#101010]/95 backdrop-blur-md border-t border-[#262626] pb-safe shadow-2xl max-w-lg mx-auto">
      <div className="grid grid-cols-5 items-center h-16 px-1">
        {/* Accueil */}
        <button
          onClick={() => onTabChange('feed')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'feed'
              ? 'text-[#F5A623] font-bold'
              : 'text-gray-400 font-medium hover:text-gray-200'
          }`}
        >
          <Home className={`w-5 h-5 ${activeTab === 'feed' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Accueil</span>
        </button>

        {/* Explorer */}
        <button
          onClick={() => onTabChange('explore')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'explore'
              ? 'text-[#F5A623] font-bold'
              : 'text-gray-400 font-medium hover:text-gray-200'
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === 'explore' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Explorer</span>
        </button>

        {/* Vendre (Bouton rond or au centre) */}
        <div className="flex flex-col items-center justify-center relative -top-3">
          <button
            onClick={() => onTabChange('sell')}
            className="w-13 h-13 rounded-full bg-linear-to-tr from-[#E5A93B] via-[#F5A623] to-[#FFD166] text-[#1A1A1A] flex items-center justify-center shadow-lg shadow-[#F5A623]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border-3 border-[#101010]"
            title="Publier une annonce en 60s"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
          <span className="text-[10px] font-extrabold text-[#F5A623] mt-0.5 tracking-tight">Vendre</span>
        </div>

        {/* Messages & Offres */}
        <button
          onClick={() => onTabChange('messages')}
          className={`relative flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'messages'
              ? 'text-[#F5A623] font-bold'
              : 'text-gray-400 font-medium hover:text-gray-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 ${activeTab === 'messages' ? 'stroke-[2.5]' : 'stroke-2'}`} />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] text-white text-[9px] font-extrabold flex items-center justify-center shadow-sm">
                {unreadMessagesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Messages</span>
        </button>

        {/* Profil */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center min-h-[48px] transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#F5A623] font-bold'
              : 'text-gray-400 font-medium hover:text-gray-200'
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-2'}`} />
          <span className="text-[10px] mt-1 tracking-tight">Profil</span>
        </button>
      </div>
    </nav>
  );
};
