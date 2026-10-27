import { supabase } from './supabase';
import { compressImageToWebP } from './imageCompressor';
import { sanitizeText, sanitizeUrl } from './security';

export type CategoryKey = 
  | 'vehicules'
  | 'immobilier'
  | 'electronique'
  | 'maison'
  | 'mode'
  | 'beaute'
  | 'bebes-enfants'
  | 'animaux'
  | 'alimentation-agriculture'
  | 'emplois'
  | 'services'
  | 'entreprise-industrie'
  | 'loisirs'
  | 'education'
  | 'autres'
  | 'produits';

export type ListingCondition = 'neuf' | 'occasion';
export type ListingStatus = 'active' | 'sold' | 'paused';
export type PhoneVisibility = 'everyone' | 'members' | 'nobody';
export type SupportTicketKind = 'question' | 'probleme' | 'suggestion';

export interface UserProfileData {
  id: string;
  full_name: string;
  bio?: string;
  city?: string;
  country?: string;
  avatar_url?: string;
  phone?: string;
  phone_verified?: boolean;
  phone_visibility?: PhoneVisibility;
  birth_date?: string | null;
  gender?: 'masculin' | 'feminin' | null;
  chats_enabled?: boolean;
  language?: 'fr' | 'en';
  notif_prefs?: {
    messages?: boolean;
    comments?: boolean;
    new_listings?: boolean;
  };
  data_saver?: boolean;
  theme?: 'dark' | 'light' | 'system';
  created_at?: string;
  updated_at?: string;
}

export interface ListingData {
  id: string;
  user_id: string;
  title: string;
  category: CategoryKey;
  subcategory?: string | null;
  description: string;
  price: number;
  currency: string;
  condition: ListingCondition;
  country: string;
  city: string;
  images: string[];
  status: ListingStatus;
  contact_phone?: string | null;
  whatsapp_phone?: string | null;
  edited_at?: string | null;
  created_at: string;
  seller?: {
    id: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    phone_verified?: boolean;
    chats_enabled?: boolean;
    city?: string;
    country?: string;
  };
}

export interface PostData {
  id: string;
  user_id: string;
  content: string;
  images: string[];
  edited_at?: string | null;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    city?: string;
    phone_verified?: boolean;
  };
  likes_count: number;
  is_liked?: boolean;
  comments_count: number;
}

