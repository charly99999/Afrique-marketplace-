import React, { useState } from 'react';
import { CountryCode, AppNotification, StoredUser } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { 
  Bell, Search, Settings, Sparkles, X, 
  Check, User, LogIn, ChevronRight, CheckCircle2, ShieldCheck, Trash2
} from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface HeaderProps {
  currentCountry: CountryCode;
  onOpenCountryModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenAuthModal: () => void;
  onOpenTermsModal?: () => void;
  notifications: AppNotification[];
  onMarkNotificationsRead: () => void;
  onClearNotifications?: () => void;
  currentUser: StoredUser | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onLogoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCountry,
  onOpenCountryModal,
  onOpenSettingsModal,
  onOpenAuthModal,
  onOpenTermsModal,
  notifications,
  onMarkNotificationsRead,
  onClearNotifications,
  currentUser,
  searchQuery,
  onSearchChange,
  onLogoClick,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const country = AFRICAN_COUNTRIES[currentCountry] || AFRICAN_COUNTRIES.CI;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0E0E0E] border-b border-[#222222] px-3 sm:px-4 pt-3 pb-2.5">
        {/* Top Lockup Row */}
        <div className="flex items-center justify-between mb-2.5">
          {/* Logo & Name */}
          <button
            onClick={onLogoClick}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
            title="Afrique Business - Accueil"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#F5A623]/40 bg-black flex items-center justify-center shadow-md group-hover:scale-102 transition-transform">
              <img
                src={officialLogoImg}
                alt="Afrique Business"
                className="w-full h-full object-cover scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-base font-extrabold text-white tracking-tight">Afrique</span>{' '}
                <span className="text-base font-extrabold text-[#F5A623] tracking-tight">Business</span>
              </div>
              <span className="text-[10px] text-gray-400 block -mt-1 font-medium">Tout l'Afrique, un seul marché</span>
            </div>
          </button>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Country Selector */}
            <button
              onClick={onOpenCountryModal}
              className="text-xs font-semibold px-2 py-1 rounded-lg bg-[#1C1C1C] text-gray-300 hover:text-white border border-[#2D2D2D] flex items-center gap-1 cursor-pointer transition-colors"
              title="Changer de pays / devise"
            >
              <span>{country.flag}</span>
              <span className="hidden xs:inline">{country.name}</span>
            </button>

            {/* Auth / Profile quick badge */}
            {currentUser ? (
              <button
                onClick={onOpenSettingsModal}
                className="w-8 h-8 rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black flex items-center justify-center font-black text-xs border border-amber-300 cursor-pointer shadow-md"
                title={`Connecté en tant que ${currentUser.fullName}`}
              >
                {currentUser.firstName?.[0] || 'U'}
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-2.5 py-1 rounded-lg bg-[#F5A623] text-[#1A1A1A] font-extrabold text-xs flex items-center gap-1 hover:brightness-110 cursor-pointer transition-all shadow-xs"
                title="Se connecter ou s'inscrire"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">Connexion</span>
              </button>
            )}

            {/* Settings button */}
            <button
              onClick={onOpenSettingsModal}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-[#1E1E1E] transition-colors cursor-pointer"
              title="Paramètres de l'application"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => {
                setShowNotifications(true);
                onMarkNotificationsRead();
              }}
              className="relative p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-[#1E1E1E] transition-colors cursor-pointer"
              title="Centre de notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 min-w-4 h-4 px-1 rounded-full bg-[#DC2626] text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#F5A623] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Rechercher un produit, véhicule, terrain, service en ${country.name}...`}
            className="w-full pl-10 pr-4 py-2 rounded-full bg-[#1A1A1A] border border-[#2D2D2D] text-xs text-white placeholder-gray-500 font-medium focus:border-[#F5A623] focus:outline-none transition-colors"
          />
        </div>
      </header>

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#161616] border-l border-[#2D2D2D] h-full shadow-2xl flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D2D2D]">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#F5A623]" />
                <h3 className="font-extrabold text-sm text-white">Vos Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && onClearNotifications && (
                  <button
                    onClick={onClearNotifications}
                    className="p-1 rounded text-gray-400 hover:text-red-400 text-[11px] flex items-center gap-1"
                    title="Vider les notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="text-center py-16 text-gray-500 text-xs">
                  <Bell className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-50" />
                  <p>Aucune notification pour le moment.</p>
                  <p className="text-[11px] text-gray-600 mt-1">Vous recevrez des alertes lors de vos publications et transactions.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-[#1E1E1E] border border-[#2D2D2D] text-left hover:border-[#3D3D3D] transition-colors"
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-[#F5A623]">{n.title}</span>
                      <span className="text-[10px] text-gray-500">{n.timestamp}</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowNotifications(false)}
              className="w-full py-2.5 bg-[#252525] hover:bg-[#333] text-xs font-bold rounded-xl text-gray-300 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
