import React, { useState } from 'react';
import { Listing, CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { convertAndFormatPrice } from '../lib/currency';
import { CategoryKey } from '../lib/supabaseData';
import { CATEGORIES_LIST, CategoryGoldIcon } from '../data/categories';
import { 
  Search, ShieldCheck, Share2, MapPin, Plus, 
  Package, Grid, ArrowUpDown, Phone
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
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://afrique-afrique.com';
    const directAdUrl = `${origin}/#ad-${listing.id}`;
    const safePrice = Number(listing.price) || 0;
    const text = `🛍️ *${listing.title}*\n💰 Prix : *${safePrice.toLocaleString()} ${listing.currency || 'FCFA'}*\n📍 Lieu : ${listing.city || ''}\n👉 Voir l'annonce sur *Afrique Business* :\n${directAdUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pb-28 bg-[#F8F9FC] text-[#172033] min-h-screen">
      {/* Prestigious Marketplace Header matching Logo */}
      <div className="px-3.5 sm:px-6 pt-4 pb-4 bg-white border-b border-[#E5E8EF] shadow-xs space-y-4">
        {/* Brand Banner */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl overflow-hidden bg-black border border-[#C69A35]/40 shrink-0 shadow-sm">
              <img
                src={officialLogoImg}
                alt="Afrique Business"
                className="w-full h-full object-cover scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl sm:text-2xl font-black text-[#172033] tracking-tight leading-none">
                  Afrique <span className="text-[#C69A35]">Business</span>
                </h1>
              </div>
              <p className="text-xs text-[#596273] mt-1 leading-snug">
                {scopeAllAfrica ? (
                  <span>Toute l'Afrique (Marché continental)</span>
                ) : (
                  <span>
                    Marché actif : <span className="text-[#C69A35] font-bold">{countryConfig.name}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onOpenScopeModal}
            className="px-3 py-1.5 rounded-xl bg-[#F1F4F9] border border-[#E5E8EF] hover:border-[#C69A35]/50 text-xs text-[#172033] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
            title="Changer de pays"
          >
            <span className="text-base">{countryConfig.flag}</span>
            <span className="hidden sm:inline">{countryConfig.name}</span>
          </button>
        </div>

        {/* Primary Golden CTA Button */}
        <button
          onClick={onQuickSell}
          className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-[#C69A35] via-[#DBAC3E] to-[#E7C875] hover:brightness-105 active:scale-[0.99] transition-all text-[#172033] font-bold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer min-h-[46px]"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>+ Déposer une annonce en 60 secondes</span>
        </button>

        {/* Sleek Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#596273] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={`Rechercher un article ou un service en ${countryConfig.name}...`}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF] text-base sm:text-xs text-[#172033] placeholder-[#596273] font-medium focus:bg-white focus:border-[#C69A35] focus:outline-none transition-all"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#596273] hover:text-[#172033]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Categories Bar */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {/* All button */}
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer min-h-[44px] ${
              selectedCategory === 'ALL'
                ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] shadow-xs'
                : 'bg-[#F8F9FC] border border-[#E5E8EF] text-[#596273] hover:text-[#172033]'
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
                    ? 'bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] shadow-xs'
                    : 'bg-[#F8F9FC] border border-[#E5E8EF] text-[#596273] hover:text-[#172033]'
                }`}
              >
                <CategoryGoldIcon
                  categoryKey={cat.id}
                  className={`w-4 h-4 ${isSelected ? 'text-[#172033]' : 'text-[#C69A35]'}`}
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
                  ? 'bg-[#172033] text-white font-bold'
                  : 'text-[#596273] hover:text-[#172033]'
              }`}
            >
              Tous états
            </button>
            <button
              onClick={() => setConditionFilter('neuf')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                conditionFilter === 'neuf'
                  ? 'bg-[#C69A35] text-[#172033] font-bold'
                  : 'text-[#596273] hover:text-[#172033]'
              }`}
            >
              100% Neuf
            </button>
            <button
              onClick={() => setConditionFilter('occasion')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                conditionFilter === 'occasion'
                  ? 'bg-[#172033] text-white font-bold'
                  : 'text-[#596273] hover:text-[#172033]'
              }`}
            >
              Occasion
            </button>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1 text-[#596273]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#C69A35]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[#172033] font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="recent">Plus récent</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
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
            <div className="w-16 h-16 rounded-full bg-white border border-[#E5E8EF] flex items-center justify-center mx-auto text-[#C69A35] shadow-xs">
              <Package className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#172033]">
                Aucune annonce pour le moment
              </h3>
              <p className="text-xs text-[#596273] max-w-sm mx-auto leading-relaxed">
                {activeSearch || selectedCategory !== 'ALL'
                  ? 'Aucun résultat ne correspond à vos filtres. Essayez de réinitialiser votre recherche.'
                  : `Soyez le premier à publier une annonce en ${countryConfig.name} ! C'est rapide, gratuit et sans commission.`}
              </p>
            </div>

            <button
              onClick={onQuickSell}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-bold shadow-sm hover:brightness-105 active:scale-98 transition-all cursor-pointer min-h-[44px]"
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
                  className="rounded-2xl bg-white border border-[#E5E8EF] hover:border-[#C69A35]/50 overflow-hidden flex flex-col shadow-xs hover:shadow-md transition-all cursor-pointer group"
                >
                  {/* Media Thumbnail Container */}
                  <div className="relative aspect-4/3 w-full bg-[#F1F4F9] overflow-hidden">
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
                      <span className="px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-xs text-[#C69A35] border border-[#C69A35]/30 text-[9px] font-bold shadow-xs">
                        {listing.condition === 'neuf' ? '100% Neuf' : 'Occasion'}
                      </span>
                    </div>

                    {/* Country Flag Badge */}
                    <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-md text-xs font-bold border border-[#E5E8EF] shadow-xs">
                      {AFRICAN_COUNTRIES[listing.country]?.flag || countryConfig.flag}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                    <div>
                      {/* Price */}
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-base font-black text-[#C69A35] tracking-tight tabular-nums">
                          {formatted}
                        </span>
                      </div>

                      {indicativeSecondary && (
                        <div className="text-[10px] text-[#596273] font-medium -mt-1 mb-1 tabular-nums">
                          {indicativeSecondary}
                        </div>
                      )}

                      <h4 className="text-xs font-bold text-[#172033] line-clamp-2 leading-snug group-hover:text-[#C69A35] transition-colors">
                        {listing.title}
                      </h4>
                    </div>

                    {/* Card Footer: Location & Verified Seller badge */}
                    <div className="pt-2 border-t border-[#E5E8EF] flex items-center justify-between text-[11px] text-[#596273]">
                      <div className="flex items-center gap-1 truncate pr-2">
                        <MapPin className="w-3 h-3 text-[#596273] shrink-0" />
                        <span className="truncate">{listing.city}</span>
                      </div>

                      {listing.seller?.verified && (
                        <div className="flex items-center gap-1 text-[#C69A35] shrink-0 font-bold" title="Vendeur avec téléphone vérifié">
                          <ShieldCheck className="w-3.5 h-3.5 text-[#C69A35]" />
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
                          className="flex-1 py-1.5 px-2 rounded-lg bg-[#F8F9FC] hover:bg-[#F1F4F9] text-[#C69A35] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-[#C69A35]/30 shadow-xs"
                          title={`Appeler le ${listing.contact_phone || listing.seller?.phone}`}
                        >
                          <Phone className="w-3 h-3 text-[#C69A35]" />
                          <span className="truncate">{listing.contact_phone || listing.seller?.phone}</span>
                        </a>

                        <button
                          onClick={(e) => handleShareWhatsApp(e, listing)}
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-semibold flex items-center justify-center transition-all cursor-pointer shadow-xs"
                          title="Partager sur WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => handleShareWhatsApp(e, listing)}
                        className="w-full py-1.5 px-2 rounded-lg bg-[#F8F9FC] hover:bg-[#F1F4F9] text-[#172033] text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-[#E5E8EF] shadow-xs"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#C69A35]" />
                        <span>Partager l'annonce</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {filteredListings.length > visibleCount && (
            <div className="pt-6 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 20)}
                className="px-6 py-3 rounded-xl bg-white hover:bg-[#F8F9FC] text-[#172033] text-xs font-bold border border-[#E5E8EF] transition-colors cursor-pointer min-h-[44px] shadow-xs"
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
