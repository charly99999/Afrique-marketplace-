import React from 'react';
import { CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { X, Check, Globe } from 'lucide-react';

interface CountryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCountry: CountryCode;
  onSelectCountry: (country: CountryCode) => void;
  scopeAllAfrica?: boolean;
  onToggleScopeAllAfrica?: (all: boolean) => void;
  currentLang?: string;
  onSelectLang?: (lang: string) => void;
}

export const CountryModal: React.FC<CountryModalProps> = ({
  isOpen,
  onClose,
  selectedCountry,
  onSelectCountry,
  scopeAllAfrica = false,
  onToggleScopeAllAfrica,
  currentLang = 'fr',
  onSelectLang,
}) => {
  if (!isOpen) return null;

  const languages = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'pt', label: 'Português' },
    { code: 'sw', label: 'Kiswahili' },
    { code: 'ar', label: 'العربية (RTL)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#131317] border border-zinc-800 p-5 shadow-2xl flex flex-col max-h-[90vh] text-white">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Pays, Devise & Langue
            </h3>
            <p className="text-xs text-gray-400">
              Adapte les annonces et la devise du marché
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-white bg-zinc-800/80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
          {/* Scope Toggle: Mon Pays vs Toute l'Afrique if handler provided */}
          {onToggleScopeAllAfrica && (
            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">
                Portée du Marché
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onToggleScopeAllAfrica(false)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    !scopeAllAfrica
                      ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black border-transparent shadow-md'
                      : 'bg-[#18181F] text-gray-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <span>{AFRICAN_COUNTRIES[selectedCountry]?.flag}</span>
                  <span>Mon Pays</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleScopeAllAfrica(true)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    scopeAllAfrica
                      ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black border-transparent shadow-md'
                      : 'bg-[#18181F] text-gray-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>Toute l'Afrique</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Countries */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">
              Choisir votre pays
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
              {Object.values(AFRICAN_COUNTRIES).map((c) => {
                const isSelected = selectedCountry === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onSelectCountry(c.code);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1A1A22] border-[#D4AF37]'
                        : 'border-zinc-800 hover:border-zinc-700 bg-[#16161C]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.flag}</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          {c.name}
                          <span className="text-[11px] font-normal text-gray-400">
                            ({c.phonePrefix})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#D4AF37] font-semibold">
                          Devise : {c.currency} ({c.symbol})
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 stroke-[3] text-[#D4AF37]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Languages */}
          {onSelectLang && (
            <div>
              <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">
                Langue de l'interface
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => onSelectLang(l.code)}
                    className={`p-2 rounded-xl text-xs font-semibold border text-center transition-all cursor-pointer ${
                      currentLang === l.code
                        ? 'bg-[#1A1A22] border-[#D4AF37] text-[#D4AF37]'
                        : 'border-zinc-800 text-gray-300 hover:border-zinc-700 bg-[#16161C]'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-black text-xs cursor-pointer shadow-md shadow-amber-500/20"
        >
          Valider et fermer
        </button>
      </div>
    </div>
  );
};
