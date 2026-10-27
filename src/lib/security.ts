/**
 * Security & Sanitization Utilities for Afrique Business
 * Prevents XSS, Script Injection, Open Redirects, and Malicious Input
 */

/**
 * Strips HTML tags, script tags, event handlers, control characters and null bytes.
 */
export function sanitizeText(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  
  // 1. Remove null bytes and control characters (except newline \n and \r)
  let clean = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

  // 2. Strip <script>...</script> tags and contents
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 3. Strip all HTML tags
  clean = clean.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');

  // 4. Strip dangerous inline javascript: or vbscript: or data: URIs
  clean = clean.replace(/(?:javascript|vbscript|data):/gi, '');

  // 5. Trim and enforce maxLength
  return clean.trim().slice(0, maxLength);
}

/**
 * Validates and sanitizes external URLs to prevent javascript: pseudo-protocol or phishing.
 * Only allows valid http:// or https:// URLs.
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Invalid URL format
  }
  return null;
}

/**
 * Strict Phone Number Validation (E.164 and Pan-African standards).
 * Accepts formats: +2250102030405, 0102030405, +234..., etc. (8 to 15 digits).
 */
export function isValidPhoneNumber(phone?: string | null): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^\+?[0-9]{8,15}$/.test(clean);
}

/**
 * Clean and format phone number with international prefix if missing.
 */
export function normalizePhoneNumber(phone: string, defaultCountryPrefix = '+225'): string {
  let clean = phone.replace(/[\s\-\(\)\.]/g, '');
  if (clean.startsWith('00')) {
    clean = '+' + clean.slice(2);
  }
  if (!clean.startsWith('+')) {
    if (clean.length === 10) {
      clean = defaultCountryPrefix + clean;
    }
  }
  return clean;
}

/**
 * Safe email validator
 */
export function isValidEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(trimmed);
}