export interface CommentData {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  edited_at?: string | null;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

export interface ConversationData {
  id: string;
  user_a: string;
  user_b: string;
  listing_id?: string | null;
  last_message_at: string;
  created_at: string;
  listing?: ListingData | null;
  other_user: {
    id: string;
    full_name: string;
    avatar_url?: string;
    city?: string;
    phone_verified?: boolean;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
}

export interface MessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  read_at?: string | null;
  created_at: string;
}

// ----------------------------------------------------
// 1. PROFILES (Direct Supabase)
// ----------------------------------------------------
export async function getProfile(userId: string): Promise<UserProfileData | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('getProfile error:', error.message);
    return null;
  }
  return data as UserProfileData | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<UserProfileData>
): Promise<UserProfileData> {
  const validUid = await resolveValidAuthUid(userId);

  // STRICT COLUMN FILTER: Only these columns are allowed by backend schema
  const allowedKeys = [
    'full_name',
    'bio',
    'city',
    'country',
    'avatar_url',
    'birth_date',
    'gender',
    'phone_visibility',
    'notif_prefs',
    'data_saver',
    'theme',
    'chats_enabled',
    'language',
  ] as const;

  const payload: Record<string, any> = {};
  for (const key of allowedKeys) {
    if ((updates as any)[key] !== undefined) {
      payload[key] = (updates as any)[key];
    }
  }

  // Sanitize user profile text inputs
  if (typeof payload.full_name === 'string') {
    payload.full_name = sanitizeText(payload.full_name, 100);
  }
  if (typeof payload.bio === 'string') {
    payload.bio = sanitizeText(payload.bio, 500);
  }
  if (typeof payload.city === 'string') {
    payload.city = sanitizeText(payload.city, 60);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', validUid)
    .select()
    .single();

  if (error || !data) {
    console.error('Supabase profile update error:', error?.message);
    throw new Error(error?.message || 'Impossible de mettre à jour le profil');
  }
  return data as UserProfileData;
}

// Requirement B: Photo de profil upload (WebP max 800px, quality 0.8, upsert false, cache-busting, old image cleanup)
export async function updateProfileAvatar(
  userId: string,
  file: File | Blob,
  previousAvatarUrl?: string
): Promise<string> {
  const validUid = await resolveValidAuthUid(userId);

  // 1. Compression WebP max 800px, qualité 0.8
  const { blob } = await compressImageToWebP(file, 800, 800, 0.8);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;
  const filePath = `${validUid}/${uniqueName}`;

  // 2. Envoi vers le bucket "avatars" avec upsert désactivé
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, blob, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (uploadError) {
    console.error('Supabase storage avatar upload error:', uploadError.message);
    throw new Error(`Téléversement de l'avatar impossible : ${uploadError.message}`);
  }

  // 3. Récupération de l'URL publique
  const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const publicUrl = pubData.publicUrl;

  // 4. Update UNIQUEMENT avatar_url dans la table profiles
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', validUid);

  if (updateError) {
    console.error('Supabase profiles avatar update error:', updateError.message);
    throw new Error(`Mise à jour du profil impossible : ${updateError.message}`);
  }

  // 5. Suppression de l'ancienne photo du bucket avatars après remplacement
  if (previousAvatarUrl && previousAvatarUrl.includes('/avatars/')) {
    try {
      const match = previousAvatarUrl.match(/\/avatars\/(.+?)(\?.*)?$/);
      if (match && match[1]) {
        const oldPath = decodeURIComponent(match[1]);
        if (oldPath !== filePath) {
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }
    } catch (cleanupErr) {
      console.warn('Nettoyage ancienne photo ignoré:', cleanupErr);
    }
  }

  // 6. Retourne l'URL rafraîchie avec paramètre anti-cache
  return `${publicUrl}?v=${Date.now()}`;
}

// Requirement C: Téléphone du compte (profile_private)
export async function getAccountPhone(userId: string): Promise<string | null> {
  try {
    const validUid = await resolveValidAuthUid(userId);
    const { data, error } = await supabase
      .from('profile_private')
      .select('phone')
      .eq('id', validUid)
      .maybeSingle();

    if (error) {
      console.warn('getAccountPhone error:', error.message);
      return null;
    }
    return data?.phone || null;
  } catch {
    return null;
  }
}

export async function updateAccountPhone(userId: string, phone: string): Promise<void> {
  const validUid = await resolveValidAuthUid(userId);
  const cleanPhone = phone.trim();

  // Validation du format : chiffres avec indicatif pays, min 8 max 15 chiffres
  const phoneRegex = /^\+?[0-9]{8,15}$/;
  if (!phoneRegex.test(cleanPhone)) {
    throw new Error('Format de numéro invalide. Exemple : +2250707070707 (chiffres avec indicatif pays).');
  }

  // Enregistre dans profile_private (update de la colonne phone uniquement, filtré par id = user.id)
  const { data: updatedRows, error: updateError } = await supabase
    .from('profile_private')
    .update({ phone: cleanPhone })
    .eq('id', validUid)
    .select();

  if (updateError) {
    console.error('updateAccountPhone error:', updateError.message);
    throw new Error(`Enregistrement du numéro impossible : ${updateError.message}`);
  }

  // If no existing row was matched, insert it
  if (!updatedRows || updatedRows.length === 0) {
    const { error: insertError } = await supabase
      .from('profile_private')
      .upsert({ id: validUid, phone: cleanPhone });
    if (insertError) {
      console.error('updateAccountPhone insert error:', insertError.message);
      throw new Error(`Enregistrement du numéro impossible : ${insertError.message}`);
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  return Boolean(id && UUID_REGEX.test(id));
}

export async function resolveValidAuthUid(candidateId?: string | null): Promise<string> {
  if (candidateId && isValidUuid(candidateId)) {
    return candidateId;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id && isValidUuid(session.user.id)) {
    return session.user.id;
  }
  throw new Error('Vous devez être connecté avec un compte vérifié pour effectuer cette action.');
}

// ----------------------------------------------------
// 2. STORAGE (Bucket Uploads - Max 1600px WebP)
// ----------------------------------------------------
export async function uploadWebpImage(
  bucket: 'avatars' | 'listings' | 'posts' | 'chat',
  userId: string,
  file: File | Blob,
  conversationId?: string
): Promise<string> {
  // Validate max size 5MB
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image trop volumineuse. Taille maximale autorisée : 5 Mo.');
  }

  const validUid = await resolveValidAuthUid(userId);
  const { blob } = await compressImageToWebP(file, 1600, 1600, 0.85);
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.webp`;

  let filePath = `${validUid}/${uniqueName}`;
  if (bucket === 'chat' && conversationId) {
    filePath = `${validUid}/${conversationId}/${uniqueName}`;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error || !data) {
    console.error('Storage upload error:', error);
    throw new Error(`Échec du téléversement de l'image (${bucket}) : ${error?.message || 'Erreur inconnue'}`);
  }

  if (bucket === 'chat') {
    // Private bucket: create signed URL
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 jours
    if (signErr || !signed?.signedUrl) {
      throw new Error('Impossible de générer le lien sécurisé pour le message.');
    }
    return signed.signedUrl;
  }

  // Public bucket
  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
  if (!pub?.publicUrl) {
    throw new Error('Impossible de récupérer l’adresse publique de l’image.');
  }
  return pub.publicUrl;
}

// ----------------------------------------------------
// 3. LISTINGS (Direct Supabase)
// ----------------------------------------------------
export async function fetchListings(filters?: {
  category?: CategoryKey | 'ALL';
  country?: string;
  city?: string;
  search?: string;
  status?: ListingStatus;
  userId?: string;
  sortBy?: 'recent' | 'price_asc' | 'price_desc';
  limit?: number;
  offset?: number;
}): Promise<ListingData[]> {
  let query = supabase.from('listings').select(`
    *,
    seller:profiles!listings_user_id_fkey (
      id, full_name, avatar_url, phone_verified, city, country, chats_enabled
    )
  `);

  if (filters?.userId) {
    query = query.eq('user_id', filters.userId);
  } else {
    query = query.eq('status', filters?.status || 'active');
  }

  if (filters?.category && filters.category !== 'ALL') {
    query = query.eq('category', filters.category);
  }

  if (filters?.country && filters.country !== 'ALL') {
    query = query.eq('country', filters.country);
  }

  if (filters?.city && filters.city.trim()) {
    query = query.ilike('city', `%${filters.city.trim()}%`);
  }

  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim();
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,subcategory.ilike.%${q}%`);
  }

  if (filters?.sortBy === 'price_asc') {
    query = query.order('price', { ascending: true });
  } else if (filters?.sortBy === 'price_desc') {
    query = query.order('price', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Progressive loading / Pagination (default 200 items to load full catalog)
  const limit = filters?.limit ?? 200;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) {
    console.error('fetchListings error:', error.message);
    throw new Error(`Impossible de charger les annonces : ${error.message}`);
  }
  return (data || []) as ListingData[];
}

export async function createListing(listing: {
  user_id: string;
  title: string;
  category: CategoryKey;
  subcategory?: string | null;
  description: string;
  price: number;
  currency: string;
  condition: ListingCondition;
  country: string;
  city: string;
  images: string[];
  contact_phone?: string | null;
  whatsapp_phone?: string | null;
  status?: ListingStatus;
}): Promise<ListingData> {
  const validUid = await resolveValidAuthUid(listing.user_id);

  // Validate contact phone formats (e.g. +2250707070707)
  const phoneRegex = /^\+?[0-9]{8,15}$/;
  const cleanContact = listing.contact_phone?.trim() || null;
  const cleanWhatsapp = listing.whatsapp_phone?.trim() || null;

  if (cleanContact && !phoneRegex.test(cleanContact)) {
    throw new Error('Numéro de téléphone d’appel invalide. Exemple : +2250707070707 (chiffres avec indicatif pays).');
  }
  if (cleanWhatsapp && !phoneRegex.test(cleanWhatsapp)) {
    throw new Error('Numéro WhatsApp invalide. Exemple : +2250707070707 (chiffres avec indicatif pays).');
  }

  const safeTitle = sanitizeText(listing.title, 120);
  const safeDesc = sanitizeText(listing.description, 5000);
  const safeCity = sanitizeText(listing.city, 60);
  const safeSubcategory = listing.subcategory ? sanitizeText(listing.subcategory, 60) : null;
  const safeImages = (listing.images || []).map(img => sanitizeUrl(img)).filter(Boolean);

  const { data, error } = await supabase
    .from('listings')
    .insert({
      user_id: validUid,
      title: safeTitle,
      category: listing.category,
      subcategory: safeSubcategory,
      description: safeDesc,
      price: Math.max(0, Number(listing.price) || 0),
      currency: listing.currency || 'XOF',
      condition: listing.condition,
      country: listing.country,
      city: safeCity,
      images: safeImages,
      contact_phone: cleanContact,
      whatsapp_phone: cleanWhatsapp,
      status: listing.status || 'active',
    })
    .select(`
      *,
      seller:profiles!listings_user_id_fkey (
        id, full_name, avatar_url, phone_verified, city, country, chats_enabled
      )
    `)
    .single();

  if (error || !data) {
    console.error('createListing error:', error);
    throw new Error(`Publication impossible : ${error?.message || 'Erreur d’enregistrement dans la base de données'}`);
  }

  return data as ListingData;
}

export async function updateListing(
  listingId: string,
  userId: string,
  updates: Partial<Omit<ListingData, 'id' | 'user_id' | 'created_at' | 'seller'>>
): Promise<ListingData> {
  const phoneRegex = /^\+?[0-9]{8,15}$/;
  if (updates.contact_phone) {
    const clean = String(updates.contact_phone).trim();
    if (!phoneRegex.test(clean)) {
      throw new Error('Numéro de téléphone d’appel invalide. Exemple : +2250707070707.');
    }
  }
  if (updates.whatsapp_phone) {
    const clean = String(updates.whatsapp_phone).trim();
    if (!phoneRegex.test(clean)) {
      throw new Error('Numéro WhatsApp invalide. Exemple : +2250707070707.');
    }
  }

  const sanitizedUpdates: Record<string, any> = { ...updates };
  if (typeof sanitizedUpdates.title === 'string') {
    sanitizedUpdates.title = sanitizeText(sanitizedUpdates.title, 120);
  }
  if (typeof sanitizedUpdates.description === 'string') {
    sanitizedUpdates.description = sanitizeText(sanitizedUpdates.description, 5000);
  }
  if (typeof sanitizedUpdates.city === 'string') {
    sanitizedUpdates.city = sanitizeText(sanitizedUpdates.city, 60);
  }
  if (typeof sanitizedUpdates.subcategory === 'string') {
    sanitizedUpdates.subcategory = sanitizeText(sanitizedUpdates.subcategory, 60);
  }
  if (Array.isArray(sanitizedUpdates.images)) {
    sanitizedUpdates.images = sanitizedUpdates.images.map(img => sanitizeUrl(img)).filter(Boolean);
  }

  const { data, error } = await supabase
    .from('listings')
    .update({
      ...sanitizedUpdates,
      edited_at: new Date().toISOString(),
    })
    .eq('id', listingId)
    .eq('user_id', userId)
    .select(`
      *,
      seller:profiles!listings_user_id_fkey (
        id, full_name, avatar_url, phone_verified, city, country, chats_enabled
      )
    `)
    .single();

  if (error || !data) {
    throw new Error(`Modification impossible : ${error?.message || 'Erreur lors de la mise à jour'}`);
  }
  return data as ListingData;
}

export async function deleteListing(listingId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Suppression impossible : ${error.message}`);
  }
}

