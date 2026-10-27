import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, PlusSquare, X, Smartphone, CheckCircle2, Sparkles } from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface PWAInstallButtonProps {
  variant?: 'banner' | 'button' | 'compact';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'button',
  className = '',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already installed as standalone PWA
  if (isInstalled) {
    if (variant === 'button') {
      return (
        <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold ${className}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Application installée sur cet appareil</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (isInstallable) {
      setInstalling(true);
      try {
        const success = await install();
        if (success && onInstalled) {
          onInstalled();
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      } finally {
        setInstalling(false);
      }
      return;
    }

    // Fallback: If not iOS and beforeinstallprompt hasn't fired yet (or unsupported desktop)
    setShowIOSModal(true);
  };

  // iOS Instruction Modal
  const renderIOSModal = () => {
    if (!showIOSModal) return null;

    return (
      <div 
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-slide-up"
        onClick={() => setShowIOSModal(false)}
      >
        <div 
          className="w-full max-w-md bg-[#141418] border border-[#D4AF37]/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-[#D4AF37]/50 p-1 shrink-0">
                <img src={officialLogoImg} alt="Afrique Business" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Installer Afrique Business</h3>
                <p className="text-[11px] text-[#D4AF37] font-medium">Tout l'Afrique, un seul marché</p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="p-1.5 rounded-full bg-zinc-800/80 text-gray-400 hover:text-white cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Guide Steps */}
          {isIOS ? (
            <div className="space-y-3 text-xs text-gray-200">
              <p className="text-gray-300 font-medium">
                Pour installer l'application sur votre iPhone ou iPad :
              </p>

              <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">Touchez le bouton Partager</p>
                  <p className="text-gray-400 text-[11px] mt-0.5 flex items-center gap-1.5">
                    L'icône carrée avec flèche vers le haut <Share className="w-3.5 h-3.5 text-sky-400 inline" /> dans la barre Safari (en bas).
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">Faites défiler vers le bas</p>
                  <p className="text-gray-400 text-[11px] mt-0.5 flex items-center gap-1.5">
                    Sélectionnez <span className="text-[#D4AF37] font-bold">"Sur l'écran d'accueil"</span> <PlusSquare className="w-3.5 h-3.5 text-[#D4AF37] inline" />.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Confirmez en haut à droite</p>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    Touchez <strong className="text-white">"Ajouter"</strong> pour finaliser l'installation.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-gray-200">
              <p className="text-gray-300 font-medium">
                Pour ajouter Afrique Business sur votre écran d'accueil :
              </p>
              <div className="p-3 rounded-2xl bg-black/50 border border-zinc-800 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                <p className="text-gray-300 leading-relaxed">
                  Ouvrez le menu de votre navigateur (les <strong className="text-white">3 points ⋮</strong> en haut ou en bas), puis choisissez <strong className="text-[#D4AF37]">"Installer l'application"</strong> ou <strong className="text-[#D4AF37]">"Ajouter à l'écran d'accueil"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={() => setShowIOSModal(false)}
            className="w-full py-3 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold text-xs cursor-pointer shadow-lg hover:brightness-110 active:scale-[0.99] transition-all"
          >
            Compris
          </button>
        </div>
      </div>
    );
  };

  // 1. BANNER VARIANT (Feed View & Prominent surfaces)
  if (variant === 'banner') {
    if (isDismissed) return null;

    return (
      <>
        <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br from-[#1A1813] via-[#121216] to-[#0A0A0C] border border-[#D4AF37]/35 p-3.5 sm:p-4 shadow-xl ${className}`}>
          {/* Subtle gold glow background */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#D4AF37]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Dismiss button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-2.5 right-2.5 p-1 rounded-full text-zinc-400 hover:text-white bg-black/40 hover:bg-black/70 transition-colors cursor-pointer"
            aria-label="Ignorer temporairement"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6 sm:pr-0">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-black border border-[#D4AF37]/60 shrink-0 p-0.5 shadow-md">
                <img src={officialLogoImg} alt="Afrique Business Logo" className="w-full h-full object-cover rounded-lg" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#D4AF37] rounded-full ring-2 ring-[#0E0E0E]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-black text-white tracking-tight">Installer Afrique Business</h4>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-bold">
                    <Sparkles className="w-2.5 h-2.5" /> PWA Rapide
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 truncate sm:whitespace-normal">
                  Accès direct 1-clic, mode hors-ligne & démarrage instantané en 3G.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] hover:from-[#E5BF47] hover:to-[#FBBA33] text-black font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all min-h-[40px]"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{installing ? 'Installation...' : "Installer l'application"}</span>
              </button>
            </div>
          </div>
        </div>

        {renderIOSModal()}
      </>
    );
  }

  // 2. COMPACT VARIANT (Headers, Navbars, or small cards)
  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={installing}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/25 text-xs font-bold cursor-pointer transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Installer</span>
        </button>
        {renderIOSModal()}
      </>
    );
  }

  // 3. BUTTON VARIANT (SettingsModal > À propos or standalone)
  return (
    <>
      <button
        onClick={handleInstallClick}
        disabled={installing}
        className={`w-full py-3 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] hover:from-[#E5BF47] hover:to-[#FBBA33] text-black font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] transition-all min-h-[44px] ${className}`}
      >
        <Download className="w-4 h-4 stroke-[2.5]" />
        <span>{installing ? 'Installation en cours...' : "Installer l'application"}</span>
      </button>
      {renderIOSModal()}
    </>
  );
};
