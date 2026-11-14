import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export interface UserCredential {
  userId: string;
  phone?: string;
  email?: string;
  fullName: string;
  passwordHash: string; // format: salt$derivedKeyHex
  city?: string;
  country?: string;
  avatarUrl?: string;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CredentialsStore {
  users: Record<string, UserCredential>; // userId -> UserCredential
}

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', 'data') : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'user_credentials.json');

// Supabase client with anon key
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wlvzjhpfcvwcgyelpsnx.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Gd_1w7RmnkKKeQ5RhobaPw_MPrka48J';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split('$');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  } catch {
    return false;
  }
}

function cleanPhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function ensureDataFile(): CredentialsStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initial: CredentialsStore = { users: {} };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || {},
    };
  } catch (err) {
    console.warn('[AuthStore] Error reading credentials file, using empty memory store:', err);
    return { users: {} };
  }
}

function saveStore(store: CredentialsStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AuthStore] Error saving credentials store:', err);
  }
}

// Marc Arnaud default account ID
export const ADMIN_USER_ID = 'd2882463-6bcf-414a-8844-6c06279e50e0';
export const ADMIN_PHONE = '+2250565242349';
export const ADMIN_EMAIL = 'marcarnaudkonan2@gmail.com';

/**
 * Initialize or seed Marc Arnaud's account if needed
 */
export function getOrSeedAdminUser(): UserCredential {
  const store = ensureDataFile();
  if (store.users[ADMIN_USER_ID]) {
    return store.users[ADMIN_USER_ID];
  }

  const seeded: UserCredential = {
    userId: ADMIN_USER_ID,
    phone: ADMIN_PHONE,
    email: ADMIN_EMAIL,
    fullName: 'Marc Arnaud',
    passwordHash: '', // uninitialized - will be locked on first login or reset
    city: 'Abidjan',
    country: 'CI',
    avatarUrl: 'https://wlvzjhpfcvwcgyelpsnx.supabase.co/storage/v1/object/public/avatars/d2882463-6bcf-414a-8844-6c06279e50e0/1792539620065_a7i3uic.webp',
    phoneVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.users[ADMIN_USER_ID] = seeded;
  saveStore(store);
  return seeded;
}

/**
 * Find user by phone, email, or ID
 */
export function findUserCredential(identifier: string): UserCredential | null {
  const store = ensureDataFile();
  const trimmed = identifier.trim().toLowerCase();
  const cleanDigits = cleanPhoneDigits(trimmed);

  // 1. Direct ID match
  if (store.users[identifier]) {
    return store.users[identifier];
  }

  // 2. Search values
  const list = Object.values(store.users);

  for (const u of list) {
    if (u.email && u.email.toLowerCase() === trimmed) {
      return u;
    }
    if (cleanDigits.length >= 8 && u.phone) {
      const uDigits = cleanPhoneDigits(u.phone);
      if (
        uDigits === cleanDigits ||
        uDigits.endsWith(cleanDigits) ||
        cleanDigits.endsWith(uDigits)
      ) {
        return u;
      }
    }
  }

  // Check if identifier is Marc Arnaud's phone or email
  if (
    trimmed === ADMIN_EMAIL.toLowerCase() ||
    cleanDigits === '2250565242349' ||
    cleanDigits === '0565242349' ||
    cleanDigits === '565242349'
  ) {
    return getOrSeedAdminUser();
  }

  return null;
}

/**
 * Set or update user password
 */
export function setUserPassword(userId: string, newPassword: string): UserCredential {
  const store = ensureDataFile();
  let user = store.users[userId];
  if (!user && userId === ADMIN_USER_ID) {
    user = getOrSeedAdminUser();
  }

  if (!user) {
    throw new Error('Utilisateur introuvable pour la mise à jour du mot de passe.');
  }

  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  store.users[userId] = user;
  saveStore(store);
  return user;
}

/**
 * Register or update user credential
 */
export function registerUserCredential(data: {
  userId?: string;
  phone?: string;
  email?: string;
  fullName: string;
  password: string;
  city?: string;
  country?: string;
  avatarUrl?: string;
}): UserCredential {
  const store = ensureDataFile();
  const id = data.userId || crypto.randomUUID();

  const credential: UserCredential = {
    userId: id,
    phone: data.phone,
    email: data.email,
    fullName: data.fullName,
    passwordHash: hashPassword(data.password),
    city: data.city || 'Abidjan',
    country: data.country || 'CI',
    avatarUrl: data.avatarUrl,
    phoneVerified: Boolean(data.phone),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.users[id] = credential;
  saveStore(store);
  return credential;
}

/**
 * Verify user credentials
 */
export function verifyUserLogin(identifier: string, password: string): {
  success: boolean;
  user?: UserCredential;
  message?: string;
} {
  const user = findUserCredential(identifier);
  if (!user) {
    return { success: false, message: 'Identifiant introuvable. Veuillez vérifier ou créer un compte.' };
  }

  // Security: never lock-in an empty passwordHash automatically on login
  if (!user.passwordHash) {
    return {
      success: false,
      message: 'Mot de passe non configuré localement. Utilisez vos identifiants Supabase ou réinitialisez votre mot de passe.',
    };
  }

  if (verifyPassword(password, user.passwordHash)) {
    return { success: true, user };
  }

  return { success: false, message: 'Mot de passe incorrect.' };
}