// ----------------------------------------------------
// 4. FIL SOCIAL (POSTS, LIKES, COMMENTS)
// ----------------------------------------------------
export async function fetchPosts(
  currentUserId?: string,
  limit: number = 20,
  offset: number = 0
): Promise<PostData[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!posts_user_id_fkey (
        id, full_name, avatar_url, city, phone_verified
      ),
      likes:post_likes (
        user_id
      ),
      comments:comments (
        id
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('fetchPosts error:', error.message);
    throw new Error(`Impossible de charger le fil social : ${error.message}`);
  }

  return (data || []).map((p: any) => {
    const likes = Array.isArray(p.likes) ? p.likes : [];
    const comments = Array.isArray(p.comments) ? p.comments : [];
    const isLiked = currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false;

    return {
      id: p.id,
      user_id: p.user_id,
      content: p.content,
      images: p.images || [],
      edited_at: p.edited_at,
      created_at: p.created_at,
      author: p.author,
      likes_count: likes.length,
      is_liked: isLiked,
      comments_count: comments.length,
    };
  });
}

export async function createPost(userId: string, content: string, images: string[] = []): Promise<PostData> {
  const validUid = await resolveValidAuthUid(userId);
  const safeContent = sanitizeText(content, 3000);
  const safeImages = (images || []).map(img => sanitizeUrl(img)).filter(Boolean);

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: validUid,
      content: safeContent,
      images: safeImages,
    })
    .select(`
      *,
      author:profiles!posts_user_id_fkey (
        id, full_name, avatar_url, city, phone_verified
      )
    `)
    .single();

  if (error || !data) {
    throw new Error(`Publication impossible : ${error?.message || 'Erreur lors de l’envoi'}`);
  }

  return {
    id: data.id,
    user_id: data.user_id,
    content: data.content,
    images: data.images || [],
    edited_at: data.edited_at,
    created_at: data.created_at,
    author: data.author,
    likes_count: 0,
    is_liked: false,
    comments_count: 0,
  };
}

