import React, { useState, useEffect } from 'react';
import { Listing, CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { fetchListings, getFavoriteListingIds, updateListing, deleteListing } from '../lib/supabaseData';
import { 
  ShieldCheck, MapPin, Settings, Plus, Edit, 
  Trash2, CheckCircle2, PauseCircle, PlayCircle, Heart,
  Package, Store, Phone, Mail
} from 'lucide-react';

interface ProfileViewProps {
  currentUser: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    city?: string;
    country?: CountryCode;
    bio?: string;
    phone_verified?: boolean;
  } | null;
  currentCountry: CountryCode;
  onOpenSettings: () => void;
  onOpenPublish: () => void;
  onEditListing: (listing: Listing) => void;
  onRequireAuth: () => void;
  onSelectListing: (listing: Listing) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  currentCountry,
  onOpenSettings,
  onOpenPublish,
  onEditListing,
  onRequireAuth,
  onSelectListing,
}) => {
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [favoriteListings, setFavoriteListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<'listings' | 'favorites'>('listings');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'sold' | 'paused'>('all');
  const [loading, setLoading] = useState(true);

  const loadProfileData = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Fetch user's listings
    const myAds = await fetchListings({ userId: currentUser.id });
    setUserListings(myAds as any);

    // Fetch favorites
    const favIds = await getFavoriteListingIds(currentUser.id);
    if (favIds.length > 0) {
      const allActive = await fetchListings({});
      setFavoriteListings(allActive.filter((l) => favIds.includes(l.id)) as any);
    } else {
      setFavoriteListings([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProfileData();
  }, [currentUser]);

  const handleStatusChange = async (listingId: string, newStatus: 'active' | 'sold' | 'paused') => {
    if (!currentUser) return;
    await updateListing(listingId, currentUser.id, { status: newStatus });
    setUserListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l))
    );
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!currentUser) return;
    if (confirm('Voulez-vous vraiment supprimer définitivement cette annonce ?')) {
      await deleteListing(listingId, currentUser.id);
      setUserListings((prev) => prev.filter((l) => l.id !== listingId));
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4 text-white">
        <div className="w-16 h-16 rounded-full bg-[#181820] border border-zinc-800 flex items-center justify-center mx-auto text-[#D4AF37]">
          <Store className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold">Connectez-vous à votre compte</h3>
        <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
          Accédez à vos annonces, modifiez vos coordonnées et gérez vos publications en toute simplicité.
        </p>
        <button
          onClick={onRequireAuth}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black hover:brightness-110 cursor-pointer shadow-md"
        >
          Se connecter / S'inscrire
        </button>
      </div>
    );
  }

  const countryConfig = AFRICAN_COUNTRIES[currentUser.country || currentCountry] || AFRICAN_COUNTRIES.CI;
  const initials = currentUser.fullName
    ? currentUser.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AB';

  // Real stats calculated strictly from DB
  const totalListings = userListings.length;
  const activeCount = userListings.filter((l) => l.status === 'active').length;
  const soldCount = userListings.filter((l) => l.status === 'sold').length;
  const favoritesCount = favoriteListings.length;

  const filteredListings = userListings.filter((l) => {
    if (filterStatus === 'all') return true;
    return l.status === filterStatus;
  });

  return (
    <div className="max-w-2xl mx-auto px-3.5 sm:px-6 py-4 pb-28 space-y-4 text-white">
      {/* User Identity Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37]/50 shadow-md bg-zinc-900"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black font-extrabold flex items-center justify-center text-lg shadow-md border-2 border-[#D4AF37]/40">
                {initials}
              </div>
            )}

            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-1.5">
                <span>{currentUser.fullName}</span>
                {currentUser.phone_verified && (
                  <span title="Numéro vérifié par code SMS" className="inline-flex">
                    <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {currentUser.city || countryConfig.name}, {countryConfig.name}
                </span>
              </p>
              {currentUser.phone && (
                <p className="text-[11px] text-zinc-400 mt-0.5">{currentUser.phone}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-gray-200 hover:text-white transition-colors cursor-pointer border border-zinc-700 text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
              title="Paramètres du compte"
            >
              <Settings className="w-4 h-4 text-[#D4AF37]" />
              <span className="hidden sm:inline">Paramètres</span>
            </button>
          </div>
        </div>

        {/* Quick action: Edit Personal details */}
        <div className="mt-3.5 pt-3 border-t border-zinc-800/80 flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="flex-1 py-2 px-3 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Modifier mes détails personnels</span>
          </button>
          <button
            onClick={onOpenPublish}
            className="py-2 px-3.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px] shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Déposer</span>
          </button>
        </div>

        {currentUser.bio && (
          <p className="mt-3 text-xs text-gray-300 bg-[#181820] p-2.5 rounded-xl border border-zinc-800/80">
            {currentUser.bio}
          </p>
        )}

        {/* Real Dynamic Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3.5 border-t border-zinc-800 text-center">
          <div className="p-2 rounded-xl bg-[#181820] border border-zinc-800">
            <span className="text-sm font-black text-white block tabular-nums">{totalListings}</span>
            <span className="text-[10px] text-gray-400">Total</span>
          </div>

          <div className="p-2 rounded-xl bg-[#181820] border border-zinc-800">
            <span className="text-sm font-black text-[#D4AF37] block tabular-nums">{activeCount}</span>
            <span className="text-[10px] text-gray-400">Actives</span>
          </div>

          <div className="p-2 rounded-xl bg-[#181820] border border-zinc-800">
            <span className="text-sm font-black text-emerald-400 block tabular-nums">{soldCount}</span>
            <span className="text-[10px] text-gray-400">Vendues</span>
          </div>

          <div className="p-2 rounded-xl bg-[#181820] border border-zinc-800">
            <span className="text-sm font-black text-rose-400 block tabular-nums">{favoritesCount}</span>
            <span className="text-[10px] text-gray-400">Favoris</span>
          </div>
        </div>
      </div>


      {/* Main Tabs: Mes Annonces vs Mes Favoris */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('listings')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'listings'
              ? 'border-[#D4AF37] text-[#D4AF37]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Mes Annonces ({userListings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'favorites'
              ? 'border-[#D4AF37] text-[#D4AF37]'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Mes Favoris ({favoriteListings.length})</span>
        </button>
      </div>

      {/* Mes Annonces Tab Content */}
      {activeTab === 'listings' && (
        <div className="space-y-3">
          {/* Subfilter pills */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {(['all', 'active', 'sold', 'paused'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    filterStatus === st
                      ? 'bg-[#D4AF37] text-black font-bold'
                      : 'bg-zinc-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {st === 'all'
                    ? 'Toutes'
                    : st === 'active'
                    ? 'Actives'
                    : st === 'sold'
                    ? 'Vendues'
                    : 'En pause'}
                </button>
              ))}
            </div>

            <button
              onClick={onOpenPublish}
              className="px-3 py-1.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-bold flex items-center gap-1 hover:brightness-110 cursor-pointer shadow-sm shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Déposer</span>
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400">Chargement de vos annonces...</div>
          ) : filteredListings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#131317] border border-zinc-800 text-center space-y-3">
              <Package className="w-10 h-10 text-zinc-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">Aucune annonce trouvée</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {filterStatus === 'all'
                  ? 'Vous n’avez pas encore déposé d’annonce. Vendez vos articles en 60 secondes !'
                  : 'Aucune annonce avec ce statut.'}
              </p>
              {filterStatus === 'all' && (
                <button
                  onClick={onOpenPublish}
                  className="px-5 py-2.5 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-bold hover:brightness-110 cursor-pointer"
                >
                  + Déposer ma première annonce
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredListings.map((listing) => (
                <div
                  key={listing.id}
                  className="p-3 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div
                    onClick={() => onSelectListing(listing)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 border border-zinc-700">
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#D4AF37] tabular-nums">
                          {listing.price.toLocaleString()} {listing.currency}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            listing.status === 'active'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                              : listing.status === 'sold'
                              ? 'bg-zinc-800 text-zinc-400'
                              : 'bg-amber-950/60 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {listing.status === 'active'
                            ? 'Active'
                            : listing.status === 'sold'
                            ? 'Vendu'
                            : 'En pause'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white truncate mt-0.5">
                        {listing.title}
                      </h4>
                      <p className="text-[10px] text-gray-400 truncate">
                        {listing.city} · {listing.condition === 'neuf' ? '100% Neuf' : 'Occasion'}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-800/80">
                    <button
                      onClick={() => onEditListing(listing)}
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Modifier"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="sm:hidden text-[10px]">Modifier</span>
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange(listing.id, listing.status === 'sold' ? 'active' : 'sold')
                      }
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title={listing.status === 'sold' ? 'Remettre en vente' : 'Marquer comme vendu'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="sm:hidden text-[10px]">
                        {listing.status === 'sold' ? 'Réactiver' : 'Vendu'}
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange(listing.id, listing.status === 'paused' ? 'active' : 'paused')
                      }
                      className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title={listing.status === 'paused' ? 'Reprendre l’annonce' : 'Mettre en pause'}
                    >
                      {listing.status === 'paused' ? (
                        <PlayCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="sm:hidden text-[10px]">
                        {listing.status === 'paused' ? 'Reprendre' : 'Pause'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="sm:hidden text-[10px]">Supprimer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mes Favoris Tab Content */}
      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {favoriteListings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#131317] border border-zinc-800 text-center space-y-2">
              <Heart className="w-10 h-10 text-zinc-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">Aucun favori enregistré</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Appuyez sur le cœur sur les annonces qui vous intéressent pour les retrouver ici à tout moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {favoriteListings.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => onSelectListing(fav)}
                  className="p-3 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md flex items-center gap-3 cursor-pointer hover:border-[#D4AF37]/40 transition-colors"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 border border-zinc-700">
                    <img src={fav.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-[#D4AF37] block tabular-nums">
                      {(fav.price || 0).toLocaleString()} {fav.currency || 'FCFA'}
                    </span>
                    <h4 className="text-xs font-bold text-white truncate mt-0.5">{fav.title}</h4>
                    <p className="text-[10px] text-gray-400 truncate">
                      {fav.city || ''} · {fav.seller?.name || 'Vendeur'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Client & Support Direct Afrique Business (Demande expresse) */}
      <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-linear-to-b from-[#181820] to-[#121216] border border-[#D4AF37]/40 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Service Client & Support Direct
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-extrabold border border-[#D4AF37]/35">
            Support Officiel
          </span>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          Un problème avec une publication, une question sur votre compte ou besoin d'assistance ? Contactez directement la direction du service client :
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
          <a
            href="https://wa.me/2250565242349?text=Bonjour%20Service%20Client%20Afrique%20Business%2C%20j%27ai%20besoin%20d%27assistance"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <Phone className="w-4 h-4 text-white" />
            <span>WhatsApp / Tél :</span>
            <span className="font-mono font-black">+225 0565242349</span>
          </a>

          <a
            href="mailto:marcarnaudkonan2@gmail.com?subject=Contact%20Service%20Client%20Afrique%20Business"
            className="p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-gray-200 hover:text-white font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Mail className="w-4 h-4 text-[#D4AF37]" />
            <span>Email :</span>
            <span className="font-mono text-zinc-300 truncate">marcarnaudkonan2@gmail.com</span>
          </a>
        </div>
      </div>
    </div>
  );
};
