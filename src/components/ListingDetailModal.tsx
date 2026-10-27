import React, { useState, useEffect } from 'react';
import { Listing, CountryCode } from '../types';
import { convertAndFormatPrice } from '../lib/currency';
import { rpcGetContactPhone, submitReport, toggleFavorite, getFavoriteListingIds } from '../lib/supabaseData';
import { AFRICAN_COUNTRIES } from '../data/countries';
import { getCategoryItem, CategoryGoldIcon } from '../data/categories';
import { 
  X, ShieldCheck, Phone, MessageSquare, Share2, 
  MapPin, Heart, Flag, Edit, CheckCircle, PauseCircle, 
  PlayCircle, Trash2, Maximize2, Tag, Calendar, ExternalLink
} from 'lucide-react';

interface ListingDetailModalProps {
  listing: Listing | null;
  isOpen: boolean;
  onClose: () => void;
  viewerCurrency: string;
  currentUserId?: string;
  onStartChat: (sellerId: string, listingId: string, listingTitle: string) => void;
  onEditListing?: (listing: Listing) => void;
  onStatusChange?: (listingId: string, newStatus: 'active' | 'sold' | 'paused') => void;
  onDeleteListing?: (listingId: string) => void;
  onRequireAuth?: () => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  isOpen,
  onClose,
  viewerCurrency,
  currentUserId,
  onStartChat,
  onEditListing,
  onStatusChange,
  onDeleteListing,
  onRequireAuth,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [isFullscreenPhoto, setIsFullscreenPhoto] = useState(false);
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Annonce frauduleuse ou fausse');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    if (!listing) return;
    setSelectedImageIdx(0);
    setSellerPhone(null);
    setReportSubmitted(false);

    // Fetch contact phone via RPC get_contact_phone (hides if user sets visibility nobody or blocked)
    const fetchPhone = async () => {
      setLoadingPhone(true);
      const phone = await rpcGetContactPhone(listing.seller.id);
      setSellerPhone(phone);
      setLoadingPhone(false);
    };

    fetchPhone();

