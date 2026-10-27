import React from 'react';
import { usePWAUpdate, useOnlineStatus } from '../hooks/usePWAInstall';
import { RefreshCw, WifiOff, Sparkles, X } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const { hasUpdate, updateApp } = usePWAUpdate();
  const isOnline = useOnlineStatus();
  const [offlineDismissed, setOfflineDismissed] = React.useState(false);

  // If online status recovered, reset dismissed state so it alerts next time offline happens
  React.useEffect(() => {
    if (isOnline) {
      setOfflineDismissed(false);
    }
  }, [isOnline]);

  return (
    <>
      {/* 1. Offline Mode Banner */}
      {!isOnline && !offlineDismissed && (
        <div className="fixed top-2 left-3 right-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-fade-slide-up">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[#1C1508] border border-amber-500/50 text-amber-200 text-xs shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white block">Mode hors-ligne</span>
                <span className="text-[11px] text-amber-300/90 truncate block">
                  Pas de connexion • Données en cache accessibles
                </span>
              </div>
            </div>
            <button
              onClick={() => setOfflineDismissed(true)}
              className="p-1 rounded-full hover:bg-black/40 text-amber-300/80 hover:text-white cursor-pointer shrink-0"
              aria-label="Fermer le bandeau hors-ligne"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Service Worker New Version Available Notification */}
      {hasUpdate && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-fade-slide-up">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-linear-to-r from-[#181820] to-[#111116] border border-[#D4AF37] shadow-2xl shadow-black/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-extrabold text-white">
                  Nouvelle version disponible
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  Une mise à jour d'Afrique Business est prête.
                </p>
              </div>
            </div>

            <button
              onClick={() => updateApp()}
              className="px-3.5 py-2 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black flex items-center gap-1.5 cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-md shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