export async function updatePost(postId: string, userId: string, content: string): Promise<void> {
  const validUid = await resolveValidAuthUid(userId);
  const safeContent = sanitizeText(content, 3000);
  const { error } = await supabase
    .from('posts')
    .update({
      content: safeContent,
      edited_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('user_id', validUid);

  if (error) {
    throw new Error(`Modification impossible : ${error.message}`);
  }
}

export async function deletePost(postId: string, userId: string): Promise<void> {
  const validUid = await resolveValidAuthUid(userId);
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', validUid);

  if (error) {
    throw new Error(`Suppression impossible : ${error.message}`);
  }
}

export async function togglePostLike(postId: string, userId: string): Promise<boolean> {
  const validUid = await resolveValidAuthUid(userId);

  // Check if liked
  const { data: existing } = await supabase
    .from('post_likes')
    .select('*')
    .eq('post_id', postId)
    .eq('user_id', validUid)
    .maybeSingle();

  if (existing) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', validUid);
    return false;
  } else {
    await supabase.from('post_likes').insert({ post_id: postId, user_id: validUid });
    return true;
  }
}

export async function fetchComments(postId: string): Promise<CommentData[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:profiles!comments_user_id_fkey (
        id, full_name, avatar_url
      )
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('fetchComments error:', error.message);
    return [];
  }
  return (data || []) as CommentData[];
}

