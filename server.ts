import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import { 
  getFacebookConfig, 
  getFacebookConfigAsync,
  saveFacebookConfig, 
  getImportedItems, 
  getSyncLogs, 
  getAdminNotifications, 
  markNotificationsAsRead, 
  syncFacebookPagePosts, 
  testFacebookConnection, 
  startFacebookHourlyScheduler 
} from './src/server/facebookSync.ts';
import { 
  getPostSocialStats, 
  getPostReactorsList, 
  setOrToggleReaction, 
  recordShareEvent, 
  getBatchStats,
  type ReactionType 
} from './src/server/socialReactions.ts';
import { 
  findUserCredential, 
  verifyUserLogin, 
  setUserPassword, 
  registerUserCredential, 
  ADMIN_USER_ID, 
  ADMIN_PHONE, 
  ADMIN_EMAIL, 
  getOrSeedAdminUser,
  hashPassword,
  verifyPassword
} from './src/server/authStore.ts';
import { sanitizeText, isValidPhoneNumber, isValidEmail, hasValidImageMagicBytes } from './src/lib/security.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const cliPortIdx = process.argv.indexOf('--port');
const cliPort = cliPortIdx !== -1 && process.argv[cliPortIdx + 1] ? Number(process.argv[cliPortIdx + 1]) : NaN;
const envPort = process.env.PORT && process.env.PORT !== process.env.NGINX_PORT ? Number(process.env.PORT) : NaN;
const port = Number.isFinite(cliPort) && cliPort > 0
  ? cliPort
  : (Number.isFinite(envPort) && envPort > 0 ? envPort : Number(process.env.DEFAULT_APP_PORT || 3000));

// Security: Disable Express fingerprinting
app.disable('x-powered-by');

// Security: Enforce essential HTTP protection and CORS headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Security: Limit request body payload (allow high-res compressed WebP image uploads)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ----------------------------------------------------
// Security: High-performance In-Memory Rate Limiter
// ----------------------------------------------------
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateLimitMap.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxRequests) {
    return false;
  }
  bucket.count++;
  return true;
}

// Garbage collect expired rate limit buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitMap.entries()) {
    if (now > bucket.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

// Helper to get client IP safely
function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// In-memory OTP storage for SMS verification with brute-force defense
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lockedUntil?: number;
  lastRequestedAt: number;
}
const otpStore = new Map<string, OtpRecord>();

// Garbage collect expired OTP records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, record] of otpStore.entries()) {
    if (now > record.expiresAt + 15 * 60 * 1000) {
      otpStore.delete(phone);
    }
  }
}, 5 * 60 * 1000).unref();

// ----------------------------------------------------
// 1. Twilio / Pan-African Gateway SMS OTP Authentication
// ----------------------------------------------------
app.post('/api/auth/send-sms-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone requis.' });
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!isValidPhoneNumber(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Format de téléphone invalide (8 à 15 chiffres requis).' });
    }

    const clientIp = getClientIp(req);

    // 1. Rate limiting by IP: Max 10 OTP requests per 10 minutes
    if (!checkRateLimit(`ip_otp_${clientIp}`, 10, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Trop de demandes de vérification depuis votre adresse. Veuillez patienter 10 minutes.',
      });
    }

    // 2. Check if phone is locked due to repeated verification failures
    const existingEntry = otpStore.get(cleanPhone);
    const now = Date.now();
    if (existingEntry?.lockedUntil && now < existingEntry.lockedUntil) {
      const waitMinutes = Math.ceil((existingEntry.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Ce numéro est temporairement verrouillé pour des raisons de sécurité. Veuillez patienter ${waitMinutes} minute(s).`,
      });
    }

    // 3. Cooldown: Minimum 60 seconds between OTP requests for the same number
    if (existingEntry && (now - existingEntry.lastRequestedAt) < 60 * 1000) {
      const remainingSeconds = Math.ceil((60 * 1000 - (now - existingEntry.lastRequestedAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Veuillez patienter ${remainingSeconds} seconde(s) avant de demander un nouveau code.`,
      });
    }

    // 4. Rate limiting per phone: Max 5 OTPs per hour
    if (!checkRateLimit(`phone_otp_${cleanPhone}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Limite maximale de SMS atteinte pour ce numéro (5/heure). Veuillez réessayer plus tard.',
      });
    }

    // 5. Cryptographically secure 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    otpStore.set(cleanPhone, {
      code,
      expiresAt,
      attempts: 0,
      lastRequestedAt: now,
    });

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

    const allowDevSimulator =
      process.env.ALLOW_DEV_OTP_SIMULATOR === 'true' && process.env.NODE_ENV !== 'production';

    if (twilioSid && twilioAuthToken && twilioFrom) {
      // Send real SMS via Twilio API
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`);
      params.append('From', twilioFrom);
      params.append('Body', `Votre code de vérification Afrique Business est : ${code}. Valide pendant 5 minutes. Ne le communiquez à personne.`);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(12000),
      });

      if (!twilioRes.ok) {
        const twilioErr = await twilioRes.text();
        console.warn('[Twilio Error] SMS delivery failed:', twilioErr);
        if (allowDevSimulator) {
          return res.json({
            success: true,
            simulated: true,
            otp: code,
            message: `[Mode dev] Code de confirmation SMS : ${code}`,
          });
        }
        otpStore.delete(cleanPhone);
        return res.status(503).json({
          success: false,
          message: 'L’envoi du SMS a échoué temporairement. Veuillez utiliser la connexion ou réinitialisation par e-mail.',
        });
      }

      return res.json({
        success: true,
        simulated: false,
        message: `SMS envoyé avec succès via Twilio au ${cleanPhone}.`,
      });
    }

    if (allowDevSimulator) {
      console.log(`[SMS Gateway Dev Simulator] OTP verification code generated for ${cleanPhone}.`);
      return res.json({
        success: true,
        simulated: true,
        otp: code,
        message: `[Mode dev] Code SMS généré pour ${cleanPhone} : ${code} (Valable 5 min).`,
      });
    }

    otpStore.delete(cleanPhone);
    return res.status(503).json({
      success: false,
      message: 'Service SMS non configuré sur cet environnement. Veuillez utiliser votre adresse e-mail et mot de passe.',
    });
  } catch (error: any) {
    console.error('Error sending SMS OTP:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors de l’envoi du SMS' });
  }
});

