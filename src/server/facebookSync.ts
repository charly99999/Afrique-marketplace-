import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE = path.join(DATA_DIR, 'facebook_config.json');
const IMPORTS_FILE = path.join(DATA_DIR, 'facebook_imports.json');
const LOGS_FILE = path.join(DATA_DIR, 'facebook_sync_logs.json');
const NOTIFS_FILE = path.join(DATA_DIR, 'facebook_notifications.json');

// Interface definitions
export interface FacebookConfig {
  pageId: string;
  pageToken: string;
  pageName: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  adminUserId?: string;
  paginationCursor?: string | null;
}

export interface ImportedFacebookItem {
  facebookPostId: string;
  targetType: 'listing' | 'social_post';
  targetId: string;
  status: 'active' | 'draft' | 'published';
  title: string;
  price?: number | null;
  category?: string | null;
  createdTime: string;
  permalinkUrl: string;
  pageName: string;
  importedAt: string;
  rawSnippet?: string;
}

export interface FacebookSyncLog {
  id: string;
  timestamp: string;
  trigger: 'manual' | 'hourly_cron' | 'test';
  status: 'success' | 'warning' | 'error';
  importedCount: number;
  importedListings: number;
  importedPosts: number;
  ignoredCount: number;
  draftCount: number;
  errorCount?: number;
  errorMessage?: string | null;
  details: string;
}

export interface FacebookAdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'ERROR' | 'WARNING' | 'INFO' | 'SUCCESS';
  timestamp: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Helpers for persistent storage & Token Scrubbing
// ---------------------------------------------------------------------------

/**
 * Redacts any Facebook access tokens or credentials from error logs and UI messages.
 */
export function scrubToken(text: string, token?: string): string {
  if (!text) return '';
  let clean = String(text);
  if (token && token.length > 5) {
    clean = clean.split(token).join('[JETON_MASQUÉ]');
  }
  // Scrub typical Facebook tokens (starting with EA or EAA) and URL token query parameters
  clean = clean.replace(/access_token=[a-zA-Z0-9%_-]+/gi, 'access_token=[JETON_MASQUÉ]');
  clean = clean.replace(/EA[A-Za-z0-9_-]{20,}/g, '[JETON_MASQUÉ]');
  return clean;
}

let cachedDbConfig: Partial<FacebookConfig> | null = null;
let lastDbFetchTime = 0;

export async function fetchConfigFromDatabase(): Promise<Partial<FacebookConfig> | null> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const adminUser = usersData?.users?.find(
      (u) =>
        u.email === 'marcarnaudkonan2@gmail.com' ||
        u.phone?.includes('2250565242349')
    );
    if (adminUser?.user_metadata?.facebook_config) {
      cachedDbConfig = adminUser.user_metadata.facebook_config;
      lastDbFetchTime = Date.now();
      return cachedDbConfig;
    }
  } catch (err) {
    console.warn('[Facebook Sync] Error fetching config from database:', err);
  }
  return null;
}

export function getFacebookConfig(): FacebookConfig {
  let fileData: any = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fileData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[Facebook Sync] Error reading config file:', err);
  }

  // Priority order:
  // 1. Database-registered config (cachedDbConfig)
  // 2. Saved local file (fileData)
  // 3. Environment variables (process.env) as fallback only if nothing is registered
  const db = cachedDbConfig || {};

  const pageId = String(db.pageId || fileData.pageId || process.env.FACEBOOK_PAGE_ID || '').trim();
  const pageToken = String(db.pageToken || fileData.pageToken || process.env.FACEBOOK_PAGE_TOKEN || '').trim();
  const pageName = String(db.pageName || fileData.pageName || process.env.FACEBOOK_PAGE_NAME || 'Afrique Business Officiel').trim();
  const autoSyncEnabled = db.autoSyncEnabled !== undefined ? db.autoSyncEnabled : (fileData.autoSyncEnabled !== false);
  const syncIntervalMinutes = db.syncIntervalMinutes || fileData.syncIntervalMinutes || 60;
  const lastSyncAt = db.lastSyncAt || fileData.lastSyncAt || null;
  const adminUserId = db.adminUserId || fileData.adminUserId || 'd2882463-6bcf-414a-8844-6c06279e50e0';
  const paginationCursor = db.paginationCursor !== undefined ? db.paginationCursor : (fileData.paginationCursor || null);

  return {
    pageId,
    pageToken,
    pageName,
    autoSyncEnabled,
    syncIntervalMinutes,
    lastSyncAt,
    adminUserId,
    paginationCursor,
  };
}

export async function getFacebookConfigAsync(): Promise<FacebookConfig> {
  if (!cachedDbConfig || Date.now() - lastDbFetchTime > 30 * 1000) {
    await fetchConfigFromDatabase();
  }
  return getFacebookConfig();
}

export async function saveFacebookConfig(updates: Partial<FacebookConfig>): Promise<FacebookConfig> {
  const current = await getFacebookConfigAsync();
  const updated: FacebookConfig = { ...current, ...updates };

  // 1. Update memory cache
  cachedDbConfig = { ...cachedDbConfig, ...updates };
  lastDbFetchTime = Date.now();

  // 2. Persist to local JSON file
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Facebook Sync] Error saving config file:', err);
  }

  // 3. Persist to Supabase Database (Marc Arnaud user_metadata.facebook_config)
  try {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const adminUser = usersData?.users?.find(
        (u) =>
          u.email === 'marcarnaudkonan2@gmail.com' ||
          u.phone?.includes('2250565242349')
      );
      const adminId = adminUser?.id || 'd2882463-6bcf-414a-8844-6c06279e50e0';
      const currentMeta = adminUser?.user_metadata || {};

      await supabase.auth.admin.updateUserById(adminId, {
        user_metadata: {
          ...currentMeta,
          facebook_config: {
            pageId: updated.pageId,
            pageToken: updated.pageToken,
            pageName: updated.pageName,
            autoSyncEnabled: updated.autoSyncEnabled,
            syncIntervalMinutes: updated.syncIntervalMinutes,
            lastSyncAt: updated.lastSyncAt,
            paginationCursor: updated.paginationCursor !== undefined ? updated.paginationCursor : null,
          },
        },
      });
      console.log('[Facebook Sync] Configuration successfully saved to Supabase database.');
    }
  } catch (dbErr) {
    console.error('[Facebook Sync] Error saving config to Supabase database:', dbErr);
  }

  return updated;
}

