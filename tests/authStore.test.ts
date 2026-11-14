import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  hashPassword,
  verifyPassword,
  verifyUserLogin,
  registerUserCredential,
  ADMIN_EMAIL,
  ADMIN_PHONE,
} from '../src/server/authStore.ts';

test('hashPassword & verifyPassword use scrypt salts and reject invalid passwords', () => {
  const hash1 = hashPassword('SecretPass#2026');
  const hash2 = hashPassword('SecretPass#2026');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('SecretPass#2026', hash1), true);
  assert.equal(verifyPassword('WrongPass', hash1), false);
  assert.equal(verifyPassword('any', ''), false);
});

test('verifyUserLogin never auto-locks an empty passwordHash on admin seed', () => {
  const res = verifyUserLogin(ADMIN_PHONE, 'arbitrary-attempt-password');
  assert.equal(res.success, false);

  const resEmail = verifyUserLogin(ADMIN_EMAIL, 'arbitrary-attempt-password');
  assert.equal(resEmail.success, false);
});

test('registerUserCredential & verifyUserLogin round-trip cleanly and leave no test residue', () => {
  const dataFile = path.resolve(process.cwd(), 'data', 'user_credentials.json');
  const snapshotBefore = fs.existsSync(dataFile) ? fs.readFileSync(dataFile, 'utf-8') : null;
  const testUserId = '11111111-2222-4333-8444-555555555555';

  try {
    const cred = registerUserCredential({
      userId: testUserId,
      phone: '+2250799887766',
      email: 'qa-test@afrique-business.internal',
      fullName: 'Compte Test QA',
      password: 'QaStrongPassword!1',
      city: 'Abidjan',
      country: 'CI',
    });
    assert.equal(cred.userId, testUserId);

    const good = verifyUserLogin('+2250799887766', 'QaStrongPassword!1');
    assert.equal(good.success, true);
    assert.equal(good.user?.userId, testUserId);

    const bad = verifyUserLogin('+2250799887766', 'WrongPassword!');
    assert.equal(bad.success, false);
  } finally {
    if (snapshotBefore !== null) {
      fs.writeFileSync(dataFile, snapshotBefore, 'utf-8');
    } else if (fs.existsSync(dataFile)) {
      fs.unlinkSync(dataFile);
    }
  }
});