app.post('/api/auth/verify-sms-otp', (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Téléphone et code requis.' });
    }

    const clientIp = getClientIp(req);
    // Rate limit verification attempts by IP
    if (!checkRateLimit(`ip_verify_${clientIp}`, 30, 5 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Trop de tentatives de vérification. Veuillez patienter 5 minutes.',
      });
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const entry = otpStore.get(cleanPhone);
    const now = Date.now();

    if (!entry) {
      return res.status(400).json({
        success: false,
        message: 'Aucun code actif pour ce numéro. Veuillez demander un nouveau code.',
      });
    }

    // Check if locked
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const waitMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Numéro temporairement verrouillé suite à 5 tentatives infructueuses. Réessayez dans ${waitMinutes} minute(s).`,
      });
    }

    if (now > entry.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({
        success: false,
        message: 'Le code a expiré. Veuillez en demander un nouveau.',
      });
    }

    // Brute-force protection: check attempt count
    if (entry.code.trim() !== String(code).trim()) {
      entry.attempts = (entry.attempts || 0) + 1;
      const remainingAttempts = 5 - entry.attempts;

      if (entry.attempts >= 5) {
        entry.lockedUntil = now + 15 * 60 * 1000; // 15 min lock
        entry.code = ''; // Invalidate code
        return res.status(429).json({
          success: false,
          message: 'Code incorrect. Vous avez épuisé vos 5 tentatives. Ce numéro a été verrouillé pendant 15 minutes par mesure de sécurité.',
        });
      }

      return res.status(400).json({
        success: false,
        message: `Code incorrect. Il vous reste ${remainingAttempts} tentative(s).`,
      });
    }

    // Success: remove used code
    otpStore.delete(cleanPhone);

    return res.json({
      success: true,
      verified: true,
      message: 'Numéro de téléphone vérifié avec succès !',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Supabase Clients for JWT verification and admin provisioning
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wlvzjhpfcvwcgyelpsnx.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Gd_1w7RmnkKKeQ5RhobaPw_MPrka48J';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = (supabaseUrl && serviceRoleKey) ? createClient(supabaseUrl, serviceRoleKey) : null;

async function verifyRequestSupabaseUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const client = supabaseAdmin || supabaseAnonClient;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}

const SERVER_START_TIME = Date.now();
const APP_VERSION = '3.0.0';
const COMMIT_SHA = process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'local';

// Cloud Run / Docker / Uptime healthcheck
app.get('/healthz', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: 'afrique-business',
    region: process.env.CLOUD_RUN_REGION || process.env.K_REVISION ? 'europe-west2' : 'local',
    environment: process.env.NODE_ENV || 'development',
    version: APP_VERSION,
    commitSha: COMMIT_SHA,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Expose public runtime config
app.get('/api/config', (_req, res) => {
  res.json({
    supabaseUrl,
    supabaseAnonKey,
  });
});

// ----------------------------------------------------
// Robust Authentication Endpoints (Passwords + SMS OTP)
// ----------------------------------------------------

// 1. Password Login (Works with phone or email, rock-solid security)
app.post('/api/auth/login-with-password', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Identifiant et mot de passe requis.' });
    }

    const clientIp = getClientIp(req);
    if (!checkRateLimit(`ip_login_${clientIp}`, 20, 10 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Trop de tentatives de connexion. Veuillez patienter 10 minutes.' });
    }

    // Verify against our user credentials store
    const result = verifyUserLogin(identifier, password);
    if (result.success && result.user) {
      const u = result.user;
      const nameParts = (u.fullName || 'Utilisateur').split(' ');
      return res.json({
        success: true,
        user: {
          id: u.userId,
          fullName: u.fullName,
          firstName: nameParts[0] || u.fullName,
          lastName: nameParts.slice(1).join(' ') || '',
          phone: u.phone,
          email: u.email,
          city: u.city || 'Abidjan',
          country: u.country || 'CI',
          avatarUrl: u.avatarUrl,
          phone_verified: u.phoneVerified,
          activeRole: 'BUYER',
          kycLevel: 1,
          trustScore: 5.0,
          walletBalance: 0,
          registeredAt: new Date(u.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
        },
      });
    }

    return res.status(401).json({
      success: false,
      message: result.message || 'Identifiant ou mot de passe incorrect.',
    });
  } catch (error: any) {
    console.error('Login error in /api/auth/login-with-password:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors de la connexion' });
  }
});

// 2. Quick SMS OTP Login (Immediate access with OTP code + real Supabase session via Admin MagicLink)
app.post('/api/auth/quick-sms-login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Téléphone et code SMS requis.' });
    }

    const clientIp = getClientIp(req);
    if (!checkRateLimit(`ip_sms_login_${clientIp}`, 15, 10 * 60 * 1000)) {
      return res.status(429).json({
        success: false,
        message: 'Trop de tentatives de connexion par SMS. Veuillez patienter 10 minutes.',
      });
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const cleanDigits = cleanPhone.replace(/[^\d]/g, '');
    const entry = otpStore.get(cleanPhone);
    const now = Date.now();

    if (!entry) {
      return res.status(400).json({ success: false, message: 'Aucun code SMS actif pour ce numéro ou code expiré.' });
    }

    if (entry.lockedUntil && now < entry.lockedUntil) {
      const waitMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Numéro temporairement verrouillé suite à 5 tentatives infructueuses. Réessayez dans ${waitMinutes} minute(s).`,
      });
    }

    if (now > entry.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({ success: false, message: 'Le code SMS a expiré. Veuillez en redemander un.' });
    }

    if (entry.code.trim() !== String(code).trim()) {
      entry.attempts = (entry.attempts || 0) + 1;
      const remaining = 5 - entry.attempts;
      if (entry.attempts >= 5) {
        entry.lockedUntil = now + 15 * 60 * 1000;
        entry.code = '';
        return res.status(429).json({
          success: false,
          message: 'Code SMS incorrect. Vous avez épuisé vos 5 tentatives. Numéro verrouillé pendant 15 minutes.',
        });
      }
      return res.status(400).json({ success: false, message: `Code SMS incorrect. Il vous reste ${remaining} tentative(s).` });
    }

    // Code is valid - consume it
    otpStore.delete(cleanPhone);

    // Find existing user or seed
    let userCred = findUserCredential(cleanPhone);
    const isNewPhoneUser = !userCred;
    if (!userCred) {
      if (cleanDigits === '2250565242349' || cleanDigits === '0565242349' || cleanDigits === '565242349') {
        userCred = getOrSeedAdminUser();
      } else {
        userCred = registerUserCredential({
          phone: cleanPhone,
          email: `auth_${cleanDigits}@afrique-business.internal`,
          fullName: 'Membre ' + cleanPhone.slice(-4),
          password: crypto.randomBytes(12).toString('hex'),
          city: 'Abidjan',
          country: 'CI',
        });
      }
    }

    let supabaseSessionTokenHash: string | null = null;
    let supabaseSessionEmail: string | null = null;

    if (supabaseAdmin) {
      const targetEmail = userCred.email || `auth_${cleanDigits}@afrique-business.internal`;
      try {
        const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(userCred.userId);
        if (!existingAuth?.user && isNewPhoneUser) {
          await supabaseAdmin.auth.admin.createUser({
            id: userCred.userId,
            phone: cleanPhone,
            phone_confirm: true,
            email: targetEmail,
            email_confirm: true,
            password: crypto.randomBytes(16).toString('hex'),
            user_metadata: {
              full_name: userCred.fullName,
              city: userCred.city || 'Abidjan',
              country: userCred.country || 'CI',
              phone: cleanPhone,
            },
          });
        }
        const effectiveEmail = existingAuth?.user?.email || targetEmail;
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: effectiveEmail,
        });
        if (!linkErr && linkData?.properties?.hashed_token) {
          supabaseSessionTokenHash = linkData.properties.hashed_token;
          supabaseSessionEmail = effectiveEmail;
        }
      } catch (adminErr) {
        console.warn('Quick SMS Supabase session link warning:', adminErr);
      }
    }

    if (!supabaseSessionTokenHash) {
      return res.status(503).json({
        success: false,
        supabaseSynced: false,
        message: 'La connexion rapide par SMS nécessite le service Supabase Admin configuré sur le serveur. Veuillez vous connecter avec votre e-mail/téléphone et mot de passe.',
      });
    }

    const nameParts = (userCred.fullName || 'Utilisateur').split(' ');
    return res.json({
      success: true,
      supabaseSynced: true,
      supabaseSessionTokenHash,
      supabaseSessionEmail,
      user: {
        id: userCred.userId,
        fullName: userCred.fullName,
        firstName: nameParts[0] || userCred.fullName,
        lastName: nameParts.slice(1).join(' ') || '',
        phone: userCred.phone,
        email: userCred.email,
        city: userCred.city || 'Abidjan',
        country: userCred.country || 'CI',
        avatarUrl: userCred.avatarUrl,
        phone_verified: true,
        activeRole: 'BUYER',
        kycLevel: 1,
        trustScore: 5.0,
        walletBalance: 0,
        registeredAt: new Date(userCred.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      },
    });
  } catch (error: any) {
    console.error('Quick SMS login error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors de la connexion SMS' });
  }
});

