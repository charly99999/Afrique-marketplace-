import { StoredUser, Listing, AppNotification, ChatConversation } from '../types';

const USERS_KEY = 'ab_users';
const CURRENT_USER_KEY = 'ab_current_user';
const LISTINGS_KEY = 'ab_db_listings';
const NOTIFICATIONS_KEY = 'ab_notifications';
const CONVERSATIONS_KEY = 'ab_db_conversations';

// Users Store
export function getStoredUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveUser(user: StoredUser): void {
  const users = getStoredUsers();
  const existingIdx = users.findIndex(
    (u) =>
      (u.email && u.email.toLowerCase() === (user.email || '').toLowerCase()) ||
      (u.phone && u.phone.replace(/[^\d+]/g, '') === (user.phone || '').replace(/[^\d+]/g, ''))
  );
  if (existingIdx >= 0) {
    users[existingIdx] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  return Boolean(id && UUID_REGEX.test(id));
}

// Immediate purge of any legacy keys or mock users (like usr_default)
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed || !isValidUuid(parsed.id)) {
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
    const legacyKeys = [
      'afrique_business_current_user',
      'afrique_business_users',
      'afrique_business_listings',
      'currentUser',
      'current_user',
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage errors
  }
}

// Current User Session (Memorized between app reloads)
export function getCurrentUser(): StoredUser | null {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    if (!data) return null;
    const user = JSON.parse(data);
    // Purge any legacy mock user (such as usr_default)
    if (!user || !isValidUuid(user.id)) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: StoredUser | null): void {
  if (user && isValidUuid(user.id)) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// Listings Store
export function getStoredListings(): Listing[] {
  try {
    const data = localStorage.getItem(LISTINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveListing(listing: Listing): void {
  const listings = getStoredListings();
  const updated = [listing, ...listings.filter((l) => l.id !== listing.id)];
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(updated));
}

export function deleteStoredListing(listingId: string): void {
  const listings = getStoredListings();
  const updated = listings.filter((l) => l.id !== listingId);
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(updated));
}

// Notifications Store
export function getStoredNotifications(): AppNotification[] {
  try {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): void {
  const all = getStoredNotifications();
  const newNotif: AppNotification = {
    ...notif,
    id: `notif_${Date.now()}`,
    timestamp: 'À l’instant',
    read: false,
  };
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([newNotif, ...all].slice(0, 30)));
}

export function markNotificationsAsRead(): void {
  const all = getStoredNotifications();
  const updated = all.map((n) => ({ ...n, read: true }));
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
}

// Conversations Store
export function getStoredConversations(): ChatConversation[] {
  try {
    const data = localStorage.getItem(CONVERSATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveConversation(conv: ChatConversation): void {
  const all = getStoredConversations();
  const existingIdx = all.findIndex((c) => c.id === conv.id);
  if (existingIdx >= 0) {
    all[existingIdx] = conv;
  } else {
    all.unshift(conv);
  }
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(all));
}
