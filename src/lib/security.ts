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
 * Validates and sanitizes image and resource URLs to prevent script injection.
 * Supports:
 * - Standard web URLs (http://, https://)
 * - Safe image Data URIs (data:image/...)
 * - Root-relative static asset URLs (/uploads/..., /assets/...)
 * - Blob URLs (blob:...)
 */
export function sanitizeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Prevent dangerous executable schemes
  if (/^(?:javascript|vbscript):/i.test(trimmed)) {
    return null;
  }

  // 1. Allow safe image Data URIs (WebP, PNG, JPEG, GIF, SVG, AVIF)
  if (trimmed.startsWith('data:image/')) {
    if (!/<script|javascript:|vbscript:/i.test(trimmed)) {
      return trimmed;
    }
    return null;
  }

  // 2. Allow Blob URLs created in-memory
  if (trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // 3. Allow safe relative URLs (e.g. /uploads/image.webp or /assets/logo.jpg)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return trimmed;
  }

  // 4. Validate standard HTTP/HTTPS URLs
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

/**
 * Inspects binary magic bytes to ensure uploaded buffers are real raster images
 * (JPEG, PNG, GIF, WebP, BMP, HEIC/AVIF) and not HTML/SVG/scripts masquerading as images.
 */
export function hasValidImageMagicBytes(bytes: Uint8Array): { valid: boolean; detectedType?: string } {
  if (!bytes || bytes.length < 4) {
    return { valid: false };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { valid: true, detectedType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { valid: true, detectedType: 'image/png' };
  }

  // GIF87a / GIF89a: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { valid: true, detectedType: 'image/gif' };
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { valid: true, detectedType: 'image/webp' };
  }

  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { valid: true, detectedType: 'image/bmp' };
  }

  // ISO BMFF (AVIF / HEIC): ....ftyp
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return { valid: true, detectedType: 'image/heic-avif' };
  }

  return { valid: false };
}

export async function validateImageFileSignature(
  file: Blob,
  maxInputBytes = 15 * 1024 * 1024
): Promise<{ valid: boolean; detectedType?: string; reason?: string }> {
  if (!file || file.size === 0) {
    return { valid: false, reason: 'Le fichier image est vide.' };
  }
  if (file.size > maxInputBytes) {
    const mb = Math.round(maxInputBytes / (1024 * 1024));
    return { valid: false, reason: `Image trop volumineuse (maximum ${mb} Mo).` };
  }

  const declared = (file.type || '').toLowerCase();
  if (declared === 'image/svg+xml' || declared.includes('svg')) {
    return { valid: false, reason: 'Les fichiers SVG ne sont pas autorisés pour les photos.' };
  }

  try {
    const headerBuffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(headerBuffer);
    const sig = hasValidImageMagicBytes(bytes);
    if (!sig.valid) {
      return {
        valid: false,
        reason: 'Format d’image non reconnu ou corrompu (JPEG, PNG, WebP, GIF, HEIC/AVIF uniquement).',
      };
    }
    return sig;
  } catch {
    return { valid: false, reason: 'Impossible de lire l’en-tête du fichier image.' };
  }
}