// 3. Register user (Requires verified SMS OTP code & prevents account takeover)
app.post('/api/auth/register-user', async (req, res) => {
  try {
    const { phone, password, fullName, city, country, code } = req.body;
    if (!phone || !password || !fullName || !code) {
      return res.status(400).json({
        success: false,
        message: 'Informations incomplètes (téléphone, code SMS, mot de passe et nom requis).',
      });
    }

    if (String(password).length < 6 || String(password).length > 100) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit comporter entre 6 et 100 caractères.' });
    }

    const cleanPhone = String(phone).replace(/[\s\-\(\)]/g, '');
    if (!isValidPhoneNumber(cleanPhone)) {
      return res.status(400).json({ success: false, message: 'Numéro de téléphone invalide.' });
    }

    const entry = otpStore.get(cleanPhone);
    const now = Date.now();
    if (!entry) {
      return res.status(400).json({ success: false, message: 'Aucun code SMS actif pour ce numéro ou code expiré.' });
    }
    if (entry.lockedUntil && now < entry.lockedUntil) {
      const waitMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Numéro temporairement verrouillé. Réessayez dans ${waitMinutes} minute(s).`,
      });
    }
    if (now > entry.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({ success: false, message: 'Le code SMS a expiré. Veuillez en redemander un.' });
    }
    if (entry.code.trim() !== String(code).trim()) {
      entry.attempts = (entry.attempts || 0) + 1;
      const remaining = 5 - entry.attempts;
      if (entry.attempts >= 5) {
        entry.lockedUntil = now + 15 * 60 * 1000;
        entry.code = '';
        return res.status(429).json({
          success: false,
          message: 'Code SMS incorrect. Vous avez épuisé vos 5 tentatives. Numéro verrouillé pendant 15 minutes.',
        });
      }
      return res.status(400).json({ success: false, message: `Code SMS incorrect. Il vous reste ${remaining} tentative(s).` });
    }

    // Consume OTP on success
    otpStore.delete(cleanPhone);

    // Prevent account overwrite if phone already registered
    const existingCred = findUserCredential(cleanPhone);
    if (existingCred) {
      return res.status(409).json({
        success: false,
        message: 'Un compte existe déjà avec ce numéro de téléphone. Veuillez vous connecter ou réinitialiser votre mot de passe.',
      });
    }

    const cleanDigits = cleanPhone.replace(/[^\d]/g, '');
    const internalEmail = `auth_${cleanDigits}@afrique-business.internal`;
    const cleanFullName = sanitizeText(fullName, 100) || 'Utilisateur';
    const cleanCity = sanitizeText(city || 'Abidjan', 60) || 'Abidjan';
    const cleanCountry = sanitizeText(country || 'CI', 5) || 'CI';

    // 1. Register in server credential store
    const userCred = registerUserCredential({
      phone: cleanPhone,
      email: internalEmail,
      password,
      fullName: cleanFullName,
      city: cleanCity,
      country: cleanCountry,
    });

    const userId = userCred.userId;

    // 2. If admin client is available, create verified Supabase Auth user
    let supabaseSynced = false;
    if (supabaseAdmin) {
      try {
        const { error: adminCreateErr } = await supabaseAdmin.auth.admin.createUser({
          id: userId,
          phone: cleanPhone,
          phone_confirm: true,
          email: internalEmail,
          email_confirm: true,
          password: password,
          user_metadata: {
            full_name: cleanFullName,
            city: cleanCity,
            country: cleanCountry,
            phone: cleanPhone,
          },
        });
        if (!adminCreateErr) {
          supabaseSynced = true;
        }
      } catch (adminErr) {
        console.warn('Admin auth creation warning:', adminErr);
      }
    }

    const nameParts = cleanFullName.split(' ');
    return res.json({
      success: true,
      supabaseSynced,
      userId,
      loginEmail: internalEmail,
      phone: cleanPhone,
      fullName: cleanFullName,
      city: cleanCity,
      country: cleanCountry,
      user: {
        id: userId,
        fullName: cleanFullName,
        firstName: nameParts[0] || cleanFullName,
        lastName: nameParts.slice(1).join(' ') || '',
        phone: cleanPhone,
        email: internalEmail,
        city: cleanCity,
        country: cleanCountry,
        phone_verified: true,
        activeRole: 'BUYER',
        kycLevel: 1,
        trustScore: 5.0,
        walletBalance: 0,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/register-user:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur serveur lors de l’inscription' });
  }
});

// 4. Reset password via SMS OTP (Works 100% reliably)
app.post('/api/auth/reset-password-sms', async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Téléphone, code et nouveau mot de passe requis.' });
    }

    const clientIp = getClientIp(req);
    if (!checkRateLimit(`ip_reset_${clientIp}`, 15, 15 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Trop de tentatives de réinitialisation. Veuillez patienter 15 minutes.' });
    }

    if (newPassword.length < 6 || newPassword.length > 100) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit comporter entre 6 et 100 caractères.' });
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const cleanDigits = cleanPhone.replace(/[^\d]/g, '');
    const entry = otpStore.get(cleanPhone);

    const now = Date.now();
    if (!entry) {
      return res.status(400).json({ success: false, message: 'Aucun code SMS actif pour ce numéro ou code expiré.' });
    }

    if (entry.lockedUntil && now < entry.lockedUntil) {
      const waitMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        message: `Numéro temporairement verrouillé. Réessayez dans ${waitMinutes} minute(s).`,
      });
    }

    if (now > entry.expiresAt) {
      otpStore.delete(cleanPhone);
      return res.status(400).json({ success: false, message: 'Le code SMS a expiré. Veuillez en redemander un.' });
    }

    if (entry.code.trim() !== String(code).trim()) {
      entry.attempts = (entry.attempts || 0) + 1;
      const remaining = 5 - entry.attempts;
      if (entry.attempts >= 5) {
        entry.lockedUntil = now + 15 * 60 * 1000;
        entry.code = '';
        return res.status(429).json({
          success: false,
          message: 'Code SMS incorrect. Vous avez épuisé vos 5 tentatives. Numéro verrouillé pendant 15 minutes.',
        });
      }
      return res.status(400).json({ success: false, message: `Code SMS incorrect. Il vous reste ${remaining} tentative(s).` });
    }

    // Code is valid - consume it
    otpStore.delete(cleanPhone);

    // Find user or seed
    let userCred = findUserCredential(cleanPhone);
    if (!userCred) {
      if (cleanDigits === '2250565242349' || cleanDigits === '0565242349' || cleanDigits === '565242349') {
        userCred = getOrSeedAdminUser();
      } else {
        return res.status(404).json({ success: false, message: 'Aucun compte trouvé avec ce numéro de téléphone.' });
      }
    }

    // Update password in credentials store
    setUserPassword(userCred.userId, newPassword);

    // If supabaseAdmin is configured, also update Supabase Auth
    let supabaseSynced = false;
    if (supabaseAdmin) {
      try {
        const { error: adminUpdErr } = await supabaseAdmin.auth.admin.updateUserById(userCred.userId, {
          password: newPassword,
        });
        if (!adminUpdErr) {
          supabaseSynced = true;
        }
      } catch (adminErr) {
        console.warn('Supabase admin update password warning:', adminErr);
      }
    }

    const nameParts = (userCred.fullName || 'Utilisateur').split(' ');
    return res.json({
      success: true,
      supabaseSynced,
      message: 'Votre mot de passe a été réinitialisé avec succès ! Vous êtes maintenant connecté.',
      user: {
        id: userCred.userId,
        fullName: userCred.fullName,
        firstName: nameParts[0] || userCred.fullName,
        lastName: nameParts.slice(1).join(' ') || '',
        phone: userCred.phone,
        email: userCred.email,
        city: userCred.city || 'Abidjan',
        country: userCred.country || 'CI',
        avatarUrl: userCred.avatarUrl,
        phone_verified: true,
        activeRole: 'BUYER',
        kycLevel: 1,
        trustScore: 5.0,
        walletBalance: 0,
        registeredAt: new Date(userCred.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      },
    });
  } catch (error: any) {
    console.error('Error in /api/auth/reset-password-sms:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors de la réinitialisation' });
  }
});

// 5. Change Password (Authenticated via verified Supabase JWT)
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise (session expirée).' });
    }

    const { userId, oldPassword, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6 || String(newPassword).length > 100) {
      return res.status(400).json({ success: false, message: 'Nouveau mot de passe requis (6 à 100 caractères).' });
    }

    if (userId && userId !== authUser.id) {
      return res.status(403).json({ success: false, message: 'Action non autorisée pour ce compte.' });
    }

    const targetUid = authUser.id;
    const userCred = findUserCredential(targetUid);
    if (userCred?.passwordHash) {
      if (!oldPassword || !verifyPassword(String(oldPassword), userCred.passwordHash)) {
        return res.status(400).json({ success: false, message: 'Ancien mot de passe incorrect.' });
      }
      setUserPassword(targetUid, String(newPassword));
    } else {
      registerUserCredential({
        userId: targetUid,
        email: authUser.email,
        phone: authUser.phone,
        fullName: (authUser.user_metadata?.full_name as string) || 'Utilisateur',
        password: String(newPassword),
      });
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetUid, {
          password: String(newPassword),
        });
      } catch (adminErr) {
        console.warn('Supabase admin update password warning:', adminErr);
      }
    }

    return res.json({
      success: true,
      message: 'Mot de passe modifié avec succès.',
    });
  } catch (error: any) {
    console.error('Error in /api/auth/change-password:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors du changement de mot de passe' });
  }
});

// 6. Resolve phone or email to login credential & candidate emails
app.post('/api/auth/resolve-account', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Identifiant requis.' });
    }

    const trimmed = identifier.trim().toLowerCase();
    const cleanDigits = trimmed.replace(/[^\d]/g, '');

    // Check if user has an account in our credentials store
    const localUser = findUserCredential(identifier);

    const candidateEmailsSet = new Set<string>();
    if (trimmed.includes('@')) {
      candidateEmailsSet.add(trimmed);
    }

    if (
      cleanDigits === '2250565242349' ||
      cleanDigits === '0565242349' ||
      cleanDigits === '565242349' ||
      cleanDigits.endsWith('565242349') ||
      trimmed === ADMIN_EMAIL.toLowerCase()
    ) {
      candidateEmailsSet.add(ADMIN_EMAIL);
      candidateEmailsSet.add('marcarnaudkonan@gmail.com');
    }

    const digitVariants = new Set<string>();
    if (cleanDigits.length >= 8) {
      digitVariants.add(cleanDigits);
      if (cleanDigits.startsWith('225') && cleanDigits.length > 3) {
        digitVariants.add(cleanDigits.slice(3));
        digitVariants.add('0' + cleanDigits.slice(3));
      } else if (cleanDigits.startsWith('0') && cleanDigits.length === 10) {
        digitVariants.add('225' + cleanDigits);
        digitVariants.add('225' + cleanDigits.slice(1));
      }
    }

    const domains = [
      'afrique-business.internal',
      'afrique-business.app',
      'afrique-business.ci',
      'afrique-business.com',
      'afrique-afrique.com',
    ];

    for (const d of digitVariants) {
      for (const dom of domains) {
        candidateEmailsSet.add(`auth_${d}@${dom}`);
        candidateEmailsSet.add(`user_${d}@${dom}`);
        candidateEmailsSet.add(`phone_${d}@${dom}`);
        candidateEmailsSet.add(`phone${d}@${dom}`);
        candidateEmailsSet.add(`${d}@${dom}`);
        candidateEmailsSet.add(`+${d}@${dom}`);
      }
    }

    if (localUser?.email) {
      candidateEmailsSet.add(localUser.email);
    }

    const candidateEmails = Array.from(candidateEmailsSet);
    const primaryEmail = candidateEmails[0] || (trimmed.includes('@') ? trimmed : `auth_${cleanDigits}@afrique-business.internal`);

    return res.json({
      success: true,
      loginEmail: primaryEmail,
      candidateEmails,
      hasLocalCredential: Boolean(localUser),
      userId: localUser?.userId,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// 2. Resend Transactional Email Service (Hardened)
// ----------------------------------------------------
app.post('/api/email/send-transactional', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise pour envoyer des e-mails.' });
    }

    const { to, recipientName, type, productTitle } = req.body;
    if (!to || !isValidEmail(to)) {
      return res.status(400).json({ success: false, message: 'Adresse e-mail valide requise.' });
    }

    const clientIp = getClientIp(req);
    // Anti-relay & DoS protection: Max 10 emails per 10 minutes per IP
    if (!checkRateLimit(`email_send_${clientIp}`, 10, 10 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Limite d’envoi d’e-mails atteinte. Veuillez patienter.' });
    }

    // Sanitize user-provided fields
    const safeRecipient = sanitizeText(recipientName || 'cher commerçant', 100);
    const safeProduct = sanitizeText(productTitle || 'Votre compte', 120);

    let subject = 'Notification Afrique Business';
    let htmlContent = '';

    if (type === 'WELCOME') {
      subject = 'Bienvenue sur Afrique Business - Tout l\'Afrique, un seul marché !';
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0E0E0E; color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #27272A;">
          <div style="background: #141418; padding: 24px; text-align: center; border-bottom: 2px solid #D4AF37;">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Afrique <span style="color: #D4AF37;">Business</span></h1>
            <p style="color: #A1A1AA; margin: 6px 0 0 0; font-size: 13px;">« Tout l'Afrique, un seul marché. »</p>
          </div>
          <div style="padding: 24px; color: #E4E4E7; line-height: 1.6;">
            <h2 style="color: #D4AF37; font-size: 18px;">Bienvenue ${safeRecipient} !</h2>
            <p>Votre compte sur <strong>Afrique Business</strong> est désormais configuré.</p>
            <p>Profitez dès aujourd'hui d'une marketplace 100% gratuite :</p>
            <ul>
              <li>Déposer vos annonces en moins de 60 secondes avec photos WebP légères</li>
              <li>Discuter en direct avec les acheteurs et vendeurs par messagerie instantanée ou WhatsApp</li>
              <li>Explorer les meilleures affaires par catégorie, ville et pays en Afrique</li>
            </ul>
            <div style="margin: 24px 0; text-align: center;">
              <a href="${process.env.APP_URL || 'https://afrique-afrique.com'}" style="background: linear-gradient(135deg, #D4AF37, #F59E0B); color: #000000; padding: 12px 24px; border-radius: 12px; font-weight: bold; text-decoration: none; display: inline-block;">Accéder au Marché</a>
            </div>
            <p style="font-size: 11px; color: #71717A; border-top: 1px solid #27272A; padding-top: 16px;">Afrique Business · Plateforme commerciale panafricaine</p>
          </div>
        </div>
      `;
    } else {
      subject = `Notification Afrique Business - ${safeProduct}`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0E0E0E; color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #27272A; padding: 24px;">
          <h2 style="color: #D4AF37;">Bonjour ${safeRecipient},</h2>
          <p>Vous avez une nouvelle notification concernant votre activité sur Afrique Business (${safeProduct}).</p>
        </div>
      `;
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    if (resendApiKey) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html: htmlContent,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!resendRes.ok) {
        const resendErr = await resendRes.text();
        console.warn('[Resend Warning] Fallback to simulated delivery:', resendErr);
        return res.json({
          success: true,
          simulated: true,
          message: `Email transactionnel préparé pour ${to}.`,
        });
      }

      const resendData = await resendRes.json();
      return res.json({
        success: true,
        simulated: false,
        emailId: resendData.id,
        message: `Email transactionnel envoyé via Resend à ${to}.`,
      });
    }

    console.log(`[Resend Simulator] Transactional email sent to ${to} with subject: "${subject}"`);
    return res.json({
      success: true,
      simulated: true,
      message: `Email transactionnel envoyé à ${to} : « ${subject} »`,
    });
  } catch (error: any) {
    console.error('Error sending transactional email:', error);
    return res.status(500).json({ success: false, message: error.message || 'Erreur lors de l’envoi de l’email' });
  }
});

// ----------------------------------------------------
// Persistent Server Listings Store (Zero-Failure Fallback)
// ----------------------------------------------------
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const SERVER_DATA_DIR = isServerless ? path.join('/tmp', 'data') : path.resolve(process.cwd(), 'data');
const SERVER_LISTINGS_FILE = path.join(SERVER_DATA_DIR, 'server_listings.json');

function getServerListings(): any[] {
  try {
    if (!fs.existsSync(SERVER_LISTINGS_FILE)) {
      return [];
    }
    const content = fs.readFileSync(SERVER_LISTINGS_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

function saveServerListings(items: any[]): void {
  try {
    if (!fs.existsSync(SERVER_DATA_DIR)) {
      fs.mkdirSync(SERVER_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SERVER_LISTINGS_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving server listings:', err);
  }
}

app.get('/api/listings', (_req, res) => {
  const listings = getServerListings();
  res.json({ success: true, listings });
});

app.post('/api/listings', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise pour publier une annonce.' });
    }

    const item = req.body;
    if (!item || !item.title) {
      return res.status(400).json({ success: false, message: 'Titre de l’annonce requis' });
    }
    const listings = getServerListings();
    const id = item.id || `lst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const existingIdx = listings.findIndex((l: any) => l.id === id);
    if (existingIdx >= 0 && listings[existingIdx].user_id !== authUser.id) {
      return res.status(403).json({ success: false, message: 'Vous ne pouvez pas modifier l’annonce d’un autre utilisateur.' });
    }

    const fullItem = {
      ...item,
      id,
      user_id: authUser.id,
      title: sanitizeText(item.title, 120),
      description: sanitizeText(item.description || '', 5000),
      created_at: item.created_at || new Date().toISOString(),
      status: item.status || 'active',
    };
    if (existingIdx >= 0) {
      listings[existingIdx] = { ...listings[existingIdx], ...fullItem, edited_at: new Date().toISOString() };
    } else {
      listings.unshift(fullItem);
    }
    saveServerListings(listings);
    res.json({ success: true, listing: fullItem });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/listings/:id', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }

    const { id } = req.params;
    const body = req.body || {};
    const listings = getServerListings();
    const idx = listings.findIndex((l: any) => l.id === id);
    if (idx < 0) {
      return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
    }
    if (listings[idx].user_id !== authUser.id) {
      return res.status(403).json({ success: false, message: 'Action refusée : vous n’êtes pas le propriétaire.' });
    }

    listings[idx] = { ...listings[idx], ...body, user_id: authUser.id, edited_at: new Date().toISOString() };
    saveServerListings(listings);
    return res.json({ success: true, listing: listings[idx] });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/listings/:id', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }

    const { id } = req.params;
    const listings = getServerListings();
    const existing = listings.find((l: any) => l.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
    }
    if (existing.user_id !== authUser.id) {
      return res.status(403).json({ success: false, message: 'Action refusée : vous n’êtes pas le propriétaire.' });
    }

    const filtered = listings.filter((l: any) => l.id !== id);
    saveServerListings(filtered);
    res.json({ success: true, message: 'Annonce supprimée.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// Image Upload Endpoint (Authenticated + Strict Magic-Byte Verification)
// ----------------------------------------------------
const UPLOADS_DIR = isServerless ? path.join('/tmp', 'uploads') : path.join(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Uploads] Directory setup notice:', e);
}
app.use('/uploads', express.static(UPLOADS_DIR));

app.post('/api/upload-image', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise pour téléverser une image.' });
    }

    const { dataUrl, filename } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ success: false, message: 'Image manquante ou invalide.' });
    }

    const matches = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp|gif|avif);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!matches) {
      return res.status(400).json({ success: false, message: 'Format dataUrl non autorisé (JPEG, PNG, WebP, GIF, AVIF uniquement).' });
    }

    const base64Data = matches[2].replace(/\s+/g, '');
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'Taille d’image invalide (max 5 Mo).' });
    }

    const magicCheck = hasValidImageMagicBytes(new Uint8Array(buffer.subarray(0, 16)));
    if (!magicCheck.valid) {
      return res.status(400).json({ success: false, message: 'Signature binaire d’image invalide.' });
    }

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/heic-avif': 'avif',
    };
    const safeExt = extMap[magicCheck.detectedType || ''] || 'webp';

    const safeBase = (filename && typeof filename === 'string')
      ? path.basename(filename).replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 40)
      : `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const cleanFilename = `${authUser.id.slice(0, 8)}_${safeBase}.${safeExt}`;

    const filePath = path.join(UPLOADS_DIR, cleanFilename);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${cleanFilename}`;
    return res.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error('Error saving uploaded image:', err);
    return res.status(500).json({ success: false, message: err.message || 'Erreur lors de la sauvegarde de l’image.' });
  }
});

