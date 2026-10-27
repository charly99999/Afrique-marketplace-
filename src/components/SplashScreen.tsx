import React, { useEffect, useState } from 'react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [fading, setFading] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    // Start subtle zoom
    const zoomTimer = setTimeout(() => setZoomed(true), 50);

    // Fade out at 2 seconds
    const timer = setTimeout(() => {
      setFading(true);
      setTimeout(onFinish, 450);
    }, 2000);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(timer);
    };
  }, [onFinish]);

  return (
    <div
      onClick={onFinish}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0E0E0E] transition-opacity duration-500 cursor-pointer ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center text-center px-6">
        {/* Official Carved Gold Elephant Logo */}
        <div
          className={`relative w-36 h-36 mb-6 rounded-3xl overflow-hidden shadow-2xl shadow-[#D4AF37]/20 border border-[#D4AF37]/40 bg-[#0E0E0E] transition-transform duration-1500 ease-out ${
            zoomed ? 'scale-105' : 'scale-95'
          }`}
        >
          <img
            src={officialLogoImg}
            alt="Afrique Business"
            className="w-full h-full object-cover"
          />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-white font-sans">
          Afrique <span className="text-[#D4AF37]">Business</span>
        </h1>

        <p className="text-sm font-medium text-[#C5A059] tracking-wide mb-8">
          Tout l'Afrique, un seul marché
        </p>

        <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
          <span className="inline-block w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
          <span>Chargement en cours...</span>
        </div>
      </div>
    </div>
  );
};
