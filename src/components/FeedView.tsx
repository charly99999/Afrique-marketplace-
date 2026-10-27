import React, { useState } from 'react';
import { Listing, CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { convertAndFormatPrice } from '../lib/currency';
import { CategoryKey } from '../lib/supabaseData';
import { CATEGORIES_LIST, CategoryGoldIcon } from '../data/categories';
import { 
  Search, ShieldCheck, Share2, MapPin, Plus, 
  Package, Grid, Car, Home, Wrench, Briefcase, Tag, Clock, ArrowUpDown, Phone
} from 'lucide-react';
import officialLogoImg from '../assets/images/logo_afrique_business_1792378287169.jpg';
import { PWAInstallButton } from './PWAInstallButton';

interface FeedViewProps {
  listings: Listing[];
  currentCountry: CountryCode;
  scopeAllAfrica: boolean;
  viewerCurrency: string;
  dataSaver: boolean;
  searchQuery?: string;
  onSelectListing: (listing: Listing) => void;
  onQuickSell: () => void;
  onOpenScopeModal: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  listings,
  currentCountry,
  scopeAllAfrica,
  viewerCurrency,
  dataSaver,
  searchQuery: externalSearchQuery = '',
  onSelectListing,
  onQuickSell,
  onOpenScopeModal,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [debouncedLocalSearch, setDebouncedLocalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | 'ALL'>('ALL');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | 'neuf' | 'occasion'>('ALL');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc'>('recent');
  const [visibleCount, setVisibleCount] = useState(100);

  // 400ms debounce on local search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocalSearch(localSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const activeSearch = externalSearchQuery.trim() || debouncedLocalSearch.trim();

  const countryConfig = AFRICAN_COUNTRIES[currentCountry] || AFRICAN_COUNTRIES.CI;

  // Filter listings based on country scope, category, condition, and search
  const filteredListings = listings.filter((l) => {
    if (!scopeAllAfrica && l.country !== currentCountry) {
      return false;
    }
    if (selectedCategory !== 'ALL' && l.category !== selectedCategory) {
      return false;
    }
    if (conditionFilter !== 'ALL' && l.condition !== conditionFilter) {
      return false;
    }
    if (activeSearch) {
      const q = activeSearch.toLowerCase();
      const matchTitle = (l.title || '').toLowerCase().includes(q);
      const matchCity = (l.city || '').toLowerCase().includes(q);
      const matchDesc = (l.description || '').toLowerCase().includes(q);
      const matchSub = (l.subcategory || '').toLowerCase().includes(q);
      return matchTitle || matchCity || matchDesc || matchSub;
    }
    return true;
  });

  // Sort
  if (sortBy === 'price_asc') {
    filteredListings.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    filteredListings.sort((a, b) => b.price - a.price);
  } else {
    filteredListings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const handleShareWhatsApp = (e: React.MouseEvent, listing: Listing) => {
    e.stopPropagation();
    const text = `🛍️ *${listing.title}*\n💰 Prix : *${listing.price.toLocaleString()} ${listing.currency}*\n📍 Lieu : ${listing.city}\n👉 Voir l'annonce sur *Afrique Business* : https://afrique-business.app/#/ad/${listing.id}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pb-28 bg-[#09090B] text-[#F8FAFC]">
      {/* Prestigious Marketplace Header matching Logo */}
      <div className="px-3.5 sm:px-6 pt-4 pb-4 bg-linear-to-b from-[#121216] to-[#09090B] border-b border-zinc-800 space-y-4">
        {/* Brand Banner */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl overflow-hidden bg-black border border-[#D4AF37]/50 shrink-0 shadow-lg shadow-amber-500/10">
              <img
                src={officialLogoImg}
                alt="Afrique Business"
                className="w-full h-full object-cover scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none">
                  Afrique <span className="text-[#D4AF37]">Business</span>
                </h1>
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-snug">
                {scopeAllAfrica ? (
                  <span>Toute l'Afrique (Marché continental)</span>
                ) : (
                  <span>
                    Marché actif : <span className="text-[#D4AF37] font-semibold">{countryConfig.name}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenScopeModal}
            className="px-3 py-1.5 rounded-xl bg-[#17171C] border border-zinc-700 hover:border-[#D4AF37]/50 text-xs text-gray-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Changer de pays"
          >
            <span className="text-base">{countryConfig.flag}</span>
            <span className="hidden sm:inline">{countryConfig.name}</span>
          </button>
        </div>

        {/* Primary Golden CTA Button */}
        <button
          onClick={onQuickSell}
          className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] via-[#F59E0B] to-[#C5A059] hover:brightness-110 active:scale-[0.99] transition-all text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer min-h-[46px]"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>+ Déposer une annonce en 60 secondes</span>
        </button>

        {/* Sleek Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={`Rechercher un article ou un service en ${countryConfig.name}...`}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141418] border border-zinc-800 text-base sm:text-xs text-white placeholder-zinc-500 font-medium focus:border-[#D4AF37] focus:outline-none transition-all"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Categories Bar (15 categories with golden SVG icons) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {/* All button */}
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[44px] ${
              selectedCategory === 'ALL'
                ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-md shadow-amber-500/20'
                : 'bg-[#141418] border border-zinc-800 text-gray-300 hover:border-zinc-700 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Toutes les catégories</span>
          </button>

          {/* 15 African Business Categories */}
          {CATEGORIES_LIST.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[44px] ${
                  isSelected
                    ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black shadow-md shadow-amber-500/20'
                    : 'bg-[#141418] border border-zinc-800 text-gray-300 hover:border-zinc-700 hover:text-white'
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

        {/* Filters Bar: Condition & Sorting */}
        <div className="flex items-center justify-between text-xs pt-1">
          {/* Condition Pills */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setConditionFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                conditionFilter === 'ALL'
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Tous états
            </button>
            <button
              onClick={() => setConditionFilter('neuf')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                conditionFilter === 'neuf'
                  ? 'bg-[#D4AF37] text-black font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              100% Neuf
            </button>
            <button
              onClick={() => setConditionFilter('occasion')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                conditionFilter === 'occasion'
                  ? 'bg-zinc-800 text-white font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Occasion
            </button>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1 text-gray-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-gray-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="recent" className="bg-[#141418]">Plus récent</option>
              <option value="price_asc" className="bg-[#141418]">Prix croissant</option>
              <option value="price_desc" className="bg-[#141418]">Prix décroissant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Listings Grid */}
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 pt-5">
        {/* PWA Install Banner */}
        <PWAInstallButton variant="banner" className="mb-4" />

        {filteredListings.length === 0 ? (
          /* Clean Empty State */
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#141418] border border-zinc-800 flex items-center justify-center mx-auto text-[#D4AF37]">
              <Package className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-white">
                Aucune annonce pour le moment
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
                {activeSearch || selectedCategory !== 'ALL'
                  ? 'Aucun résultat ne correspond à vos filtres. Essayez de réinitialiser votre recherche.'
                  : `Soyez le premier à publier une annonce en ${countryConfig.name} ! C'est rapide, gratuit et sans commission.`}
              </p>
            </div>

            <button
              onClick={onQuickSell}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-[#D4AF37] via-[#F59E0B] to-[#C5A059] text-black text-xs font-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Déposer la première annonce</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredListings.slice(0, visibleCount).map((listing) => {
              const { formatted, indicativeSecondary } = convertAndFormatPrice(
                listing.price,
                listing.currency,
                viewerCurrency
              );

              return (
                <div
                  key={listing.id}
                  onClick={() => onSelectListing(listing)}
                  className="rounded-2xl bg-[#131317] border border-zinc-800/80 hover:border-[#D4AF37]/50 overflow-hidden flex flex-col hover:shadow-xl hover:shadow-amber-500/5 transition-all cursor-pointer group"
                >
                  {/* Media Thumbnail Container */}
                  <div className="relative aspect-4/3 w-full bg-zinc-900 overflow-hidden">
                    <img
                      src={listing.images[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'}
                      alt={listing.title}
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-300"
                    />

                    {/* Condition Badge */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[#D4AF37] border border-[#D4AF37]/40 text-[9px] font-bold shadow-md">
                        {listing.condition === 'neuf' ? '100% Neuf' : 'Occasion'}
                      </span>
                    </div>

                    {/* Country Flag Badge */}
                    <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md text-xs font-bold border border-zinc-700">
                      {AFRICAN_COUNTRIES[listing.country]?.flag || countryConfig.flag}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                    <div>
                      {/* Price */}
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-base font-black text-[#D4AF37] tracking-tight tabular-nums">
                          {formatted}
                        </span>
                      </div>

                      {indicativeSecondary && (
                        <div className="text-[10px] text-gray-400 font-medium -mt-1 mb-1 tabular-nums">
                          {indicativeSecondary}
                        </div>
                      )}

                      <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#D4AF37] transition-colors">
                        {listing.title}
                      </h4>
                    </div>

                    {/* Card Footer: Location & Verified Seller badge if verified */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-gray-400">
                      <div className="flex items-center gap-1 truncate pr-2">
                        <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                        <span className="truncate">{listing.city}</span>
                      </div>

                      {listing.seller.verified && (
                        <div className="flex items-center gap-1 text-[#D4AF37] shrink-0 font-bold" title="Vendeur avec téléphone vérifié">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span className="text-[10px]">Vérifié</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Call or Quick Share Button */}
                    {Boolean(listing.contact_phone || listing.seller?.phone) ? (
                      <div className="flex gap-1.5 pt-1">
                        <a
                          href={`tel:${String(listing.contact_phone || listing.seller?.phone || '').replace(/[\s\-\(\)]/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[#D4AF37] hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-[#D4AF37]/30"
                          title={`Appeler le ${listing.contact_phone || listing.seller?.phone}`}
                        >
                          <Phone className="w-3 h-3 text-[#D4AF37]" />
                          <span className="truncate">{listing.contact_phone || listing.seller?.phone}</span>
                        </a>

                        <button
                          onClick={(e) => handleShareWhatsApp(e, listing)}
                          className="py-1.5 px-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 text-[11px] font-semibold flex items-center justify-center transition-all cursor-pointer"
                          title="Partager sur WhatsApp"
                        >
                          <Share2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleShareWhatsApp(e, listing)}
                        className="w-full py-1.5 px-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-gray-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Share2 className="w-3 h-3 text-[#D4AF37]" />
                        <span>Partager l'annonce</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button (Progressive Pagination) */}
          {filteredListings.length > visibleCount && (
            <div className="pt-6 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="px-6 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-200 hover:text-white text-xs font-bold border border-zinc-700 transition-colors cursor-pointer min-h-[44px]"
              >
                Afficher plus d'annonces ({filteredListings.length - visibleCount} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
};
