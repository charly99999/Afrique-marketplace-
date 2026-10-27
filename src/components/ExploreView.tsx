import React, { useState } from 'react';
import { Listing, CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { convertAndFormatPrice } from '../lib/currency';
import { CategoryKey } from '../lib/supabaseData';
import { CATEGORIES_LIST, CategoryGoldIcon } from '../data/categories';
import { 
  Search, MapPin, Grid, ShieldCheck, Tag, ArrowUpDown, Package
} from 'lucide-react';

interface ExploreViewProps {
  listings: Listing[];
  currentCountry: CountryCode;
  viewerCurrency: string;
  onSelectListing: (listing: Listing) => void;
  onQuickSell: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  listings,
  currentCountry,
  viewerCurrency,
  onSelectListing,
  onQuickSell,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<CategoryKey | 'ALL'>('ALL');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | 'neuf' | 'occasion'>('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc'>('recent');

  const countryConfig = AFRICAN_COUNTRIES[currentCountry] || AFRICAN_COUNTRIES.CI;

  const filtered = listings.filter((l) => {
    if (selectedCat !== 'ALL' && l.category !== selectedCat) return false;
    if (verifiedOnly && !l.seller.verified) return false;
    if (conditionFilter !== 'ALL' && l.condition !== conditionFilter) return false;
    if (maxPrice && l.price > Number(maxPrice)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (l.title || '').toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (l.description || '').toLowerCase().includes(q) ||
        (l.subcategory || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (sortBy === 'price_asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-4 pb-28 text-white">
      {/* Search & Header */}
      <div className="mb-4 space-y-3">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight">
            Explorer les Annonces
          </h2>
          <p className="text-xs text-gray-400">
            Filtrez et découvrez les meilleures opportunités en {countryConfig.name} et partout en Afrique
          </p>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par mot-clé, produit, ville..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#141418] border border-zinc-800 text-base sm:text-xs text-white placeholder-zinc-500 font-medium focus:border-[#D4AF37] focus:outline-none transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCat('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 ${
              selectedCat === 'ALL'
                ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold shadow-sm'
                : 'bg-[#17171C] border border-zinc-800 text-gray-300 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Toutes catégories</span>
          </button>
          {CATEGORIES_LIST.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5 ${
                selectedCat === c.id
                  ? 'bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black font-extrabold shadow-sm'
                  : 'bg-[#17171C] border border-zinc-800 text-gray-300 hover:text-white'
              }`}
            >
              <CategoryGoldIcon
                categoryKey={c.id}
                className={`w-3.5 h-3.5 ${selectedCat === c.id ? 'text-black' : 'text-[#D4AF37]'}`}
              />
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-Filters: Verified, Condition, Max Price */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`px-3 py-1 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                verifiedOnly
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37] font-bold'
                  : 'bg-[#141418] border-zinc-800 text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Vendeurs vérifiés</span>
            </button>

            <button
              onClick={() => setConditionFilter(conditionFilter === 'neuf' ? 'ALL' : 'neuf')}
              className={`px-3 py-1 rounded-lg border font-semibold cursor-pointer transition-colors ${
                conditionFilter === 'neuf'
                  ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37] font-bold'
                  : 'bg-[#141418] border-zinc-800 text-gray-400 hover:text-white'
              }`}
            >
              Neuf uniquement
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder={`Prix max (${countryConfig.currency})`}
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32 px-2.5 py-1 rounded-lg bg-[#141418] border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#141418] border border-zinc-800 px-2 py-1 rounded-lg text-xs text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="recent">Plus récent</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="mb-3 text-xs font-semibold text-gray-400">
        <span>{filtered.length} annonce(s) trouvée(s)</span>
      </div>

      {/* Listings Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#131317] border border-zinc-800 text-center space-y-3">
          <Package className="w-10 h-10 text-zinc-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">Aucun article ne correspond à votre recherche</h4>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Modifiez vos filtres ou déposez votre annonce pour proposer ce que vous recherchez.
          </p>
          <button
            onClick={onQuickSell}
            className="px-5 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md"
          >
            + Déposer une annonce
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((listing) => {
            const { formatted } = convertAndFormatPrice(
              listing.price,
              listing.currency,
              viewerCurrency
            );

            return (
              <div
                key={listing.id}
                onClick={() => onSelectListing(listing)}
                className="rounded-2xl bg-[#131317] border border-zinc-800/80 hover:border-[#D4AF37]/50 overflow-hidden flex flex-col hover:shadow-xl transition-all cursor-pointer group"
              >
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
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs text-[#D4AF37] border border-[#D4AF37]/40 text-[9px] font-bold">
                      {listing.condition === 'neuf' ? 'Neuf' : 'Occasion'}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md text-xs font-bold border border-zinc-700">
                    {AFRICAN_COUNTRIES[listing.country]?.flag || countryConfig.flag}
                  </div>
                </div>

                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <span className="text-base font-black text-[#D4AF37] tabular-nums block mb-1">
                      {formatted}
                    </span>
                    <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#D4AF37] transition-colors">
                      {listing.title}
                    </h4>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-gray-400">
                    <span className="truncate">{listing.city}</span>
                    {listing.seller.verified && (
                      <span className="flex items-center gap-1 text-[#D4AF37] font-bold text-[10px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Vérifié</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
