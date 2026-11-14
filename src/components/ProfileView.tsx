import React, { useState, useEffect } from 'react';
import { Listing, CountryCode } from '../types';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { fetchListings, fetchListingsByIds, getFavoriteListingIds, updateListing, deleteListing, deleteOwnStoragePhoto } from '../lib/supabaseData';
import { 
  ShieldCheck, MapPin, Settings, Plus, Edit, 
  Trash2, CheckCircle2, PauseCircle, PlayCircle, Heart,
  Package, Store, Phone, Mail, AlertTriangle, RefreshCw
} from 'lucide-react';
import { appConfirm, appToast } from '../lib/feedback';
import { SafeImage, SafeAvatar } from './SafeImage';

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
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfileData = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);

    try {
      // Fetch user's listings
      const myAds = await fetchListings({ userId: currentUser.id });
      setUserListings(myAds as any);

      // Fetch favorites without arbitrary 200-listing truncation
      const favIds = await getFavoriteListingIds(currentUser.id);
      if (favIds.length > 0) {
        const favAds = await fetchListingsByIds(favIds);
        setFavoriteListings(favAds as any);
      } else {
        setFavoriteListings([]);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Impossible de charger vos annonces.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [currentUser]);

  const handleStatusChange = async (listingId: string, newStatus: 'active' | 'sold' | 'paused') => {
    if (!currentUser) return;
    try {
      await updateListing(listingId, currentUser.id, { status: newStatus });
      setUserListings((prev) =>
        prev.map((l) => (l.id === listingId ? { ...l, status: newStatus } : l))
      );
      appToast(
        newStatus === 'sold'
          ? 'Annonce marquée comme vendue.'
          : newStatus === 'paused'
          ? 'Annonce mise en pause.'
          : 'Annonce réactivée.',
        'success'
      );
    } catch (err: any) {
      appToast(`Mise à jour impossible : ${err?.message || 'Erreur réseau'}`, 'error');
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!currentUser) return;
    const confirmed = await appConfirm({
      title: 'Supprimer cette annonce',
      message: 'Voulez-vous vraiment supprimer définitivement cette annonce ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true,
    });
    if (!confirmed) return;
    const targetListing = userListings.find((l) => l.id === listingId);
    try {
      await deleteListing(listingId, currentUser.id);
      if (targetListing?.images && targetListing.images.length > 0) {
        Promise.all(
          targetListing.images.map((url) => deleteOwnStoragePhoto('listings', currentUser.id, url))
        ).catch(() => {});
      }
      setUserListings((prev) => prev.filter((l) => l.id !== listingId));
      appToast('Annonce supprimée définitivement.', 'success');
    } catch (err: any) {
      appToast(`Suppression impossible : ${err?.message || 'Erreur réseau'}`, 'error');
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-[#C69A35]">
          <Store className="w-8 h-8" />
        </div>
        <h3 className="text-base font-extrabold text-[#172033]">Connectez-vous à votre compte</h3>
        <p className="text-xs text-[#596273] max-w-sm mx-auto leading-relaxed">
          Accédez à vos annonces, modifiez vos coordonnées et gérez vos publications en toute simplicité.
        </p>
        <button
          onClick={onRequireAuth}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-md transition-transform active:scale-95"
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
    <div className="max-w-2xl mx-auto px-3.5 sm:px-6 py-4 pb-28 space-y-4 text-[#172033]">
      {/* User Identity Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5E8EF] shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SafeAvatar
              src={currentUser.avatarUrl}
              alt={currentUser.fullName}
              initials={initials}
              className="w-16 h-16 rounded-full object-cover border-2 border-[#C69A35] shadow-sm bg-[#F1F4F9]"
              fallbackClassName="w-16 h-16 rounded-full bg-linear-to-tr from-[#C69A35] to-[#E7C875] text-[#172033] font-black flex items-center justify-center text-lg shadow-sm border-2 border-white"
            />

            <div>
              <h2 className="text-base font-extrabold text-[#172033] flex items-center gap-1.5">
                <span>{currentUser.fullName}</span>
                {currentUser.phone_verified && (
                  <span title="Numéro vérifié par code SMS" className="inline-flex">
                    <ShieldCheck className="w-4 h-4 text-[#C69A35]" />
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#596273] mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#C69A35]" />
                <span>
                  {currentUser.city || countryConfig.name}, {countryConfig.name}
                </span>
              </p>
              {currentUser.phone && (
                <p className="text-[11px] font-medium text-[#596273] mt-0.5">{currentUser.phone}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="px-3 py-2 rounded-xl bg-[#F8F9FC] hover:bg-[#F1F4F9] text-[#172033] transition-colors cursor-pointer border border-[#E5E8EF] text-xs font-bold flex items-center gap-1.5 min-h-[44px]"
              title="Paramètres du compte"
            >
              <Settings className="w-4 h-4 text-[#C69A35]" />
              <span className="hidden sm:inline">Paramètres</span>
            </button>
          </div>
        </div>

        {/* Quick action: Edit Personal details & Publish */}
        <div className="mt-3.5 pt-3 border-t border-[#E5E8EF] flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="flex-1 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-[#C69A35]/30 text-[#A27B20] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Modifier mes détails personnels</span>
          </button>
          <button
            onClick={onOpenPublish}
            className="py-2 px-3.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] shadow-sm hover:brightness-105 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">Déposer</span>
          </button>
        </div>

        {currentUser.bio && (
          <p className="mt-3 text-xs text-[#172033] bg-[#F8F9FC] p-2.5 rounded-xl border border-[#E5E8EF]">
            {currentUser.bio}
          </p>
        )}

        {/* Real Dynamic Stats Grid */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3.5 border-t border-[#E5E8EF] text-center">
          <div className="p-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF]">
            <span className="text-sm font-black text-[#172033] block tabular-nums">{totalListings}</span>
            <span className="text-[10px] text-[#596273] font-medium">Total</span>
          </div>

          <div className="p-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF]">
            <span className="text-sm font-black text-[#C69A35] block tabular-nums">{activeCount}</span>
            <span className="text-[10px] text-[#596273] font-medium">Actives</span>
          </div>

          <div className="p-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF]">
            <span className="text-sm font-black text-emerald-700 block tabular-nums">{soldCount}</span>
            <span className="text-[10px] text-[#596273] font-medium">Vendues</span>
          </div>

          <div className="p-2 rounded-xl bg-[#F8F9FC] border border-[#E5E8EF]">
            <span className="text-sm font-black text-rose-600 block tabular-nums">{favoritesCount}</span>
            <span className="text-[10px] text-[#596273] font-medium">Favoris</span>
          </div>
        </div>
      </div>

      {/* Main Tabs: Mes Annonces vs Mes Favoris */}
      <div className="flex border-b border-[#E5E8EF] bg-white rounded-xl p-1 shadow-xs">
        <button
          onClick={() => setActiveTab('listings')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'listings'
              ? 'bg-[#F8F9FC] text-[#C69A35] shadow-xs border border-[#E5E8EF]'
              : 'text-[#596273] hover:text-[#172033]'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Mes Annonces ({userListings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all rounded-lg cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'favorites'
              ? 'bg-[#F8F9FC] text-[#C69A35] shadow-xs border border-[#E5E8EF]'
              : 'text-[#596273] hover:text-[#172033]'
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
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    filterStatus === st
                      ? 'bg-[#C69A35] text-white font-bold shadow-xs'
                      : 'bg-white border border-[#E5E8EF] text-[#596273] hover:text-[#172033]'
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
              className="px-3 py-1.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black flex items-center gap-1 hover:brightness-105 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Déposer</span>
            </button>
          </div>

          {loadError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-semibold">{loadError}</span>
              </div>
              <button
                type="button"
                onClick={loadProfileData}
                className="px-3 py-1 rounded-lg bg-white border border-red-200 text-red-700 font-bold hover:bg-red-100 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Réessayer</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-xs text-[#596273]">Chargement de vos annonces...</div>
          ) : filteredListings.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-[#E5E8EF] text-center space-y-3 shadow-xs">
              <Package className="w-10 h-10 text-gray-300 mx-auto" />
              <h4 className="text-sm font-bold text-[#172033]">Aucune annonce trouvée</h4>
              <p className="text-xs text-[#596273] max-w-xs mx-auto">
                {filterStatus === 'all'
                  ? 'Vous n’avez pas encore déposé d’annonce. Vendez vos articles en quelques secondes !'
                  : 'Aucune annonce avec ce statut.'}
              </p>
              {filterStatus === 'all' && (
                <button
                  onClick={onOpenPublish}
                  className="px-5 py-2.5 rounded-xl bg-linear-to-r from-[#C69A35] to-[#E7C875] text-[#172033] text-xs font-black hover:brightness-105 cursor-pointer shadow-sm"
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
                  className="p-3 rounded-2xl bg-white border border-[#E5E8EF] shadow-xs hover:shadow-md transition-shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div
                    onClick={() => onSelectListing(listing)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F1F4F9] shrink-0 border border-[#E5E8EF]">
                      <SafeImage
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#C69A35] tabular-nums">
                          {listing.price.toLocaleString()} {listing.currency}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            listing.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : listing.status === 'sold'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {listing.status === 'active'
                            ? 'Active'
                            : listing.status === 'sold'
                            ? 'Vendu'
                            : 'En pause'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#172033] truncate mt-0.5">
                        {listing.title}
                      </h4>
                      <p className="text-[10px] text-[#596273] truncate">
                        {listing.city} · {listing.condition === 'neuf' ? '100% Neuf' : 'Occasion'}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E5E8EF]">
                    <button
                      onClick={() => onEditListing(listing)}
                      className="p-2 rounded-lg bg-[#F8F9FC] hover:bg-[#F1F4F9] border border-[#E5E8EF] text-[#172033] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Modifier"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#C69A35]" />
                      <span className="sm:hidden text-[10px]">Modifier</span>
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange(listing.id, listing.status === 'sold' ? 'active' : 'sold')
                      }
                      className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title={listing.status === 'sold' ? 'Remettre en vente' : 'Marquer comme vendu'}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="sm:hidden text-[10px]">
                        {listing.status === 'sold' ? 'Réactiver' : 'Vendu'}
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        handleStatusChange(listing.id, listing.status === 'paused' ? 'active' : 'paused')
                      }
                      className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title={listing.status === 'paused' ? 'Reprendre l’annonce' : 'Mettre en pause'}
                    >
                      {listing.status === 'paused' ? (
                        <PlayCircle className="w-3.5 h-3.5 text-[#C69A35]" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span className="sm:hidden text-[10px]">
                        {listing.status === 'paused' ? 'Reprendre' : 'Pause'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
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
            <div className="p-8 rounded-2xl bg-white border border-[#E5E8EF] text-center space-y-2 shadow-xs">
              <Heart className="w-10 h-10 text-gray-300 mx-auto" />
              <h4 className="text-sm font-bold text-[#172033]">Aucun favori enregistré</h4>
              <p className="text-xs text-[#596273] max-w-xs mx-auto">
                Appuyez sur le cœur sur les annonces qui vous intéressent pour les retrouver ici à tout moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {favoriteListings.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => onSelectListing(fav)}
                  className="p-3 rounded-2xl bg-white border border-[#E5E8EF] shadow-xs flex items-center gap-3 cursor-pointer hover:border-[#C69A35] transition-colors"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#F1F4F9] shrink-0 border border-[#E5E8EF]">
                    <SafeImage src={fav.images?.[0]} alt={fav.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-black text-[#C69A35] block tabular-nums">
                      {(fav.price || 0).toLocaleString()} {fav.currency || 'FCFA'}
                    </span>
                    <h4 className="text-xs font-bold text-[#172033] truncate mt-0.5">{fav.title}</h4>
                    <p className="text-[10px] text-[#596273] truncate">
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
      <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-white border-2 border-[#C69A35]/30 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-[#172033] uppercase tracking-wider">
              Service Client & Support Direct
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[#A27B20] text-[10px] font-extrabold border border-[#C69A35]/30">
            Support Officiel
          </span>
        </div>

        <p className="text-xs text-[#596273] leading-relaxed">
          Un problème avec une publication, une question sur votre compte ou besoin d'assistance ? Contactez directement la direction du service client :
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
          <a
            href="https://wa.me/2250565242349?text=Bonjour%20Service%20Client%20Afrique%20Business%2C%20j%27ai%20besoin%20d%27assistance"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98"
          >
            <Phone className="w-4 h-4 text-white" />
            <span>WhatsApp / Tél :</span>
            <span className="font-mono font-black">+225 0565242349</span>
          </a>

          <a
            href="mailto:marcarnaudkonan2@gmail.com?subject=Contact%20Service%20Client%20Afrique%20Business"
            className="p-3 rounded-xl bg-[#F8F9FC] hover:bg-[#F1F4F9] border border-[#E5E8EF] text-[#172033] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <Mail className="w-4 h-4 text-[#C69A35]" />
            <span>Email :</span>
            <span className="font-mono text-[#596273] truncate">marcarnaudkonan2@gmail.com</span>
          </a>
        </div>
      </div>
    </div>
  );
};