export async function createComment(postId: string, userId: string, content: string): Promise<CommentData> {
  const validUid = await resolveValidAuthUid(userId);
  const safeContent = sanitizeText(content, 1000);

  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: validUid,
      content: safeContent,
    })
    .select(`
      *,
      author:profiles!comments_user_id_fkey (
        id, full_name, avatar_url
      )
    `)
    .single();

  if (error || !data) {
    throw new Error(`Commentaire impossible : ${error?.message || 'Erreur'}`);
  }
  return data as CommentData;
}

export async function updateComment(commentId: string, userId: string, content: string): Promise<void> {
  const safeContent = sanitizeText(content, 1000);
  const { error } = await supabase
    .from('comments')
    .update({
      content: safeContent,
      edited_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Modification impossible : ${error.message}`);
  }
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Suppression impossible : ${error.message}`);
  }
}

// ----------------------------------------------------
// 5. FAVORITES
// ----------------------------------------------------
export async function getFavoriteListingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', userId);

  if (error) return [];
  return (data || []).map((f: any) => f.listing_id);
}

export async function toggleFavorite(userId: string, listingId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('favorites')
    .select('*')
    .eq('user_id', userId)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId);
    return false;
  } else {
    await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId });
    return true;
  }
}

// ----------------------------------------------------
// 6. MESSAGING & CONVERSATIONS
// ----------------------------------------------------
export async function fetchConversations(currentUserId: string): Promise<ConversationData[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      listing:listings (
        id, title, price, currency, images
      ),
      user_a_profile:profiles!conversations_user_a_fkey (
        id, full_name, avatar_url, city, phone_verified
      ),
      user_b_profile:profiles!conversations_user_b_fkey (
        id, full_name, avatar_url, city, phone_verified
      )
    `)
    .or(`user_a.eq.${currentUserId},user_b.eq.${currentUserId}`)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('fetchConversations error:', error.message);
    return [];
  }

  return (data || []).map((c: any) => {
    const isUserA = c.user_a === currentUserId;
    const otherUser = isUserA ? c.user_b_profile : c.user_a_profile;

    return {
      id: c.id,
      user_a: c.user_a,
      user_b: c.user_b,
      listing_id: c.listing_id,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
      listing: c.listing,
      other_user: otherUser || {
        id: isUserA ? c.user_b : c.user_a,
        full_name: 'Membre Afrique Business',
      },
      unread_count: 0,
    };
  });
}

export async function fetchMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<MessageData[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('fetchMessages error:', error.message);
    return [];
  }
  return (data || []) as MessageData[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string,
  imageUrl?: string
): Promise<MessageData> {
  const safeContent = sanitizeText(content, 2000);
  const safeImageUrl = imageUrl ? sanitizeUrl(imageUrl) : null;

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: safeContent,
      image_url: safeImageUrl,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Envoi impossible : ${error?.message || 'Erreur'}`);
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as MessageData;
}

