import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText,
  sanitizeUrl,
  isValidPhoneNumber,
  isValidEmail,
  hasValidImageMagicBytes,
} from '../src/lib/security.ts';

test('sanitizeText removes HTML/scripts/dangerous schemes and respects maxLength', () => {
  const dirty = '<script>alert(1)</script><b>Bonjour</b> javascript:evil() \u0000';
  const clean = sanitizeText(dirty, 50);
  assert.equal(clean.includes('<script>'), false);
  assert.equal(clean.includes('<b>'), false);
  assert.equal(clean.toLowerCase().includes('javascript:'), false);
  assert.equal(clean.includes('Bonjour'), true);

  const long = sanitizeText('a'.repeat(100), 10);
  assert.equal(long.length, 10);
});

test('sanitizeUrl allows safe http/https/relative/blob/data-image URLs and blocks javascript:', () => {
  assert.equal(sanitizeUrl('https://afrique-afrique.com/photo.webp'), 'https://afrique-afrique.com/photo.webp');
  assert.equal(sanitizeUrl('/uploads/item.webp'), '/uploads/item.webp');
  assert.equal(sanitizeUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeUrl('vbscript:msgbox(1)'), null);
  assert.equal(sanitizeUrl('//evil.example/a'), null);
  assert.equal(sanitizeUrl('data:image/png;base64,iVBOR<script>'), null);
});

test('isValidPhoneNumber & isValidEmail enforce expected formats', () => {
  assert.equal(isValidPhoneNumber('+2250565242349'), true);
  assert.equal(isValidPhoneNumber('05 65 24 23 49'), true);
  assert.equal(isValidPhoneNumber('1234'), false);
  assert.equal(isValidEmail('vendeur@afrique-afrique.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
});

test('hasValidImageMagicBytes accepts JPEG/PNG/GIF/WebP and rejects SVG/HTML/arbitrary bytes', () => {
  assert.deepEqual(hasValidImageMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), {
    valid: true,
    detectedType: 'image/jpeg',
  });
  assert.deepEqual(
    hasValidImageMagicBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    { valid: true, detectedType: 'image/png' }
  );
  assert.deepEqual(
    hasValidImageMagicBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])),
    { valid: true, detectedType: 'image/gif' }
  );
  assert.deepEqual(
    hasValidImageMagicBytes(
      new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
    ),
    { valid: true, detectedType: 'image/webp' }
  );

  // Reject SVG XSS payload & plain HTML
  const svgBytes = new TextEncoder().encode('<svg onload=alert(1)>');
  assert.equal(hasValidImageMagicBytes(svgBytes).valid, false);
  const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><html></html>');
  assert.equal(hasValidImageMagicBytes(htmlBytes).valid, false);
});