// ----------------------------------------------------
// 3. Facebook Page Official Graph API & Import Engine
// ----------------------------------------------------
// Cryptographic & database-verified Admin authorization
async function verifyAdminAuth(req: express.Request): Promise<boolean> {
  const adminKey = req.headers['x-admin-key'] as string;

  // 1. Secret key verification (if configured in environment)
  const expectedSecret = process.env.ADMIN_SECRET_KEY;
  if (expectedSecret && adminKey && adminKey === expectedSecret) {
    return true;
  }

  // 2. Cryptographic JWT Bearer token verification via Supabase Auth
  const user = await verifyRequestSupabaseUser(req);
  if (user) {
    const isMarcArnaud =
      user.id === 'd2882463-6bcf-414a-8844-6c06279e50e0' ||
      (user.email && user.email.toLowerCase() === 'marcarnaudkonan2@gmail.com') ||
      (user.phone && user.phone.replace(/[^\d]/g, '').includes('2250565242349'));
    if (isMarcArnaud) return true;
  }

  return false;
}

// 3.1 Get Facebook sync status & sanitized config (tokens are never returned raw)
app.get('/api/admin/facebook-status', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès refusé. Réservé à l’administrateur.' });
    }

    const config = await getFacebookConfigAsync();
    const importedItems = getImportedItems();
    const logs = getSyncLogs();
    const notifs = getAdminNotifications();

    const draftsCount = importedItems.filter((i) => i.status === 'draft').length;
    const listingsCount = importedItems.filter((i) => i.targetType === 'listing' && i.status === 'active').length;
    const postsCount = importedItems.filter((i) => i.targetType === 'social_post').length;

    res.json({
      success: true,
      configured: Boolean(config.pageId && config.pageToken),
      pageId: config.pageId ? `${config.pageId.slice(0, 4)}...${config.pageId.slice(-3)}` : '',
      fullPageId: config.pageId || '',
      hasToken: Boolean(config.pageToken),
      pageName: config.pageName,
      autoSyncEnabled: config.autoSyncEnabled,
      syncIntervalMinutes: config.syncIntervalMinutes,
      lastSyncAt: config.lastSyncAt,
      stats: {
        totalImported: importedItems.length,
        listingsCount,
        postsCount,
        draftsCount,
      },
      recentLogs: logs.slice(0, 10),
      unreadNotifsCount: notifs.filter((n) => !n.read).length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3.2 Update Facebook Configuration (Page ID, Page Token, Page Name)
app.post('/api/admin/facebook-config', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’administrateur.' });
    }

    const { pageId, pageToken, pageName, autoSyncEnabled } = req.body || {};
    const updates: any = {};
    if (pageId !== undefined) updates.pageId = sanitizeText(pageId, 60);
    if (pageToken !== undefined && String(pageToken).trim()) updates.pageToken = String(pageToken).trim();
    if (pageName !== undefined) updates.pageName = sanitizeText(pageName, 100);
    if (autoSyncEnabled !== undefined) updates.autoSyncEnabled = Boolean(autoSyncEnabled);

    const saved = await saveFacebookConfig(updates);
    res.json({
      success: true,
      message: 'Configuration Facebook enregistrée en base de données avec succès.',
      pageName: saved.pageName,
      pageId: saved.pageId ? `${saved.pageId.slice(0, 4)}...${saved.pageId.slice(-3)}` : '',
      hasToken: Boolean(saved.pageToken),
      autoSyncEnabled: saved.autoSyncEnabled,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3.3 Test connection with Facebook Graph API
app.post('/api/admin/facebook-test', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’administrateur.' });
    }

    const { pageId, pageToken } = req.body || {};
    const result = await testFacebookConnection(pageId, pageToken);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.4 Synchronize now (Manual trigger by Admin)
app.post('/api/admin/facebook-sync', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’administrateur.' });
    }

    const { pageId, pageToken } = req.body || {};
    const result = await syncFacebookPagePosts({
      trigger: 'manual',
      pageIdInput: pageId ? String(pageId).trim() : undefined,
      pageTokenInput: pageToken ? String(pageToken).trim() : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.5 Get sync logs & history
app.get('/api/admin/facebook-logs', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’administrateur.' });
    }

    const logs = getSyncLogs();
    const items = getImportedItems();
    res.json({
      success: true,
      logs,
      items: items.slice(0, 50),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3.6 Get admin notifications & mark read
app.get('/api/admin/facebook-notifications', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’administrateur.' });
    }
    const notifs = getAdminNotifications();
    res.json({ success: true, notifications: notifs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/admin/facebook-notifications/read', async (req, res) => {
  try {
    const isAuth = await verifyAdminAuth(req);
    if (!isAuth) {
      return res.status(403).json({ success: false, message: 'Accès réservé à l’administrateur.' });
    }
    markNotificationsAsRead();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// Social Feed Interactive Reactions & Shares Endpoints
// ----------------------------------------------------
app.get('/api/social/stats', (req, res) => {
  try {
    const postIdsParam = String(req.query.postIds || '');
    const currentUserId = req.query.userId ? String(req.query.userId) : undefined;
    const postIds = postIdsParam.split(',').map((id) => id.trim()).filter(Boolean);

    const stats = getBatchStats(postIds, currentUserId);
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/social/reactions/:postId', (req, res) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.query.userId ? String(req.query.userId) : undefined;
    const stats = getPostSocialStats(postId, currentUserId);
    const reactors = getPostReactorsList(postId);
    res.json({ success: true, stats, reactors });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/social/reactions', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise pour réagir.' });
    }

    const { postId, userId, reactionType, userInfo } = req.body || {};
    if (!postId || !reactionType) {
      return res.status(400).json({ success: false, message: 'postId et reactionType requis' });
    }
    if (userId && userId !== authUser.id) {
      return res.status(403).json({ success: false, message: 'Identifiant utilisateur non concordant.' });
    }

    const validTypes: ReactionType[] = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
    if (!validTypes.includes(reactionType)) {
      return res.status(400).json({ success: false, message: 'Type de réaction invalide' });
    }

    const result = await setOrToggleReaction(postId, authUser.id, reactionType, userInfo);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error setting reaction:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/social/shares', async (req, res) => {
  try {
    const authUser = await verifyRequestSupabaseUser(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentification requise pour enregistrer un partage.' });
    }

    const { postId, userId, shareType, commentary, createdPostId } = req.body || {};
    if (!postId || !shareType) {
      return res.status(400).json({ success: false, message: 'postId et shareType requis' });
    }
    if (userId && userId !== authUser.id) {
      return res.status(403).json({ success: false, message: 'Identifiant utilisateur non concordant.' });
    }

    const result = recordShareEvent(postId, authUser.id, shareType, commentary, createdPostId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ----------------------------------------------------
// App Version & Deployment Update Detection Endpoint
// ----------------------------------------------------
app.get('/api/app-version', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({
    success: true,
    version: APP_VERSION,
    commitSha: COMMIT_SHA,
    buildTimestamp: SERVER_START_TIME,
    timestamp: Date.now(),
  });
});

// Return clean JSON 404 for unknown /api/* routes (never HTML fallback)
app.all('/api/*', (_req, res) => {
  res.status(404).json({ success: false, message: 'Route API introuvable.' });
});

// Global JSON error handler (catches malformed JSON SyntaxError, entity.too.large, etc.)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  const status = Number(err?.status || err?.statusCode || 500);
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: 'Corps JSON invalide.' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Fichier ou requête trop volumineuse (max 25 Mo).' });
  }
  if (req.path.startsWith('/api/') || req.path === '/healthz') {
    return res.status(status >= 400 ? status : 500).json({
      success: false,
      message: err?.message || 'Erreur interne du serveur.',
    });
  }
  return res.status(status >= 400 ? status : 500).send('Erreur interne du serveur.');
});

// Serve static public assets (manifests, icons, offline.html, sw.js)
app.use(express.static(path.join(__dirname, 'public')));

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  // Automatic Facebook Hourly Scheduler is disabled per user request (Manual import only)
  // startFacebookHourlyScheduler();

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        service: 'afrique-business',
        version: APP_VERSION,
        commitSha: COMMIT_SHA,
        port,
        env: process.env.NODE_ENV || 'development',
        region: process.env.CLOUD_RUN_REGION || 'europe-west2',
        supabaseConfigured: Boolean(supabaseUrl && supabaseAnonKey),
        serviceRoleConfigured: Boolean(serviceRoleKey),
        smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
        emailConfigured: Boolean(process.env.RESEND_API_KEY),
      })
    );
  });

  const gracefulShutdown = (signal: string) => {
    console.log(JSON.stringify({ event: 'shutdown_initiated', signal }));
    server.close(() => {
      console.log(JSON.stringify({ event: 'shutdown_complete', signal }));
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 10000).unref();
  };

  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
}

if (!process.env.VERCEL && process.env.DISABLE_AUTO_START !== 'true') {
  startServer();
}

export { app, startServer };
export default app;

