import React, { useState, useEffect, useMemo } from 'react';
import { CountryCode, Listing } from '../types';
import { AFRICAN_COUNTRIES, CITIES_BY_COUNTRY } from '../data/countries';
import { uploadWebpImage, ListingCondition, isValidUuid, getAccountPhone } from '../lib/supabaseData';
import { CategoryKey, getCategoryItem, CategoryGoldIcon } from '../data/categories';
import { CategorySelectModal } from './CategorySelectModal';
import { 
  Camera, Check, AlertCircle, 
  Trash2, ArrowLeft, Image as ImageIcon,
  Phone, MessageSquare, MapPin, Tag, ChevronRight, User, Search
} from 'lucide-react';

export interface PublishViewProps {
  currentCountry: CountryCode;
  currentUser: { id: string; fullName: string; phone?: string; avatarUrl?: string; phone_verified?: boolean } | null;
  editingListing?: Listing | null;
  onPublishSuccess: (listing: Listing, isEdit: boolean) => void;
  onCancel: () => void;
  onRequireAuth: () => void;
}

export const PublishView: React.FC<PublishViewProps> = ({
  currentCountry,
  currentUser,
  editingListing,
  onPublishSuccess,
  onCancel,
  onRequireAuth,
}) => {
  const isEditing = Boolean(editingListing);

  // Form Fields
  const [title, setTitle] = useState(editingListing?.title || '');
  const [description, setDescription] = useState(editingListing?.description || '');
  const [price, setPrice] = useState<number | ''>(editingListing ? editingListing.price : '');
  const [currency, setCurrency] = useState(
    editingListing?.currency || AFRICAN_COUNTRIES[currentCountry]?.currency || 'XOF'
  );
  const [category, setCategory] = useState<CategoryKey>(
    (editingListing?.category as CategoryKey) || 'vehicules'
  );
  const [subcategory, setSubcategory] = useState<string>(
    editingListing?.subcategory || ''
  );
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [country, setCountry] = useState<CountryCode>(
    (editingListing?.country as CountryCode) || currentCountry
  );

  // Location: City (searchable) + Quartier
  const initialCityRaw = editingListing?.city || (currentCountry === 'CI' ? 'Abidjan' : AFRICAN_COUNTRIES[currentCountry]?.name || 'Dakar');
  // Check if raw city contains quartier format e.g. "Abidjan (Cocody)" or "Abidjan - Cocody"
  const parsedCity = initialCityRaw.split(/[\-\(]/)[0].trim();
  const parsedQuartier = initialCityRaw.includes('-') 
    ? initialCityRaw.split('-')[1]?.trim() 
    : initialCityRaw.includes('(') 
    ? initialCityRaw.split('(')[1]?.replace(')', '').trim() 
    : '';

  const [city, setCity] = useState(parsedCity);
  const [quartier, setQuartier] = useState(parsedQuartier);
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [condition, setCondition] = useState<ListingCondition>(
    editingListing?.condition === 'occasion' ? 'occasion' : 'neuf'
  );

  // Seller info
  const [sellerName, setSellerName] = useState(
    editingListing?.seller?.name || currentUser?.fullName || ''
  );

  // Contact phones
  const [contactPhone, setContactPhone] = useState(
    editingListing?.contact_phone || editingListing?.seller?.phone || currentUser?.phone || ''
  );
  const [whatsappPhone, setWhatsappPhone] = useState(
    editingListing?.whatsapp_phone || editingListing?.seller?.whatsapp || currentUser?.phone || ''
  );
  const [sameAsPhone, setSameAsPhone] = useState(
    Boolean(!editingListing?.whatsapp_phone || editingListing?.whatsapp_phone === editingListing?.contact_phone)
  );

  // Photos (up to 8)
  const [photos, setPhotos] = useState<string[]>(editingListing?.images || []);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionMsg, setCompressionMsg] = useState<string | null>(null);

  // Form validation & status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered cities list for active country
  const availableCities = useMemo(() => {
    return CITIES_BY_COUNTRY[country] || ['Abidjan', 'Bouaké', 'Dakar', 'Lagos', 'Douala', 'Kinshasa'];
  }, [country]);

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return availableCities;
    return availableCities.filter((c) =>
      c.toLowerCase().includes(citySearch.toLowerCase())
    );
  }, [availableCities, citySearch]);

  useEffect(() => {
    if (editingListing) {
      setTitle(editingListing.title);
      setDescription(editingListing.description);
      setPrice(editingListing.price);
      setCurrency(editingListing.currency);
      setCategory((editingListing.category as CategoryKey) || 'vehicules');
      setSubcategory(editingListing.subcategory || '');
      setCountry((editingListing.country as CountryCode) || currentCountry);
      setCondition(editingListing.condition === 'occasion' ? 'occasion' : 'neuf');
      setPhotos(editingListing.images || []);
      setSellerName(editingListing.seller?.name || currentUser?.fullName || '');
      const cPh = editingListing.contact_phone || editingListing.seller?.phone || '';
      const wPh = editingListing.whatsapp_phone || editingListing.seller?.whatsapp || '';
      setContactPhone(cPh);
      setWhatsappPhone(wPh || cPh);
      setSameAsPhone(Boolean(!wPh || wPh === cPh));
    } else {
      if (currentUser?.fullName && !sellerName) {
        setSellerName(currentUser.fullName);
      }
      if (currentUser?.phone) {
        setContactPhone((prev) => prev || currentUser.phone || '');
        setWhatsappPhone((prev) => prev || currentUser.phone || '');
      } else if (currentUser?.id) {
        getAccountPhone(currentUser.id).then((p) => {
          if (p) {
            setContactPhone((prev) => prev || p);
            setWhatsappPhone((prev) => prev || p);
          }
        });
      }
    }
  }, [editingListing, currentCountry, currentUser]);

  const handleContactPhoneChange = (val: string) => {
    setContactPhone(val);
    if (sameAsPhone) {
      setWhatsappPhone(val);
    }
  };

  const handleSameAsPhoneToggle = (checked: boolean) => {
    setSameAsPhone(checked);
    if (checked) {
      setWhatsappPhone(contactPhone);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMessage(null);

    if (!currentUser || !isValidUuid(currentUser.id)) {
      onRequireAuth();
      return;
    }

    const availableSlots = 8 - photos.length;
    if (availableSlots <= 0) {
      setErrorMessage('Vous avez atteint le maximum de 8 photos par annonce.');
      return;
    }

    const files = Array.from(e.target.files).slice(0, availableSlots);
    setIsCompressing(true);
    setCompressionMsg('Compression WebP en cours (haute résolution, optimisée pour connexions mobiles)...');

    const uploadedUrls: string[] = [];
    const userId = currentUser.id;

    for (const file of files) {
      try {
        const url = await uploadWebpImage('listings', userId, file);
        uploadedUrls.push(url);
      } catch (err: any) {
        console.error('Error uploading photo:', err);
        setErrorMessage(err.message || 'Échec du téléversement de la photo.');
      }
    }

    if (uploadedUrls.length > 0) {
      setPhotos((prev) => [...prev, ...uploadedUrls]);
      setCompressionMsg(`✓ ${uploadedUrls.length} photo(s) ajoutée(s) et compressée(s) en WebP.`);
      setTimeout(() => setCompressionMsg(null), 3500);
    }
    setIsCompressing(false);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMovePhoto = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= photos.length) return;
    const reordered = [...photos];
    const item = reordered.splice(index, 1)[0];
    reordered.splice(targetIdx, 0, item);
    setPhotos(reordered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser || !isValidUuid(currentUser.id)) {
      onRequireAuth();
      return;
    }

    if (!title.trim() || title.trim().length < 4) {
      setErrorMessage('Veuillez saisir un titre clair d’au moins 4 caractères.');
      return;
    }

    if (!price || Number(price) <= 0) {
      setErrorMessage('Veuillez indiquer un prix valide supérieur à 0.');
      return;
    }

    if (!city.trim()) {
      setErrorMessage('Veuillez sélectionner ou indiquer la ville de l’annonce.');
      return;
    }

    if (photos.length === 0) {
      setErrorMessage('Veuillez ajouter au moins une photo réelle du produit ou du service.');
      return;
    }

    // Phone format validation (digits with optional leading +)
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    const cleanContact = contactPhone.trim();
    const cleanWhatsapp = whatsappPhone.trim();

    if (cleanContact && !phoneRegex.test(cleanContact)) {
      setErrorMessage('Le numéro de téléphone d’appel est invalide. Exemple : +2250707070707 (chiffres avec indicatif pays).');
      return;
    }

    if (cleanWhatsapp && !phoneRegex.test(cleanWhatsapp)) {
      setErrorMessage('Le numéro WhatsApp est invalide. Exemple : +2250707070707 (chiffres avec indicatif pays).');
      return;
    }

    setIsSubmitting(true);

    try {
      // Assemble location: "Ville - Quartier" or just "Ville"
      const fullLocation = quartier.trim()
        ? `${city.trim()} - ${quartier.trim()}`
        : city.trim();

      const listingData: Listing = {
        id: editingListing?.id || `lst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: title.trim(),
        description: description.trim() || title.trim(),
        price: Number(price),
        currency,
        category,
        subcategory: subcategory.trim() || undefined,
        country,
        city: fullLocation,
        images: photos,
        condition,
        isNegotiable: true,
        contact_phone: cleanContact || undefined,
        whatsapp_phone: cleanWhatsapp || undefined,
        status: editingListing?.status || 'active',
        createdAt: editingListing?.createdAt || new Date().toISOString(),
        viewsCount: editingListing?.viewsCount || 0,
        seller: {
          id: currentUser.id,
          name: sellerName.trim() || currentUser.fullName,
          phone: cleanContact || currentUser.phone || '',
          whatsapp: cleanWhatsapp || currentUser.phone || '',
          avatarUrl: currentUser.avatarUrl,
          trustScore: 5.0,
          kycLevel: 1,
          verified: Boolean(currentUser.phone_verified),
          chats_enabled: true,
        },
      };

      await onPublishSuccess(listingData, isEditing);
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue lors de l’enregistrement de l’annonce.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCategoryItem = getCategoryItem(category);

  return (
    <div className="max-w-2xl mx-auto px-3.5 sm:px-6 py-4 pb-28 text-white">
      {/* Top Bar with Cancel */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer min-h-[44px] px-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Annuler</span>
        </button>
        <h2 className="text-sm font-extrabold text-white">
          {isEditing ? 'Modifier mon annonce' : 'Déposer une annonce'}
        </h2>
        <div className="w-20 text-right">
          <span className="text-[11px] font-bold text-[#D4AF37] bg-[#1C1C24] px-2.5 py-1 rounded-full border border-[#D4AF37]/30">
            {photos.length}/8 photos
          </span>
        </div>
      </div>

      {/* Error message banner */}
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-950/70 border border-red-800 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Success / Compression Feedback */}
      {compressionMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-950/50 border border-[#D4AF37]/60 text-xs text-[#D4AF37] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{compressionMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Photo Uploader Card */}
        <div className="p-4 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-white block">Photos réelles de l'annonce *</span>
              <span className="text-[11px] text-gray-400">1 à 8 photos (compressées automatiquement en WebP)</span>
            </div>
            <label className="px-3 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#F59E0B] text-black text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm min-h-[44px]">
              <Camera className="w-4 h-4 stroke-[2.5]" />
              <span>{isCompressing ? 'Chargement...' : '+ Ajouter'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isCompressing || photos.length >= 8}
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Photos Grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden border border-zinc-700 bg-black group"
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  
                  {index === 0 && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#D4AF37] text-black text-[9px] font-black shadow-sm">
                      Principale
                    </span>
                  )}

                  {/* Move and delete controls */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(index, 'up')}
                        className="p-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Déplacer à gauche"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    {index < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(index, 'down')}
                        className="p-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Déplacer à droite"
                      >
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Supprimer la photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 p-6 rounded-xl border border-dashed border-zinc-700 bg-[#17171C] text-center">
              <ImageIcon className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-xs font-semibold text-gray-300">Aucune photo ajoutée pour le moment</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Une annonce avec au moins une photo se vend 5x plus vite.</p>
            </div>
          )}
        </div>

        {/* Title, Category & Subcategory Card */}
        <div className="p-4 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-200 block mb-1">
              Titre de l'annonce *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Toyota RAV4 2021 automatique toutes options"
              required
              className="w-full px-3.5 py-3 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
            />
          </div>

          {/* Dedicated Category Selector Button */}
          <div>
            <label className="text-xs font-bold text-gray-200 block mb-1">
              Catégorie de l'annonce *
            </label>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="w-full p-3.5 rounded-xl border border-zinc-700 bg-[#17171C] hover:border-[#D4AF37] text-left flex items-center justify-between transition-colors cursor-pointer min-h-[48px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-black/60 border border-[#D4AF37]/40 flex items-center justify-center shrink-0">
                  <CategoryGoldIcon categoryKey={category} className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <span className="text-xs font-extrabold text-white block">
                    {activeCategoryItem?.label || 'Sélectionner une catégorie'}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {subcategory ? `Sous-catégorie : ${subcategory}` : 'Cliquez pour choisir ou changer de catégorie'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
                <span>Changer</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </button>
          </div>

          {/* Subcategory (editable input) */}
          <div>
            <label className="text-xs font-bold text-gray-200 block mb-1">
              Sous-catégorie (facultatif ou précisé)
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Ex: Voitures, Smartphones, Appartements à louer..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
              />
            </div>
            {activeCategoryItem?.subcategories && activeCategoryItem.subcategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {activeCategoryItem.subcategories.slice(0, 5).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubcategory(sub)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                      subcategory === sub
                        ? 'bg-[#D4AF37] text-black font-bold'
                        : 'bg-zinc-800/80 text-gray-300 hover:text-white border border-zinc-700'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">
                État du produit *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ListingCondition)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
              >
                <option value="neuf">100% Neuf</option>
                <option value="occasion">Occasion / Seconde main</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">
                Nom du vendeur ou de l'entreprise *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Votre nom ou nom commercial"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-200 block mb-1">
              Description complète *
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détaillez les caractéristiques, l'état précis, les accessoires inclus et les conditions de remise..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
        </div>

        {/* Pricing & Location Card */}
        <div className="p-4 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">
                Prix demandé *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 50000"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-base font-bold text-[#D4AF37] placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none tabular-nums min-h-[44px]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">
                Devise *
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
              >
                <option value="XOF">FCFA (XOF) - UEMOA</option>
                <option value="XAF">FCFA (XAF) - CEMAC</option>
                <option value="NGN">Naira (NGN) - Nigeria</option>
                <option value="KES">Shilling (KES) - Kenya</option>
                <option value="CDF">Franc Congolais (CDF)</option>
                <option value="MAD">Dirham (MAD) - Maroc</option>
                <option value="GHS">Cedi (GHS) - Ghana</option>
                <option value="USD">Dollar ($ USD)</option>
                <option value="EUR">Euro (€ EUR)</option>
              </select>
            </div>
          </div>

          {/* Location: Country + City with live Search + Quartier */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-200 block mb-1">
                  Pays *
                </label>
                <select
                  value={country}
                  onChange={(e) => {
                    const c = e.target.value as CountryCode;
                    setCountry(c);
                    const defaultCity = CITIES_BY_COUNTRY[c]?.[0] || 'Abidjan';
                    setCity(defaultCity);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                >
                  {Object.values(AFRICAN_COUNTRIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Searchable City */}
              <div className="relative">
                <label className="text-xs font-bold text-gray-200 block mb-1">
                  Ville du pays actif *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#D4AF37] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={city}
                    onFocus={() => setShowCityDropdown(true)}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setCitySearch(e.target.value);
                      setShowCityDropdown(true);
                    }}
                    placeholder="Choisir ou saisir la ville..."
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
                  />
                </div>

                {/* City dropdown list */}
                {showCityDropdown && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-xl bg-[#1A1A22] border border-zinc-700 shadow-xl py-1 text-xs divide-y divide-zinc-800">
                    {filteredCities.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCity(c);
                          setShowCityDropdown(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-white hover:bg-[#D4AF37] hover:text-black font-semibold flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span>{c}</span>
                        {city === c && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                    {filteredCities.length === 0 && (
                      <div className="p-3 text-center text-gray-400">
                        Aucune ville prédéfinie. Saisie libre acceptée : "{city}".
                        <button
                          type="button"
                          onClick={() => setShowCityDropdown(false)}
                          className="mt-1 block mx-auto text-[#D4AF37] font-bold"
                        >
                          Valider cette ville
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quartier / Commune */}
            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">
                Quartier / Commune / Précision géographique
              </label>
              <input
                type="text"
                value={quartier}
                onChange={(e) => setQuartier(e.target.value)}
                placeholder="Ex: Cocody Angré, Plateau, Almadies, Victoria Island, Akwa..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-medium placeholder-zinc-500 focus:border-[#D4AF37] focus:outline-none min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* Coordonnées de contact direct (Téléphone et WhatsApp) */}
        <div className="p-4 rounded-2xl bg-[#131317] border border-zinc-800 shadow-md space-y-3.5">
          <div>
            <h3 className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Coordonnées de contact direct</span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Ces numéros (préremplis avec votre profil) seront directement cliquables pour les appels et WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-200 block mb-1">
                Numéro de téléphone d'appel *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => handleContactPhoneChange(e.target.value)}
                  placeholder="Ex: +2250707070707"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-mono focus:border-[#D4AF37] focus:outline-none tabular-nums min-h-[44px]"
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">Avec indicatif pays (ex: +225, +221, +237...)</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-200">
                  Numéro WhatsApp *
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-[#D4AF37] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsPhone}
                    onChange={(e) => handleSameAsPhoneToggle(e.target.checked)}
                    className="accent-[#D4AF37] rounded cursor-pointer"
                  />
                  <span className="font-semibold">Même numéro</span>
                </label>
              </div>
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={whatsappPhone}
                  onChange={(e) => setWhatsappPhone(e.target.value)}
                  disabled={sameAsPhone}
                  placeholder="Ex: +2250707070707"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 bg-[#17171C] text-white text-sm font-mono focus:border-[#D4AF37] focus:outline-none tabular-nums disabled:opacity-60 disabled:bg-[#121216] min-h-[44px]"
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1 block">Discussion directe sur WhatsApp</span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isCompressing}
          className="w-full py-4 px-4 rounded-xl bg-linear-to-r from-[#D4AF37] via-[#F59E0B] to-[#C5A059] hover:brightness-110 active:scale-[0.99] text-black text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 min-h-[50px]"
        >
          <Check className="w-5 h-5 stroke-[3] text-black" />
          <span>
            {isSubmitting
              ? 'Enregistrement dans Supabase...'
              : isEditing
              ? 'Enregistrer les modifications'
              : 'Publier mon annonce maintenant'}
          </span>
        </button>
      </form>

      {/* Dedicated Category Selection Modal */}
      <CategorySelectModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        selectedCategory={category}
        selectedSubcategory={subcategory}
        onSelect={(cat, sub) => {
          setCategory(cat);
          if (sub) setSubcategory(sub);
        }}
      />
    </div>
  );
};
