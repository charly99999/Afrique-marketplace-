import React, { useState, useEffect } from 'react';
import { usePWAUpdate, useOnlineStatus } from '../hooks/usePWAInstall';
import { RefreshCw, WifiOff, Sparkles, CheckCircle, ShieldCheck, X } from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

export const PWAUpdateToast: React.FC = () => {
  const { hasUpdate, updateInfo, isUpdating, updateApp, dismissUpdate } = usePWAUpdate();
  const isOnline = useOnlineStatus();
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // When an update is detected, automatically open the confirmation modal
  useEffect(() => {
    if (hasUpdate) {
      setShowModal(true);
    }
  }, [hasUpdate]);

  // Reset offline dismissal once internet reconnects
  useEffect(() => {
    if (isOnline) {
      setOfflineDismissed(false);
    }
  }, [isOnline]);

  const handleConfirmUpdate = async () => {
    await updateApp();
  };

  const handleDismissModal = () => {
    setShowModal(false);
    // Modal is dismissed, but floating reminder remains so user can update whenever ready
  };

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
                  Pas de connexion • Vos données locales restent consultables
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

      {/* 2. Floating Reminder Badge (When modal was closed but update still pending) */}
      {hasUpdate && !showModal && (
        <div className="fixed bottom-20 right-3 sm:bottom-6 sm:right-6 z-50 animate-fade-slide-up">
          <button
            onClick={() => setShowModal(true)}
            className="p-2.5 px-3.5 rounded-2xl bg-[#181820] border border-[#D4AF37] text-white text-xs font-bold shadow-2xl flex items-center gap-2 cursor-pointer hover:bg-[#22222C] transition-all"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4AF37]"></span>
            </span>
            <span>Mise à jour prête</span>
            <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37]" />
          </button>
        </div>
      )}

      {/* 3. High-Priority Interactive Update Confirmation Modal (Demande Expresse) */}
      {hasUpdate && showModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-[#121217] border border-[#D4AF37]/50 shadow-2xl shadow-amber-500/10 p-5 sm:p-6 text-white text-center space-y-4">
            
            {/* Top Brand & Sparkle Visual */}
            <div className="relative w-16 h-16 mx-auto">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black border-2 border-[#D4AF37] shadow-xl flex items-center justify-center mx-auto">
                <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black flex items-center justify-center shadow-md">
                <Sparkles className="w-3.5 h-3.5 fill-black stroke-black" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black uppercase tracking-wider">
                Mise à jour disponible
              </div>
              <h3 className="text-base sm:text-lg font-black text-white">
                Nouvelle version d'Afrique Business
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto">
                Des modifications et améliorations récentes ont été publiées. Confirmez pour mettre à jour l'application et redémarrer avec tout le contenu au complet.
              </p>
            </div>

            {/* Highlights Box */}
            <div className="p-3.5 rounded-2xl bg-[#181820] border border-zinc-800 text-left text-xs space-y-2 text-gray-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dernières publications et correctifs appliqués</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Nettoyage automatique du cache et rechargement fluide</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Vos annonces, favoris et discussions restent intacts</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={handleConfirmUpdate}
                disabled={isUpdating}
                className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] via-[#F59E0B] to-[#C5A059] text-black font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                <RefreshCw className={`w-4 h-4 stroke-[3] ${isUpdating ? 'animate-spin' : ''}`} />
                <span>
                  {isUpdating ? 'Mise à jour et redémarrage en cours...' : 'Confirmer et mettre à jour'}
                </span>
              </button>

              {!isUpdating && (
                <button
                  onClick={handleDismissModal}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-zinc-800/50 transition-colors cursor-pointer"
                >
                  Mettre à jour plus tard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
