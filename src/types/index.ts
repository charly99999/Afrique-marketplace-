export type CategoryId = 
  | 'ALL'
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
  // Backward compatibility aliases
  | 'produits'
  | 'emploi'
  | 'PRODUCTS' 
  | 'FASHION'
  | 'ELECTRONICS'
  | 'VEHICLES' 
  | 'REAL_ESTATE' 
  | 'LANDS'
  | 'SERVICES'
  | 'JOBS'
  | 'AGRI_LIVESTOCK' 
  | 'B2B_WHOLESALE';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  iconName: string;
  badge?: string;
}

export type CountryCode = 'CI' | 'SN' | 'NG' | 'KE' | 'CD' | 'MA' | 'GH' | 'CM' | 'ZA';

export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  symbol: string;
  phonePrefix: string;
  languages: string[];
  momoProviders?: { id: string; name: string; color: string }[];
  exchangeRateToUSD: number;
}

export type PhoneVisibility = 'everyone' | 'members' | 'nobody';

export interface StoredUser {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phone?: string;
  bio?: string;
  city?: string;
  country?: CountryCode;
  avatarUrl?: string;
  avatar_url?: string;
  phone_verified?: boolean;
  phone_visibility?: PhoneVisibility;
  passwordHash?: string;
  theme?: 'dark' | 'light' | 'system';
  data_saver?: boolean;
  birth_date?: string | null;
  gender?: 'masculin' | 'feminin' | null;
  chats_enabled?: boolean;
  language?: 'fr' | 'en';
  activeRole?: 'BUYER' | 'SELLER' | 'COURIER';
  kycLevel?: 1 | 2;
  trustScore?: number;
  walletBalance?: number;
  registeredAt?: string;
}

// UserProfile alias
export type UserProfile = StoredUser & {
  name?: string;
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'AUTH' | 'EMAIL' | 'OFFER' | 'LISTING' | 'ESCROW' | 'SYSTEM';
  timestamp: string;
  read: boolean;
}

export type ProductCondition = 'neuf' | 'occasion' | 'NEUF' | 'RECONDITIONNE' | 'OCCASION_EXCELLENT';

export interface Listing {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: CategoryId;
  subcategory?: string | null;
  country: CountryCode;
  city: string;
  neighborhood?: string;
  images: string[];
  condition: ProductCondition;
  warrantyMonths?: number;
  isNegotiable?: boolean;
  status: 'active' | 'sold' | 'paused' | 'ACTIVE' | 'SOLD';
  contact_phone?: string;
  whatsapp_phone?: string;
  createdAt: string;
  edited_at?: string | null;
  viewsCount?: number;
  seller: {
    id: string;
    name: string;
    phone?: string;
    whatsapp?: string;
    avatarUrl?: string;
    avatar_url?: string;
    trustScore?: number;
    kycLevel?: 1 | 2;
    verified?: boolean;
    phone_verified?: boolean;
    chats_enabled?: boolean;
    city?: string;
    country?: string;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  text?: string;
  content?: string;
  photoUrl?: string;
  image_url?: string;
  timestamp?: string;
  created_at?: string;
}

export interface ChatConversation {
  id: string;
  listingId?: string;
  listing_id?: string;
  listingTitle?: string;
  listingPrice?: number;
  listingCurrency?: string;
  listingImage?: string;
  sellerId?: string;
  buyerId?: string;
  participant1_id?: string;
  participant2_id?: string;
  otherUser: {
    id: string;
    name: string;
    phone?: string;
    whatsapp?: string;
    avatarUrl?: string;
    phone_verified?: boolean;
  };
  messages: ChatMessage[];
  unreadCount: number;
}

export interface SocialStory {
  id: string;
  shopName: string;
  shopAvatar: string;
  verified: boolean;
  country: CountryCode;
  imageUrl: string;
  caption: string;
  timestamp: string;
}

export interface SocialPost {
  id: string;
  authorName?: string;
  authorAvatar?: string;
  verified?: boolean;
  country?: CountryCode;
  city?: string;
  content: string;
  imageUrl?: string;
  images?: string[];
  created_at?: string;
  edited_at?: string | null;
  likes?: number;
  likes_count?: number;
  commentsCount?: number;
  comments_count?: number;
  isLiked?: boolean;
  is_liked?: boolean;
}