export async function markConversationAsRead(conversationId: string, readerUserId: string): Promise<void> {
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', readerUserId)
    .is('read_at', null);
}

// ----------------------------------------------------
// 7. RPC FUNCTIONS
// ----------------------------------------------------
export async function rpcStartConversation(
  otherUserId: string,
  listingId?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('start_conversation', {
    other: otherUserId,
    listing: listingId || null,
  });

  if (error || !data) {
    console.error('rpc start_conversation error:', error);
    throw new Error(`Impossible d'initier la discussion : ${error?.message || 'Erreur'}`);
  }
  return data as string;
}

export async function rpcGetContactPhone(targetUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_contact_phone', {
    target: targetUserId,
  });

  if (error) {
    console.warn('rpc get_contact_phone error:', error.message);
    return null;
  }
  return data as string | null;
}

export async function rpcDeleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    throw new Error(`Erreur lors de la suppression du compte : ${error.message}`);
  }
}

// ----------------------------------------------------
// 8. BLOCKS & REPORTS & SUPPORT
// ----------------------------------------------------
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocks').insert({
    blocker_id: blockerId,
    blocked_id: blockedId,
  });
  if (error) throw new Error(`Blocage impossible : ${error.message}`);
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', userId);
  if (error) return [];
  return (data || []).map((b: any) => b.blocked_id);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
}

export async function submitReport(report: {
  reporter_id: string;
  target_type: 'listing' | 'post' | 'comment' | 'user' | 'message';
  target_id: string;
  reason: string;
  details?: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert(report);
  if (error) throw new Error(`Signalement impossible : ${error.message}`);
}

export async function submitSupportTicket(ticket: {
  user_id: string;
  kind: SupportTicketKind;
  subject: string;
  message: string;
}): Promise<void> {
  const { error } = await supabase.from('support_tickets').insert({
    ...ticket,
    status: 'open',
  });
  if (error) throw new Error(`Envoi impossible : ${error.message}`);
}

// ----------------------------------------------------
// 9. REALTIME SUBSCRIPTIONS
// ----------------------------------------------------
export function subscribeToRealtime(
  table: 'messages' | 'posts' | 'comments' | 'listings',
  callback: (payload: any) => void
): () => void {
  const channel = supabase
    .channel(`realtime_${table}_${Date.now()}_${Math.random()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ----------------------------------------------------
// 10. DIAGNOSTICS (Test Connection Speed)
// ----------------------------------------------------
export async function testConnectionSpeed(): Promise<{
  latencyMs: number;
  status: 'bonne' | 'moyenne' | 'faible';
  advice: string;
}> {
  const start = performance.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - start);
    if (error) throw error;

    if (latencyMs < 350) {
      return {
        latencyMs,
        status: 'bonne',
        advice: 'Connexion très rapide vers Supabase. Les images, annonces et messages se chargent instantanément.',
      };
    } else if (latencyMs < 900) {
      return {
        latencyMs,
        status: 'moyenne',
        advice: 'Connexion réseau correcte. Vous pouvez activer le Mode Économie de données pour un affichage plus fluide.',
      };
    } else {
      return {
        latencyMs,
        status: 'faible',
        advice: 'Connexion mobile lente détectée. Il est vivement conseillé d’activer le Mode Économie de données dans vos paramètres.',
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      latencyMs,
      status: 'faible',
      advice: 'Difficulté à joindre la base de données. Vérifiez votre couverture internet mobile (3G/4G/WiFi).',
    };
  }
}
