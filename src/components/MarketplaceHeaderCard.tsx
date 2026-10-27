import React from 'react';
import { CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { CATEGORIES_LIST, CategoryGoldIcon, CategoryKey } from '../data/categories';
import { Plus, Search, Grid } from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';

interface MarketplaceHeaderCardProps {
  currentCountry: CountryCode;
  onDepositClick: () => void;
  subSearchQuery: string;
  onSubSearchChange: (q: string) => void;
  selectedCategory: CategoryKey | 'ALL';
  onSelectCategory: (cat: CategoryKey | 'ALL') => void;
}

export const MarketplaceHeaderCard: React.FC<MarketplaceHeaderCardProps> = ({
  currentCountry,
  onDepositClick,
  subSearchQuery,
  onSubSearchChange,
  selectedCategory,
  onSelectCategory,
}) => {
  const country = AFRICAN_COUNTRIES[currentCountry] || AFRICAN_COUNTRIES.CI;

  return (
    <div className="px-4 py-3 bg-[#0E0E0E] space-y-3.5 border-b border-[#222]">
      {/* Marketplace Banner */}
      <div className="flex items-center gap-3.5">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black border border-[#D4AF37]/40 shrink-0 shadow-lg shadow-amber-500/10">
          <img
            src={officialLogoImg}
            alt="Afrique Business"
            className="w-full h-full object-cover scale-105"
          />
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none font-serif">
            Afrique Business
          </h1>
          <p className="text-xs text-gray-400 mt-1 leading-snug">
            Place de marché panafricaine en {country.name}.
          </p>
        </div>
      </div>

      {/* Prominent Golden Button: "+ Déposer une annonce" */}
      <button
        onClick={onDepositClick}
        className="w-full py-3 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] hover:brightness-110 active:scale-98 transition-all text-[#1A1A1A] font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer min-h-[44px]"
      >
        <Plus className="w-5 h-5 stroke-[3]" />
        <span>Déposer une annonce</span>
      </button>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={subSearchQuery}
          onChange={(e) => onSubSearchChange(e.target.value)}
          placeholder="Rechercher un produit, une ville..."
          className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#1A1A1A] border border-[#2D2D2D] text-xs text-white placeholder-gray-500 font-medium focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
        />
      </div>

      {/* Horizontal Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
        <button
          onClick={() => onSelectCategory('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
            selectedCategory === 'ALL'
              ? 'bg-[#D4AF37] text-[#1A1A1A] shadow-md shadow-amber-500/25'
              : 'bg-[#1C1C1C] text-gray-300 border border-[#2D2D2D] hover:bg-[#252525]'
          }`}
        >
          <Grid className="w-4 h-4 stroke-[2.2]" />
          <span>Tout</span>
        </button>

        {CATEGORIES_LIST.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                isSelected
                  ? 'bg-[#D4AF37] text-[#1A1A1A] shadow-md shadow-amber-500/25'
                  : 'bg-[#1C1C1C] text-gray-300 border border-[#2D2D2D] hover:bg-[#252525]'
              }`}
            >
              <CategoryGoldIcon
                categoryKey={cat.id}
                className={`w-4 h-4 ${isSelected ? 'text-black' : 'text-[#D4AF37]'}`}
              />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
