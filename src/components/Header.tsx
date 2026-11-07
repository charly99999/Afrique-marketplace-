import React, { useState } from 'react';
import { CountryCode, AppNotification, StoredUser } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { 
  Bell, Search, Settings, X, 
  LogIn, Trash2
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
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E8EF] px-3 sm:px-4 pt-3 pb-2.5 shadow-xs">
        {/* Top Lockup Row */}
        <div className="flex items-center justify-between mb-2.5">
          {/* Logo & Name */}
          <button
            onClick={onLogoClick}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
            title="Afrique Business - Accueil"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#C69A35]/30 bg-black flex items-center justify-center shadow-xs group-hover:scale-102 transition-transform shrink-0">
              <img
                src={officialLogoImg}
                alt="Afrique Business"
                className="w-full h-full object-cover scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-base font-extrabold text-[#172033] tracking-tight">Afrique</span>{' '}
                <span className="text-base font-extrabold text-[#C69A35] tracking-tight">Business</span>
              </div>
              <span className="text-[10px] text-[#596273] block -mt-1 font-medium">
                Tout l'Afrique, un seul marché
              </span>
            </div>
          </button>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Country Selector */}
            <button
              onClick={onOpenCountryModal}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-[#F1F4F9] text-[#172033] hover:bg-[#E5E8EF] border border-[#E5E8EF] flex items-center gap-1 cursor-pointer transition-colors"
              title="Changer de pays / devise"
            >
              <span>{country.flag}</span>
              <span className="hidden xs:inline">{country.name}</span>
            </button>

            {/* Auth / Profile quick badge */}
            {currentUser ? (
              <button
                onClick={onOpenSettingsModal}
                className="w-8 h-8 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] flex items-center justify-center font-bold text-xs border border-[#C69A35]/40 cursor-pointer shadow-xs"
                title={`Connecté en tant que ${currentUser.fullName}`}
              >
                {currentUser.firstName?.[0] || 'U'}
              </button>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="px-3 py-1.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] font-bold text-xs flex items-center gap-1 hover:brightness-105 cursor-pointer transition-all shadow-xs"
                title="Se connecter ou s'inscrire"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">Connexion</span>
              </button>
            )}

            {/* Settings button */}
            <button
              onClick={onOpenSettingsModal}
              className="p-2 rounded-xl text-[#596273] hover:text-[#172033] hover:bg-[#F1F4F9] transition-colors cursor-pointer"
              title="Paramètres de l'application"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => {
                setShowNotifications(true);
                onMarkNotificationsRead();
              }}
              className="relative p-2 rounded-xl text-[#596273] hover:text-[#172033] hover:bg-[#F1F4F9] transition-colors cursor-pointer"
              title="Centre de notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#C69A35] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Rechercher un produit, véhicule, terrain, service en ${country.name}...`}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#F1F4F9] border border-[#E5E8EF] text-xs text-[#172033] placeholder-[#596273] font-medium focus:bg-white focus:border-[#C69A35] focus:outline-none transition-colors"
          />
        </div>
      </header>

      {/* Notifications Drawer */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white border-l border-[#E5E8EF] h-full shadow-2xl flex flex-col p-4 text-[#172033]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E8EF]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#C69A35]/15 text-[#C69A35] flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-[#172033]">Vos Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && onClearNotifications && (
                  <button
                    onClick={onClearNotifications}
                    className="p-1 rounded text-[#596273] hover:text-red-600 text-[11px] flex items-center gap-1"
                    title="Vider les notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1.5 rounded-full text-[#596273] hover:text-[#172033] hover:bg-[#F1F4F9]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="text-center py-16 text-[#596273] text-xs space-y-1">
                  <Bell className="w-8 h-8 text-[#C69A35]/40 mx-auto mb-2" />
                  <p className="font-semibold text-[#172033]">Aucune notification pour le moment.</p>
                  <p className="text-[11px] text-[#596273]">
                    Vous recevrez des alertes lors de vos publications et transactions.
                  </p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-left hover:border-[#C69A35]/50 transition-colors shadow-xs"
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs font-bold text-[#C69A35]">{n.title}</span>
                      <span className="text-[10px] text-[#596273]">{n.timestamp}</span>
                    </div>
                    <p className="text-xs text-[#172033] leading-relaxed">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowNotifications(false)}
              className="w-full py-2.5 bg-[#F1F4F9] hover:bg-[#E5E8EF] text-xs font-bold rounded-xl text-[#172033] cursor-pointer transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
};