export function getImportedItems(): ImportedFacebookItem[] {
  try {
    if (fs.existsSync(IMPORTS_FILE)) {
      return JSON.parse(fs.readFileSync(IMPORTS_FILE, 'utf-8'));
    }
  } catch {
    // Return empty array
  }
  return [];
}

export function saveImportedItem(item: ImportedFacebookItem): void {
  const list = getImportedItems();
  const existingIdx = list.findIndex((i) => i.facebookPostId === item.facebookPostId);
  if (existingIdx >= 0) {
    list[existingIdx] = item;
  } else {
    list.unshift(item);
  }
  fs.writeFileSync(IMPORTS_FILE, JSON.stringify(list.slice(0, 500), null, 2), 'utf-8');
}

export function getSyncLogs(): FacebookSyncLog[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    }
  } catch {
    // Return empty array
  }
  return [];
}

export function appendSyncLog(log: FacebookSyncLog): void {
  const logs = getSyncLogs();
  logs.unshift(log);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
}

export function getAdminNotifications(): FacebookAdminNotification[] {
  try {
    if (fs.existsSync(NOTIFS_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFS_FILE, 'utf-8'));
    }
  } catch {
    // Return empty array
  }
  return [];
}

export function addAdminNotification(notif: Omit<FacebookAdminNotification, 'id' | 'timestamp' | 'read'>): void {
  const notifs = getAdminNotifications();
  const newNotif: FacebookAdminNotification = {
    ...notif,
    id: `fb_notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifs.unshift(newNotif);
  fs.writeFileSync(NOTIFS_FILE, JSON.stringify(notifs.slice(0, 50), null, 2), 'utf-8');
}

export function markNotificationsAsRead(): void {
  const notifs = getAdminNotifications().map((n) => ({ ...n, read: true }));
  fs.writeFileSync(NOTIFS_FILE, JSON.stringify(notifs, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Supabase Admin client initialization
// ---------------------------------------------------------------------------
function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wlvzjhpfcvwcgyelpsnx.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// ---------------------------------------------------------------------------
// Gemini AI text analyzer for Facebook Posts
// ---------------------------------------------------------------------------
interface AIAnalysisResult {
  decision: 'listing' | 'social_post';
  title?: string;
  description?: string;
  price?: number | null;
  category?: string | null;
  subcategory?: string | null;
  city?: string;
  contactPhone?: string | null;
  condition?: 'neuf' | 'occasion';
  isIncomplete?: boolean;
}

const VALID_CATEGORIES = [
  'vehicules',
  'immobilier',
  'electronique',
  'maison',
  'mode',
  'beaute',
  'bebes-enfants',
  'animaux',
  'alimentation-agriculture',
  'emplois',
  'services',
  'entreprise-industrie',
  'loisirs',
  'education',
  'autres',
] as const;

// Quota & Rate-Limit Circuit Breaker for Gemini AI
let geminiQuotaCooldownUntil = 0;

export async function analyzePostWithGemini(
  postText: string,
  geminiKey?: string
): Promise<AIAnalysisResult> {
  const key = geminiKey || process.env.GEMINI_API_KEY;

  // 1. If key is missing or quota circuit-breaker is active, immediately run local heuristic engine
  if (!key || Date.now() < geminiQuotaCooldownUntil) {
    return fallbackHeuristicAnalysis(postText);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-facebook-sync',
        },
      },
    });

    const systemPrompt = `Tu es un expert en modération et conversion de contenu pour "Afrique Business", la marketplace et communauté panafricaine.
Tu dois analyser une publication issue de la page Facebook officielle d'un commerçant/entrepreneur.

RÈGLES IMPÉRATIVES :
1. FIDÉLITÉ ABSOLUE : Reste 100% fidèle au texte source. N'INVENTE RIEN (pas de caractéristiques fictives, pas de prix imaginaire, pas de promesses inventées). Aucun ton robotique, garde un français naturel, fluide et commerçant.
2. DÉCISION TYPE :
   - "listing" : S'il s'agit d'une offre commerciale concrète d'un bien ou service (véhicule, maison/terrain/villa, smartphone/ordinateur, vêtement, produit alimentaire, meuble, offre d'emploi ou prestation de service).
   - "social_post" : S'il s'agit d'un message informatif, conseil, salutation, citation inspirante, actualité, événement sans produit unitaire à vendre.
3. SI LISTING :
   - "title" : Titre court, clair et vendeur (ex: "Toyota RAV4 2020", "Villa 4 pièces Cocody Angré", "iPhone 13 Pro 128Go").
   - "description" : Le texte original réécrit de manière élégante, humaine, fluide et attractive.
   - "price" : Prix en FCFA (XOF) en nombre entier pur (ex: si le texte dit "50.000 FCFA" ou "50k", renvoie 50000). Si aucun prix n'est mentionné, renvoie null.
   - "category" : L'une de ces valeurs exactes : "vehicules", "immobilier", "electronique", "maison", "mode", "beaute", "bebes-enfants", "animaux", "alimentation-agriculture", "emplois", "services", "entreprise-industrie", "loisirs", "education", "autres". Si introuvable, null.
   - "subcategory" : Exemple "Voitures", "Terrains", "Villas", "Téléphones", "Chaussures".
   - "city" : Ville ou quartier mentionné (ex: "Abidjan", "Cocody", "Yopougon", "Dakar", "Douala", "Lomé"). Par défaut "Abidjan" si non spécifié.
   - "contactPhone" : Numéro de téléphone présent dans le texte au format standard (ex: +2250707070707 ou 0707070707), ou null si absent.
   - "condition" : "neuf" ou "occasion". Par défaut "occasion" pour immobilier et véhicules d'occasion, "neuf" si précisé.
   - "isIncomplete" : true si le "price" est null OU si la "category" est null (ce qui classera l'annonce en brouillon).

RÉPONDRE EN JSON STRICT selon ce schéma :
{
  "decision": "listing" | "social_post",
  "title": string,
  "description": string,
  "price": number | null,
  "category": string | null,
  "subcategory": string | null,
  "city": string,
  "contactPhone": string | null,
  "condition": "neuf" | "occasion",
  "isIncomplete": boolean
}`;

    // Maximum 20 seconds timeout per AI call
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Délai dépassé (20s max)')), 20000)
    );

    // Prefer gemini-2.5-flash or gemini-3.8-flash
    const generatePromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Voici le texte de la publication Facebook à analyser :\n\n"""\n${postText}\n"""`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');

    // Validate category
    let safeCat = parsed.category;
    if (safeCat && !VALID_CATEGORIES.includes(safeCat)) {
      safeCat = 'autres';
    }

    const price = typeof parsed.price === 'number' && parsed.price > 0 ? Math.round(parsed.price) : null;
    const isIncomplete = !price || !safeCat;

    return {
      decision: parsed.decision === 'social_post' ? 'social_post' : 'listing',
      title: parsed.title || postText.slice(0, 60),
      description: parsed.description || postText,
      price,
      category: safeCat,
      subcategory: parsed.subcategory || null,
      city: parsed.city || 'Abidjan',
      contactPhone: parsed.contactPhone || null,
      condition: parsed.condition === 'neuf' ? 'neuf' : 'occasion',
      isIncomplete,
    };
  } catch (err: any) {
    const errMsg = String(err?.message || '');
    const isQuotaExceeded =
      err?.status === 429 ||
      errMsg.includes('429') ||
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('Quota exceeded');

    if (isQuotaExceeded) {
      // Cooldown Gemini API for 2 hours to avoid repeated failed calls and error logs
      geminiQuotaCooldownUntil = Date.now() + 2 * 60 * 60 * 1000;
      console.log('[Facebook Sync] Quota journalier Gemini atteint (429). Activation du moteur heuristique local sans interruption.');
    } else {
      console.log('[Facebook Sync] Analyse assistée locale activée pour cette publication.');
    }

    return fallbackHeuristicAnalysis(postText);
  }
}

// Fallback high-accuracy regex & heuristic analysis when Gemini is unavailable or rate-limited
function fallbackHeuristicAnalysis(text: string): AIAnalysisResult {
  const lower = text.toLowerCase();

  // 1. Price detection (e.g. 50 000 FCFA, 50k, 15 millions, 25.000 F)
  let price: number | null = null;

  // Pattern A: "15 millions" or "1.5 million"
  const millionsMatch = text.match(/(\d+(?:[.,]\d+)?)\s*millions?(?:\s*(?:de\s*)?(?:fcfa|cfa|f\b))?/i);
  if (millionsMatch) {
    const rawVal = parseFloat(millionsMatch[1].replace(',', '.'));
    if (!isNaN(rawVal) && rawVal > 0) {
      price = Math.round(rawVal * 1_000_000);
    }
  }

  // Pattern B: "50k" or "50 k"
  if (!price) {
    const kMatch = text.match(/\b(\d{1,4})\s*k(?:\s*(?:fcfa|cfa|f\b))?/i);
    if (kMatch) {
      const num = parseInt(kMatch[1], 10);
      if (!isNaN(num) && num > 0) {
        price = num * 1_000;
      }
    }
  }

  // Pattern C: Standard FCFA amount (e.g. "50.000 FCFA", "75 000 F CFA", "25000 CFA")
  if (!price) {
    const standardMatch = text.match(/(\d[\d\s.,]{2,10})\s*(?:fcfa|f\s*cfa|cfa|frs|f\b)/i);
    if (standardMatch) {
      const rawDigits = standardMatch[1].replace(/[^\d]/g, '');
      const num = parseInt(rawDigits, 10);
      if (!isNaN(num) && num >= 100 && num <= 2_000_000_000) {
        price = num;
      }
    }
  }

  // Pattern D: "Prix : 50000"
  if (!price) {
    const prixMatch = text.match(/prix\s*[:=]\s*(\d[\d\s.,]{2,10})/i);
    if (prixMatch) {
      const rawDigits = prixMatch[1].replace(/[^\d]/g, '');
      const num = parseInt(rawDigits, 10);
      if (!isNaN(num) && num >= 100 && num <= 2_000_000_000) {
        price = num;
      }
    }
  }

  // 2. Phone detection (Côte d'Ivoire 10-digit formats)
  let contactPhone: string | null = null;
  const phoneMatch = text.match(/(?:\+?225\s*)?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/);
  if (phoneMatch) {
    const clean = phoneMatch[0].replace(/[^\d+]/g, '');
    contactPhone = clean.startsWith('+') ? clean : clean.length === 10 ? `+225${clean}` : clean;
  }

  // 3. Category & Subcategory detection
  let category: string | null = null;
  let subcategory: string | null = null;

  if (/\b(?:villa|appartement|terrain|maison|parcelle|hectare|studio|chambre|duplex|triplex|immeuble|bureau|magasin|entrepôt|local)\b/i.test(lower)) {
    category = 'immobilier';
    if (/\b(?:terrain|parcelle|hectare)\b/i.test(lower)) subcategory = 'Terrains';
    else if (/\b(?:villa|maison|duplex)\b/i.test(lower)) subcategory = 'Villas & Maisons';
    else if (/\b(?:appartement|studio)\b/i.test(lower)) subcategory = 'Appartements';
    else subcategory = 'Immobilier';
  } else if (/\b(?:voiture|véhicule|toyota|mercedes|auto|moto|camion|hyundai|kia|bmw|peugeot|renault|nissan|scooter|4x4|suv)\b/i.test(lower)) {
    category = 'vehicules';
    if (/\b(?:moto|scooter)\b/i.test(lower)) subcategory = 'Motos & Deux-roues';
    else if (/\b(?:camion|pick-up|utilitaire)\b/i.test(lower)) subcategory = 'Utilitaires';
    else subcategory = 'Voitures';
  } else if (/\b(?:iphone|samsung|téléphone|smartphone|ordinateur|laptop|macbook|tv|écran|playstation|ps5|ps4|airpods|tablette|ipad)\b/i.test(lower)) {
    category = 'electronique';
    if (/\b(?:iphone|samsung|téléphone|smartphone)\b/i.test(lower)) subcategory = 'Téléphones & Tablettes';
    else if (/\b(?:ordinateur|laptop|macbook|pc)\b/i.test(lower)) subcategory = 'Ordinateurs';
    else if (/\b(?:tv|écran|smart tv)\b/i.test(lower)) subcategory = 'Télévisions';
    else subcategory = 'High-Tech';
  } else if (/\b(?:robe|chaussure|costume|sac|mode|t-shirt|pantalon|baskets|montre|perruque|mèche|bijou)\b/i.test(lower)) {
    category = 'mode';
    if (/\b(?:chaussure|basket|sandale|talon)\b/i.test(lower)) subcategory = 'Chaussures';
    else if (/\b(?:sac|sacoche)\b/i.test(lower)) subcategory = 'Sacs & Maroquinerie';
    else subcategory = 'Vêtements';
  } else if (/\b(?:salon|canapé|fauteuil|lit|matelas|armoire|frigo|réfrigérateur|cuisinière|climatiseur|meuble)\b/i.test(lower)) {
    category = 'maison';
    subcategory = 'Meubles & Équipements';
  } else if (/\b(?:parfum|savon|pommade|crème|maquillage|soin|beauté)\b/i.test(lower)) {
    category = 'beaute';
    subcategory = 'Cosmétiques & Parfums';
  } else if (/\b(?:recrutement|cherche|embauche|stage|offre d'emploi|candidature|chauffeur|nounou|cuisinier)\b/i.test(lower)) {
    category = 'emplois';
    subcategory = 'Offres d’emploi';
  } else if (/\b(?:service|plombier|électricien|menuisier|traiteur|déménagement|réparation|nettoyage|livraison|coursier)\b/i.test(lower)) {
    category = 'services';
    subcategory = 'Prestations de services';
  } else if (/\b(?:poulet|viande|poisson|riz|huile|attiéké|agricole|élevage|engrais|semence)\b/i.test(lower)) {
    category = 'alimentation-agriculture';
    subcategory = 'Agro-alimentaire';
  }

  // 4. City detection (Abidjan communes & major Ivorian towns)
  let city = 'Abidjan';
  if (/angré|riviera|deux plateaux|palmeraie|danga|blockhauss|cocody/i.test(lower)) {
    city = 'Cocody, Abidjan';
  } else if (/niangon|maroc|bel air|toit rouge|siporex|selmer|yopougon/i.test(lower)) {
    city = 'Yopougon, Abidjan';
  } else if (/zone 4|biétry|anoumabo|marcory/i.test(lower)) {
    city = 'Marcory, Abidjan';
  } else if (/plateau/i.test(lower)) {
    city = 'Plateau, Abidjan';
  } else if (/koumassi/i.test(lower)) {
    city = 'Koumassi, Abidjan';
  } else if (/treichville/i.test(lower)) {
    city = 'Treichville, Abidjan';
  } else if (/port-bouët|port bouet|vridi/i.test(lower)) {
    city = 'Port-Bouët, Abidjan';
  } else if (/adjamé|adjame/i.test(lower)) {
    city = 'Adjamé, Abidjan';
  } else if (/abobo/i.test(lower)) {
    city = 'Abobo, Abidjan';
  } else if (/bingerville/i.test(lower)) {
    city = 'Bingerville';
  } else if (/grand-bassam|bassam/i.test(lower)) {
    city = 'Grand-Bassam';
  } else if (/assinie/i.test(lower)) {
    city = 'Assinie';
  } else if (/yamoussoukro/i.test(lower)) {
    city = 'Yamoussoukro';
  } else if (/bouaké|bouake/i.test(lower)) {
    city = 'Bouaké';
  } else if (/san pedro/i.test(lower)) {
    city = 'San Pedro';
  }

  // 5. Condition detection
  const isNew = /\b(?:neuf|neuve|scellé|scelle|carton|jamais utilisé)\b/i.test(lower);
  const condition: 'neuf' | 'occasion' = isNew ? 'neuf' : 'occasion';

  // 6. Decision: Commercial listing vs social post
  const isCommercial = Boolean(price || category || /à vendre|disponible|prix|contact|stock|vente|livraison/i.test(lower));
  const isIncomplete = !price || !category;

  // 7. Clean title extraction
  let title = '';
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
  if (lines.length > 0) {
    const candidate = lines[0]
      .replace(/^[#\-*•> \t]+/, '')
      .replace(/#\w+/g, '')
      .replace(/\+?225[0-9\s.-]+/g, '')
      .trim();
    if (candidate.length >= 6 && candidate.length <= 75) {
      title = candidate;
    }
  }

  if (!title) {
    if (subcategory && price) {
      title = `${subcategory} disponible - ${city}`;
    } else if (category) {
      title = `Offre ${category} - ${city}`;
    } else {
      title = text.slice(0, 60).trim() || 'Publication commerciale';
    }
  }

  return {
    decision: isCommercial ? 'listing' : 'social_post',
    title,
    description: text.trim(),
    price,
    category,
    subcategory,
    city,
    contactPhone,
    condition,
    isIncomplete,
  };
}

// ---------------------------------------------------------------------------
// Intelligent Music & Video Filter
// Règle : "les publications avec les musiques et vidéos n'envoie pas.. soit intelligente."
// ---------------------------------------------------------------------------
export function isMediaVideoOrMusic(post: {
  id?: string;
  message?: string;
  status_type?: string;
  attachments?: {
    data?: Array<{
      media_type?: string;
      type?: string;
      title?: string;
      description?: string;
      unshimmed_url?: string;
    }>;
  };
}): { isVideoOrMusic: boolean; reason?: string } {
  // 1. Status type inspection (Graph API)
  const statusType = String(post.status_type || '').toLowerCase();
  if (statusType.includes('video') || statusType.includes('live')) {
    return { isVideoOrMusic: true, reason: `Format vidéo Facebook (${statusType})` };
  }

  // 2. Attachments inspection (Graph API)
  const attList = post.attachments?.data || [];
  for (const att of attList) {
    const mediaType = String(att.media_type || '').toLowerCase();
    const type = String(att.type || '').toLowerCase();
    const url = String(att.unshimmed_url || '').toLowerCase();

    if (mediaType.includes('video') || type.includes('video')) {
      return { isVideoOrMusic: true, reason: 'Pièce jointe vidéo détectée' };
    }
    if (
      mediaType.includes('music') ||
      mediaType.includes('audio') ||
      type.includes('music') ||
      type.includes('audio') ||
      type.includes('song')
    ) {
      return { isVideoOrMusic: true, reason: 'Pièce jointe audio ou musicale détectée' };
    }
    if (
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('tiktok.com') ||
      url.includes('spotify.com') ||
      url.includes('deezer.com') ||
      url.includes('audiomack.com') ||
      url.includes('soundcloud.com') ||
      url.includes('boomplay.com') ||
      url.includes('music.apple.com') ||
      url.includes('fb.watch') ||
      url.includes('facebook.com/reel')
    ) {
      return { isVideoOrMusic: true, reason: 'Lien vidéo ou streaming musical détecté' };
    }
  }

  // 3. Message text analysis (intelligent detection of videos & music)
  const text = (post.message || '').toLowerCase();
  if (!text) return { isVideoOrMusic: false };

  // Video or streaming link in text
  if (
    /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|spotify\.com|deezer\.com|audiomack\.com|soundcloud\.com|boomplay\.com|music\.apple\.com|fb\.watch|facebook\.com\/reel)/i.test(
      text
    )
  ) {
    return { isVideoOrMusic: true, reason: 'Lien vidéo ou musique présent dans la publication' };
  }

  // Music keywords & phrases
  const musicPatterns = [
    /\b(?:nouveau\s+single|nouvel\s+album|nouveau\s+morceau|nouvelle\s+chanson|clip\s+officiel|nouveau\s+clip)\b/i,
    /\b(?:morceau\s+disponible|single\s+disponible|album\s+disponible|son\s+disponible|titre\s+disponible)\b/i,
    /\b(?:sur\s+toutes\s+les\s+plateformes|disponible\s+en\s+streaming|streamer\s+le\s+morceau|lien\s+d'écoute)\b/i,
    /\b(?:audiomack|spotify|deezer|boomplay|apple\s+music|soundcloud)\b/i,
    /\b(?:prod\s+by|beatmaker|freestyle\s+vidéo|freestyle\s+officiel|feat\.|featuring)\b/i,
    /\b(?:chanteur|chanteuse|artiste\s+musicien|rap\s+ivoire|afrobeats?|coupé\s*décalé)\b/i,
  ];

  for (const pat of musicPatterns) {
    if (pat.test(text)) {
      return { isVideoOrMusic: true, reason: 'Contenu musical identifié (single, album, clip ou streaming)' };
    }
  }

  // Video keywords & phrases
  const videoPatterns = [
    /\b(?:regardez\s+la\s+vidéo|regarder\s+la\s+vidéo|voir\s+la\s+vidéo|visionnez\s+la\s+vidéo)\b/i,
    /\b(?:vidéo\s+officielle|video\s+officielle|clip\s+vidéo|court-métrage)\b/i,
    /\b(?:reels?|tiktok|chaine\s+youtube|chaîne\s+youtube|abonne-toi\s+à\s+la\s+chaîne)\b/i,
    /\b(?:en\s+direct\s+live|facebook\s+live|live\s+facebook|direct\s+vidéo)\b/i,
  ];

  for (const pat of videoPatterns) {
    if (pat.test(text)) {
      return { isVideoOrMusic: true, reason: 'Contenu vidéo identifié (clip, reel, live ou vidéo Youtube/Facebook)' };
    }
  }

  return { isVideoOrMusic: false };
}

// ---------------------------------------------------------------------------
// Facebook Graph API Client & Sync Engine
// ---------------------------------------------------------------------------
export async function syncFacebookPagePosts(options?: {
  trigger?: 'manual' | 'hourly_cron' | 'test';
  requestedBy?: string;
  pageIdInput?: string;
  pageTokenInput?: string;
}): Promise<{
  success: boolean;
  imported: number;
  importedListings: number;
  importedPosts: number;
  ignored: number;
  drafts: number;
  errors?: number;
  hasMore?: boolean;
  error?: string;
  items?: ImportedFacebookItem[];
}> {
  const trigger = options?.trigger || 'manual';
  const config = await getFacebookConfigAsync();
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    const errMsg = 'Supabase admin non configuré sur le serveur.';
    appendSyncLog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      trigger,
      status: 'error',
      importedCount: 0,
      importedListings: 0,
      importedPosts: 0,
      ignoredCount: 0,
      draftCount: 0,
      errorMessage: errMsg,
      details: 'Erreur configuration base de données',
    });
    return { success: false, imported: 0, importedListings: 0, importedPosts: 0, ignored: 0, drafts: 0, error: errMsg };
  }

  // Resolve admin user ID (Marc Arnaud)
  let adminUserId = config.adminUserId;
  if (!adminUserId) {
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const foundAdmin = usersData?.users?.find(
      (u) =>
        u.email === 'marcarnaudkonan2@gmail.com' ||
        u.phone?.includes('2250565242349')
    );
    adminUserId = foundAdmin?.id || usersData?.users?.[0]?.id || 'd2882463-6bcf-414a-8844-6c06279e50e0';
  }

  // 1. Exact same credentials as test connection: Database config first, env vars as fallback only if nothing is registered
  const pageId = (options?.pageIdInput || config.pageId || '').trim();
  const pageToken = (options?.pageTokenInput || config.pageToken || '').trim();
  const pageName = config.pageName?.trim() || 'Afrique Business Officiel';

  if (!pageId || !pageToken) {
    const msg = 'Identifiant de Page (PAGE_ID) ou Jeton d’accès (PAGE_TOKEN) manquant. Veuillez enregistrer la configuration dans l’Espace Admin.';
    
    addAdminNotification({
      title: 'Configuration Facebook requise',
      message: 'Veuillez saisir votre Page ID et votre Jeton d’accès Page Facebook pour activer la synchronisation automatique.',
      type: 'WARNING',
    });

    appendSyncLog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      trigger,
      status: 'warning',
      importedCount: 0,
      importedListings: 0,
      importedPosts: 0,
      ignoredCount: 0,
      draftCount: 0,
      errorMessage: msg,
      details: 'Clés Facebook non configurées dans la base de données',
    });

    return {
      success: false,
      imported: 0,
      importedListings: 0,
      importedPosts: 0,
      ignored: 0,
      drafts: 0,
      error: msg,
    };
  }

  // 2. Query official Facebook Graph API v26.0 with limit=5 & pagination cursor
  const cursor = config.paginationCursor || null;
  let graphUrl = `https://graph.facebook.com/v26.0/${encodeURIComponent(pageId)}/posts?fields=id,message,full_picture,created_time,permalink_url,status_type,attachments{media_type,type,title,description,unshimmed_url}&limit=5`;
  if (cursor) {
    graphUrl += `&after=${encodeURIComponent(cursor)}`;
  }

  let fbPosts: Array<{
    id: string;
    message?: string;
    full_picture?: string;
    created_time: string;
    permalink_url?: string;
    status_type?: string;
    attachments?: {
      data?: Array<{
        media_type?: string;
        type?: string;
        title?: string;
        description?: string;
        unshimmed_url?: string;
      }>;
    };
  }> = [];

  let nextCursor: string | null = null;

  try {
    const res = await fetch(graphUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pageToken}`,
        'Accept': 'application/json',
      },
    });

    const resJson = await res.json();

    if (!res.ok || resJson.error) {
      const fbErr = resJson.error || {};
      const code = fbErr.code ?? 'inconnu';
      const subcode = fbErr.error_subcode ? ` / Sous-code ${fbErr.error_subcode}` : '';
      const errType = fbErr.type ? ` (${fbErr.type})` : '';
      const rawMessage = fbErr.message || 'Échec de la requête Facebook Graph API';
      
      // Strict token scrubbing: NEVER display the token in error messages, logs, or UI
      const cleanMessage = scrubToken(rawMessage, pageToken);
      const exactFacebookError = `Facebook Graph API [Code ${code}${subcode}${errType}] : ${cleanMessage}`;

      if (code === 190) {
        addAdminNotification({
          title: 'Alerte : Jeton Facebook expiré (#190)',
          message: exactFacebookError,
          type: 'ERROR',
        });
      } else if (code === 4 || code === 17) {
        addAdminNotification({
          title: 'Limite d’API Facebook atteinte',
          message: exactFacebookError,
          type: 'WARNING',
        });
      } else if (code === 100 || code === 803) {
        addAdminNotification({
          title: 'Page Facebook introuvable',
          message: exactFacebookError,
          type: 'ERROR',
        });
      }

      // Exact code and message in the journal, with token NEVER shown
      appendSyncLog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        trigger,
        status: 'error',
        importedCount: 0,
        importedListings: 0,
        importedPosts: 0,
        ignoredCount: 0,
        draftCount: 0,
        errorCount: 1,
        errorMessage: exactFacebookError,
        details: `Graph API status HTTP ${res.status} [Code ${code}${subcode}] : ${cleanMessage}`,
      });

      return {
        success: false,
        imported: 0,
        importedListings: 0,
        importedPosts: 0,
        ignored: 0,
        drafts: 0,
        errors: 1,
        error: exactFacebookError,
      };
    }

    // Save pagination cursor for the next batch
    nextCursor = (resJson.paging?.next && resJson.paging?.cursors?.after) ? resJson.paging.cursors.after : null;
    if ((!resJson.data || resJson.data.length === 0) && cursor) {
      // Loop finished, reset cursor for next sync cycle
      nextCursor = null;
    }

    await saveFacebookConfig({ paginationCursor: nextCursor });

    // If new inputs were provided and the call succeeded, persist them
    if ((options?.pageIdInput && options.pageIdInput !== config.pageId) || (options?.pageTokenInput && options.pageTokenInput !== config.pageToken)) {
      await saveFacebookConfig({ pageId, pageToken, pageName, paginationCursor: nextCursor });
    }

    fbPosts = Array.isArray(resJson.data) ? resJson.data : [];
  } catch (netErr: any) {
    const cleanNetMsg = scrubToken(netErr.message || 'Erreur réseau', pageToken);
    const netMsg = `Impossible de contacter l'API Facebook Graph : ${cleanNetMsg}`;
    appendSyncLog({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      trigger,
      status: 'error',
      importedCount: 0,
      importedListings: 0,
      importedPosts: 0,
      ignoredCount: 0,
      draftCount: 0,
      errorCount: 1,
      errorMessage: netMsg,
      details: scrubToken(netErr.stack || '', pageToken),
    });
    return {
      success: false,
      imported: 0,
      importedListings: 0,
      importedPosts: 0,
      ignored: 0,
      drafts: 0,
      errors: 1,
      error: netMsg,
    };
  }

  // 3. Process Facebook Posts with Strict Deduplication & Intelligent Filtering
  // Règle 1 : Ne JAMAIS supprimer les anciennes publications existantes (préservation absolue).
  // Règle 2 : Ne JAMAIS réimporter les publications déjà présentes dans l'application.
  // Règle 3 : Ne JAMAIS envoyer les publications contenant de la musique ou des vidéos.
  const importedList = getImportedItems();
  const importedSet = new Set(importedList.map((i) => i.facebookPostId));

  // Sync existing imported IDs from Supabase database (listings & posts) to ensure ZERO duplicates
  try {
    const { data: dbListings } = await supabaseAdmin
      .from('listings')
      .select('description')
      .ilike('description', '%[FB_POST_ID:%')
      .limit(1000);

    if (dbListings) {
      for (const item of dbListings) {
        const match = item.description?.match(/\[FB_POST_ID:([a-zA-Z0-9_]+)\]/);
        if (match && match[1]) {
          importedSet.add(match[1]);
        }
      }
    }

    const { data: dbPosts } = await supabaseAdmin
      .from('posts')
      .select('content')
      .ilike('content', '%[FB_POST_ID:%')
      .limit(1000);

    if (dbPosts) {
      for (const item of dbPosts) {
        const match = item.content?.match(/\[FB_POST_ID:([a-zA-Z0-9_]+)\]/);
        if (match && match[1]) {
          importedSet.add(match[1]);
        }
      }
    }
  } catch (err) {
    console.warn('[Facebook Sync] Avertissement vérification doublons base de données:', err);
  }

  let importedListingsCount = 0;
  let importedPostsCount = 0;
  let ignoredCount = 0;
  let draftCount = 0;
  let errorCount = 0;
  const newlyImportedItems: ImportedFacebookItem[] = [];

  for (const post of fbPosts) {
    if (!post.id) continue;

    // ÉTAPE 1 : Déduplication stricte en mémoire
    if (importedSet.has(post.id)) {
      console.log(`[Facebook Sync] Publication ${post.id} déjà présente dans l'application, ignorée.`);
      ignoredCount++;
      continue;
    }

    // ÉTAPE 2 : Déduplication dynamique directe dans la base de données
    try {
      const { count: existingListingCount } = await supabaseAdmin
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .ilike('description', `%[FB_POST_ID:${post.id}]%`);

      if (existingListingCount && existingListingCount > 0) {
        console.log(`[Facebook Sync] Annonce ${post.id} déjà existante dans Supabase, ignorée.`);
        importedSet.add(post.id);
        ignoredCount++;
        continue;
      }

      const { count: existingPostCount } = await supabaseAdmin
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .ilike('content', `%[FB_POST_ID:${post.id}]%`);

      if (existingPostCount && existingPostCount > 0) {
        console.log(`[Facebook Sync] Post social ${post.id} déjà existant dans Supabase, ignoré.`);
        importedSet.add(post.id);
        ignoredCount++;
        continue;
      }
    } catch (checkErr) {
      console.warn('[Facebook Sync] Vérification doublon en base:', checkErr);
    }

    const message = (post.message || '').trim();
    const hasPhoto = Boolean(post.full_picture);
    const permalink = post.permalink_url || `https://www.facebook.com/${post.id}`;

    // ÉTAPE 3 : Filtrage intelligent Musique & Vidéos
    // "les publications avec les musiques et vidéos n'envoie pas.. soit intelligente."
    const mediaCheck = isMediaVideoOrMusic(post);
    if (mediaCheck.isVideoOrMusic) {
      console.log(`[Facebook Sync] Publication vidéo/musique exclue (${post.id}) : ${mediaCheck.reason}`);
      ignoredCount++;
      importedSet.add(post.id);
      saveImportedItem({
        facebookPostId: post.id,
        targetType: 'social_post',
        targetId: `skipped_media_${post.id}`,
        status: 'draft',
        title: `Ignoré (${mediaCheck.reason})`,
        createdTime: post.created_time,
        permalinkUrl: permalink,
        pageName,
        importedAt: new Date().toISOString(),
        rawSnippet: message.slice(0, 100),
      });
      continue;
    }

    // ÉTAPE 4 : Ignorer les publications totalement vides (sans texte et sans photo)
    if (!message && !hasPhoto) {
      ignoredCount++;
      importedSet.add(post.id);
      continue;
    }

    try {
      // AI Analysis with Gemini (with 20s timeout)
      const analysis = await analyzePostWithGemini(message || 'Article disponible sur notre page.');

      if (analysis.decision === 'listing') {
        // 1. Create a Listing in Supabase
        const isDraft = Boolean(analysis.isIncomplete || !analysis.price || !analysis.category);
        // Status in DB: paused for drafts, active otherwise
        const dbStatus = isDraft ? 'paused' : 'active';

        const formattedDescription = `${analysis.description || message}

---
📢 Publié par : ${pageName}
🔗 Voir sur Facebook : ${permalink}
[FB_POST_ID:${post.id}]`;

        const images = post.full_picture ? [post.full_picture] : [];

        const { data: createdListing, error: listErr } = await supabaseAdmin
          .from('listings')
          .insert({
            user_id: adminUserId,
            title: (analysis.title || message.slice(0, 60)).trim(),
            category: (analysis.category as any) || 'autres',
            subcategory: analysis.subcategory || null,
            description: formattedDescription,
            price: analysis.price || 0,
            currency: 'XOF',
            condition: analysis.condition || 'occasion',
            country: 'CI',
            city: analysis.city || 'Abidjan',
            images,
            contact_phone: analysis.contactPhone || null,
            whatsapp_phone: analysis.contactPhone || null,
            status: dbStatus,
          })
          .select('id')
          .single();

        if (listErr || !createdListing) {
          throw new Error(listErr?.message || 'Erreur lors de la création de l’annonce');
        }

        if (isDraft) {
          draftCount++;
        } else {
          importedListingsCount++;
        }

        const itemRecord: ImportedFacebookItem = {
          facebookPostId: post.id,
          targetType: 'listing',
          targetId: createdListing.id,
          status: isDraft ? 'draft' : 'active',
          title: analysis.title || message.slice(0, 60),
          price: analysis.price || null,
          category: analysis.category || null,
          createdTime: post.created_time,
          permalinkUrl: permalink,
          pageName,
          importedAt: new Date().toISOString(),
          rawSnippet: message.slice(0, 100),
        };

        saveImportedItem(itemRecord);
        newlyImportedItems.push(itemRecord);
        importedSet.add(post.id);
      } else {
        // 2. Create a Social Post in Supabase Community Feed
        const formattedContent = `${message}

---
📢 Publié par : ${pageName}
🔗 Voir sur Facebook : ${permalink}
[FB_POST_ID:${post.id}]`;

        const images = post.full_picture ? [post.full_picture] : [];

        const { data: createdPost, error: postErr } = await supabaseAdmin
          .from('posts')
          .insert({
            user_id: adminUserId,
            content: formattedContent,
            images,
          })
          .select('id')
          .single();

        if (postErr || !createdPost) {
          throw new Error(postErr?.message || 'Erreur lors de la création du post social');
        }

        importedPostsCount++;

        const itemRecord: ImportedFacebookItem = {
          facebookPostId: post.id,
          targetType: 'social_post',
          targetId: createdPost.id,
          status: 'published',
          title: message.slice(0, 60) || 'Publication sociale Facebook',
          createdTime: post.created_time,
          permalinkUrl: permalink,
          pageName,
          importedAt: new Date().toISOString(),
          rawSnippet: message.slice(0, 100),
        };

        saveImportedItem(itemRecord);
        newlyImportedItems.push(itemRecord);
        importedSet.add(post.id);
      }
    } catch (postErr: any) {
      errorCount++;
      const itemErrMsg = `Échec sur le post Facebook (${post.id}) : ${postErr.message || 'Erreur de traitement'}`;
      console.warn(`[Facebook Sync] ${itemErrMsg}`);
      appendSyncLog({
        id: `log_post_err_${Date.now()}_${post.id}`,
        timestamp: new Date().toISOString(),
        trigger,
        status: 'warning',
        importedCount: 0,
        importedListings: 0,
        importedPosts: 0,
        ignoredCount: 0,
        draftCount: 0,
        errorCount: 1,
        errorMessage: itemErrMsg,
        details: `ID: ${post.id} - ${message.slice(0, 80)}`,
      });
      // Do not stop the sync, continue to next publication
    }
  }

  // Update lastSyncAt in config
  await saveFacebookConfig({ lastSyncAt: new Date().toISOString() });

  const totalImported = importedListingsCount + importedPostsCount;

  appendSyncLog({
    id: `log_${Date.now()}`,
    timestamp: new Date().toISOString(),
    trigger,
    status: errorCount > 0 && totalImported === 0 ? 'error' : errorCount > 0 ? 'warning' : 'success',
    importedCount: totalImported,
    importedListings: importedListingsCount,
    importedPosts: importedPostsCount,
    ignoredCount,
    draftCount,
    errorCount,
    errorMessage: errorCount > 0 ? `${errorCount} publication(s) en erreur lors du traitement.` : null,
    details: `Synchronisation terminée (lot de 5 max). ${importedListingsCount} annonces (${draftCount} brouillons), ${importedPostsCount} posts sociaux, ${ignoredCount} ignorées, ${errorCount} en erreur.${nextCursor ? ' D’autres publications restent à importer (curseur mémorisé).' : ''}`,
  });

  return {
    success: true,
    imported: totalImported,
    importedListings: importedListingsCount,
    importedPosts: importedPostsCount,
    ignored: ignoredCount,
    drafts: draftCount,
    errors: errorCount,
    hasMore: Boolean(nextCursor),
    items: newlyImportedItems,
  };
}

// ---------------------------------------------------------------------------
// Test Facebook Connection endpoint (lightweight check of Page Name & Token)
// ---------------------------------------------------------------------------
export async function testFacebookConnection(pageIdInput?: string, pageTokenInput?: string): Promise<{
  success: boolean;
  pageName?: string;
  pageId?: string;
  error?: string;
}> {
  const config = await getFacebookConfigAsync();
  const pageId = (pageIdInput || config.pageId || '').trim();
  const pageToken = (pageTokenInput || config.pageToken || '').trim();

  if (!pageId || !pageToken) {
    return {
      success: false,
      error: 'Page ID et Jeton de page requis pour le test.',
    };
  }

  try {
    const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(pageId)}?fields=id,name,link`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pageToken}`,
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      const fbErr = data.error || {};
      const code = fbErr.code ?? 'inconnu';
      const subcode = fbErr.error_subcode ? ` / Sous-code ${fbErr.error_subcode}` : '';
      const errType = fbErr.type ? ` (${fbErr.type})` : '';
      const rawMsg = fbErr.message || 'Erreur lors du test de connexion';
      const cleanMsg = scrubToken(rawMsg, pageToken);
      const exactError = `Facebook Graph API [Code ${code}${subcode}${errType}] : ${cleanMsg}`;

      return { success: false, error: exactError };
    }

    // Persist verified credentials to database and file
    if ((pageIdInput && pageIdInput !== config.pageId) || (pageTokenInput && pageTokenInput !== config.pageToken)) {
      await saveFacebookConfig({
        pageId,
        pageToken,
        pageName: data.name || config.pageName,
      });
    }

    return {
      success: true,
      pageName: data.name,
      pageId: data.id,
    };
  } catch (err: any) {
    const cleanErr = scrubToken(err.message || 'Erreur de connexion réseau vers Facebook Graph API', pageToken);
    return {
      success: false,
      error: cleanErr,
    };
  }
}

// ---------------------------------------------------------------------------
// Hourly Background Scheduled Sync
// ---------------------------------------------------------------------------
let syncIntervalHandle: NodeJS.Timeout | null = null;

export function startFacebookHourlyScheduler(): void {
  if (syncIntervalHandle) return;

  console.log('[Facebook Sync] Initializing hourly scheduled task (60 min interval)...');

  // Run automatically every 60 minutes
  syncIntervalHandle = setInterval(async () => {
    const config = await getFacebookConfigAsync();
    if (!config.autoSyncEnabled || !config.pageId || !config.pageToken) {
      return;
    }
    console.log('[Facebook Sync] Running automatic hourly synchronization...');
    try {
      const res = await syncFacebookPagePosts({ trigger: 'hourly_cron' });
      console.log(`[Facebook Sync Scheduled] Result: ${res.imported} imported, ${res.drafts} drafts, ${res.ignored} ignored.`);
    } catch (err) {
      console.error('[Facebook Sync Scheduled] Error during hourly run:', err);
    }
  }, 60 * 60 * 1000);
}