    // Check favorite status
    if (currentUserId) {
      getFavoriteListingIds(currentUserId).then((ids) => {
        setIsFav(ids.includes(listing.id));
      });
    }
  }, [listing, currentUserId]);

  if (!isOpen || !listing) return null;

  const isOwner = currentUserId && listing.seller.id === currentUserId;
  const countryConfig = AFRICAN_COUNTRIES[listing.country as CountryCode] || AFRICAN_COUNTRIES.CI;
  const images = listing.images && listing.images.length > 0 ? listing.images : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'];

  const { formatted, indicativeSecondary } = convertAndFormatPrice(
    listing.price,
    listing.currency,
    viewerCurrency
  );

  const handleToggleFavorite = async () => {
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }
    const newStatus = await toggleFavorite(currentUserId, listing.id);
    setIsFav(newStatus);
  };

  const handleShare = () => {
    const text = `🛍️ ${listing.title}\n💰 Prix : ${listing.price.toLocaleString()} ${listing.currency}\n📍 Lieu : ${listing.city}, ${countryConfig.name}\nDécouvrez cette annonce sur Afrique Business : https://afrique-business.app/#/ad/${listing.id}`;
    if (navigator.share) {
      navigator.share({
        title: listing.title,
        text,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  const effectiveContactPhone = listing.contact_phone || listing.seller?.phone || sellerPhone;
  const effectiveWhatsAppPhone = listing.whatsapp_phone || listing.seller?.whatsapp || effectiveContactPhone;

  const handleCall = () => {
    if (!effectiveContactPhone) return;
    window.location.href = `tel:${effectiveContactPhone.replace(/[\s\-\(\)]/g, '')}`;
  };

  const handleWhatsApp = () => {
    if (!effectiveWhatsAppPhone) return;
    const cleanDigits = effectiveWhatsAppPhone.replace(/[^\d]/g, '');
    const msg = `Bonjour, je vous contacte depuis Afrique Business pour votre annonce « ${listing.title} » affichée à ${listing.price.toLocaleString()} ${listing.currency}. Est-elle toujours disponible ?`;
    window.open(`https://wa.me/${cleanDigits}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleStartConversation = () => {
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }
    onStartChat(listing.seller.id, listing.id, listing.title);
    onClose();
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }
    await submitReport({
      reporter_id: currentUserId,
      target_type: 'listing',
      target_id: listing.id,
      reason: reportReason,
      details: reportDetails,
    });
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
    }, 2000);
  };

  const sellerInitials = listing.seller.name
    ? listing.seller.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AB';

  // Parse Facebook Page attribution
  const fbAttribution = React.useMemo(() => {
    if (!listing?.description) return null;
    const desc = listing.description;
    const pageMatch = desc.match(/Publié par\s*:\s*([^\n\r]+)/i);
    const urlMatch = desc.match(/(?:Voir sur Facebook\s*:\s*|Lien Facebook\s*:\s*)(https?:\/\/[^\s\n\r]+)/i);
    const hasFbId = /\[FB_POST_ID:[^\]]+\]/.test(desc);

    if (pageMatch || urlMatch || hasFbId) {
      return {
        pageName: pageMatch ? pageMatch[1].trim() : 'Page Facebook',
        url: urlMatch ? urlMatch[1].trim() : null,
      };
    }
    return null;
  }, [listing?.description]);

  // Clean description removing raw metadata tags
  const cleanDescription = React.useMemo(() => {
    if (!listing?.description) return '';
    return listing.description
      .replace(/\[FB_POST_ID:[^\]]+\]/g, '')
      .replace(/---\s*📢\s*Publié par[^\n]+/gi, '')
      .replace(/🔗\s*Voir sur Facebook[^\n]+/gi, '')
      .trim();
  }, [listing?.description]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl max-h-[92vh] sm:rounded-2xl rounded-t-3xl bg-[#121216] border border-zinc-800 overflow-hidden flex flex-col shadow-2xl text-white">
          {/* Header Bar */}
          <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-[#121216] z-10">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span className="truncate">{listing.city}, {countryConfig.name}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleFavorite}
                className={`p-2 rounded-full border transition-colors cursor-pointer ${
                  isFav
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-zinc-800 border-zinc-700 text-gray-400 hover:text-white'
                }`}
                title="Ajouter aux favoris"
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={handleShare}
                className="p-2 rounded-full bg-zinc-800 border border-zinc-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Partager"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-full bg-zinc-800 border border-zinc-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Copy Toast */}
          {copySuccess && (
            <div className="bg-[#D4AF37] text-black text-xs font-bold py-1.5 text-center">
              Lien copié dans le presse-papier !
            </div>
          )}

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Photo Gallery */}
            <div className="relative bg-black w-full aspect-4/3 sm:aspect-16/9 flex items-center justify-center overflow-hidden group">
              <img
                src={images[selectedImageIdx]}
                alt={listing.title}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
                }}
                className="w-full h-full object-contain cursor-zoom-in"
                onClick={() => setIsFullscreenPhoto(true)}
              />

              {/* Status Badge */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {listing.status === 'sold' && (
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-800/90 text-zinc-300 text-xs font-bold border border-zinc-600 shadow-md">
                    Vendu
                  </span>
                )}
                {listing.status === 'paused' && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-900/80 text-amber-200 text-xs font-bold border border-amber-600 shadow-md">
                    En pause
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-[#1A1A22] text-[#D4AF37] text-[11px] font-bold border border-[#D4AF37]/30 shadow-md">
                  {listing.condition === 'neuf' ? 'Neuf' : 'Occasion'}
                </span>
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullscreenPhoto(true)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/90 transition-colors cursor-pointer"
                title="Plein écran"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto py-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIdx(idx)}
                      className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-transform shrink-0 ${
                        selectedImageIdx === idx ? 'border-[#D4AF37] scale-105' : 'border-white/40 opacity-70'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Price & Title */}
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl sm:text-3xl font-black text-[#D4AF37] tabular-nums">
                    {formatted}
                  </span>
                  {indicativeSecondary && (
                    <span className="text-xs font-semibold text-gray-400 tabular-nums">
                      ({indicativeSecondary})
                    </span>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">
                  {listing.title}
                </h2>

                {/* Category & Subcategory Pills */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700 text-xs font-semibold text-gray-200">
                    <CategoryGoldIcon categoryKey={listing.category as any} className="w-3.5 h-3.5" />
                    <span>{getCategoryItem(listing.category as any)?.label || listing.category}</span>
                  </div>
                  {listing.subcategory && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-xs font-semibold text-[#D4AF37]">
                      {listing.subcategory}
                    </span>
                  )}
                </div>
                
                {/* Edited at notice */}
                {listing.edited_at && (
                  <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[#D4AF37]" />
                    <span>Modifiée le {new Date(listing.edited_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="p-3.5 rounded-xl bg-[#181820] border border-zinc-800">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Description de l'annonce
                </h3>
                <p className="text-xs sm:text-sm text-gray-200 leading-relaxed whitespace-pre-line">
                  {cleanDescription || listing.description}
                </p>
              </div>

              {/* Facebook Page Attribution Card (Requirement) */}
              {fbAttribution && (
                <div className="p-3.5 rounded-2xl bg-linear-to-r from-[#1877F2]/15 via-[#1877F2]/10 to-transparent border border-[#1877F2]/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-md">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#1877F2] font-black uppercase tracking-wider block">
                        Publication Importée
                      </span>
                      <span className="text-xs font-bold text-white">
                        Publié par {fbAttribution.pageName}
                      </span>
                    </div>
                  </div>

                  {fbAttribution.url && (
                    <a
                      href={fbAttribution.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                    >
                      <span>Voir sur Facebook</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Seller Profile Card */}
              <div className="p-3.5 rounded-xl bg-[#181820] border border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(listing.seller.avatarUrl || listing.seller.avatar_url) ? (
                    <img
                      src={listing.seller.avatarUrl || listing.seller.avatar_url}
                      alt={listing.seller.name}
                      className="w-12 h-12 rounded-full object-cover border border-[#D4AF37]/40 bg-zinc-900"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-linear-to-tr from-[#D4AF37] to-[#F59E0B] text-black font-extrabold flex items-center justify-center text-sm shadow-md">
                      {sellerInitials}
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>{listing.seller.name}</span>
                      {(listing.seller.phone_verified || listing.seller.verified) && (
                        <span title="Numéro vérifié par SMS" className="inline-flex items-center">
                          <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-400">
                      {listing.city}, {countryConfig.name}
                    </p>
                  </div>
                </div>

                {!isOwner && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="p-1.5 text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
                    title="Signaler cette annonce"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Signaler</span>
                  </button>
                )}
              </div>

              {/* Contact phone section (Requirement A) */}
              {(effectiveContactPhone || effectiveWhatsAppPhone) && (
                <div className="p-3.5 rounded-xl bg-[#1C1C24] border border-[#D4AF37]/30 space-y-2">
                  <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block">
                    Coordonnées directes du vendeur
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {effectiveContactPhone && (
                      <div className="flex items-center gap-2 text-white bg-black/40 px-3 py-2 rounded-lg border border-zinc-800">
                        <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 block">Appels directs</span>
                          <span className="font-mono font-bold">{effectiveContactPhone}</span>
                        </div>
                      </div>
                    )}
                    {effectiveWhatsAppPhone && (
                      <div className="flex items-center gap-2 text-white bg-black/40 px-3 py-2 rounded-lg border border-zinc-800">
                        <span className="text-emerald-400 font-bold shrink-0 text-sm">WhatsApp</span>
                        <div>
                          <span className="text-[10px] text-gray-400 block">Messagerie WhatsApp</span>
                          <span className="font-mono font-bold">{effectiveWhatsAppPhone}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Owner Controls */}
              {isOwner && (
                <div className="p-3 rounded-xl bg-[#1A1A24] border border-[#D4AF37]/30 space-y-2">
                  <span className="text-[11px] font-bold text-[#D4AF37] uppercase tracking-wider block">
                    Gestion de votre annonce
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        onEditListing?.(listing);
                        onClose();
                      }}
                      className="py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Modifier</span>
                    </button>

                    <button
                      onClick={() => onStatusChange?.(listing.id, (listing.status === 'sold' || (listing.status as string) === 'SOLD') ? 'active' : 'sold')}
                      className="py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{(listing.status === 'sold' || (listing.status as string) === 'SOLD') ? 'Remettre en vente' : 'Marquer Vendu'}</span>
                    </button>

                    <button
                      onClick={() => onStatusChange?.(listing.id, listing.status === 'paused' ? 'active' : 'paused')}
                      className="py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {listing.status === 'paused' ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Réactiver</span>
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Mettre en pause</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm('Voulez-vous vraiment supprimer définitivement cette annonce ?')) {
                          onDeleteListing?.(listing.id);
                          onClose();
                        }
                      }}
                      className="py-2 px-2.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-xs font-bold text-red-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Bar */}
          {!isOwner && (
            <div className="p-3.5 bg-[#141418] border-t border-zinc-800 flex items-center gap-2 z-10">
              {/* Phone button: shown only if contact phone exists */}
              {effectiveContactPhone && (
                <button
                  onClick={handleCall}
                  className="flex-1 py-3 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700 active:scale-98 transition-all cursor-pointer min-h-[44px]"
                  title={`Appeler le ${effectiveContactPhone}`}
                >
                  <Phone className="w-4 h-4 text-[#D4AF37]" />
                  <span>Appeler</span>
                </button>
              )}

              {/* WhatsApp button: shown only if whatsapp phone exists */}
              {effectiveWhatsAppPhone && (
                <button
                  onClick={handleWhatsApp}
                  className="flex-1 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer min-h-[44px]"
                  title={`Écrire sur WhatsApp au ${effectiveWhatsAppPhone}`}
                >
                  <span>WhatsApp</span>
                </button>
              )}

              {/* Message button or disabled notice if chats_enabled is false */}
              {listing.seller?.chats_enabled === false ? (
                <div
                  className="flex-2 py-2.5 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-gray-400 text-[11px] font-semibold flex items-center justify-center text-center leading-tight min-h-[44px]"
                  title="Le vendeur ne souhaite pas recevoir de messages privés"
                >
                  Ce vendeur a désactivé les messages
                </div>
              ) : (
                <button
                  onClick={handleStartConversation}
                  className="flex-2 py-3 px-3 rounded-xl bg-linear-to-r from-[#D4AF37] to-[#F59E0B] text-black text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer min-h-[44px]"
                >
                  <MessageSquare className="w-4 h-4 text-black stroke-[2.5]" />
                  <span>Message</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Photo Modal */}
      {isFullscreenPhoto && (
        <div
          onClick={() => setIsFullscreenPhoto(false)}
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <button
            onClick={() => setIsFullscreenPhoto(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={images[selectedImageIdx]}
            alt={listing.title}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
            }}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Signalement Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#141418] border border-zinc-800 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold flex items-center gap-2 text-red-400">
                <Flag className="w-4 h-4" />
                <span>Signaler cette annonce</span>
              </h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-2">
                <ShieldCheck className="w-10 h-10 text-[#D4AF37] mx-auto" />
                <p className="text-xs font-bold text-white">Signalement envoyé</p>
                <p className="text-[11px] text-gray-400">Merci de nous aider à garder Afrique Business sûr.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="py-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Motif</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1A22] border border-zinc-700 text-xs text-white"
                  >
                    <option value="Annonce frauduleuse ou fausse">Annonce frauduleuse ou fausse</option>
                    <option value="Produit interdit ou illicite">Produit interdit ou illicite</option>
                    <option value="Prix trompeur ou abusif">Prix trompeur ou abusif</option>
                    <option value="Photos volées ou non conformes">Photos volées ou non conformes</option>
                    <option value="Autre motif">Autre motif</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Détails (Optionnel)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Précisez votre remarque pour notre équipe..."
                    className="w-full px-3 py-2 rounded-xl bg-[#1A1A22] border border-zinc-700 text-xs text-white placeholder-gray-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Confirmer le signalement
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
