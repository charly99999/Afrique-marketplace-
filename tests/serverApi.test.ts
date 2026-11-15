import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.DISABLE_AUTO_START = 'true';

let server: http.Server;
let baseUrl = '';

before(async () => {
  const mod = await import('../server.ts');
  const app = mod.app || mod.default;
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections?.();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('GET /healthz & GET /api/app-version expose unified v3.1.0 metadata', async () => {
  const healthRes = await fetch(`${baseUrl}/healthz`);
  assert.equal(healthRes.status, 200);
  const healthJson = (await healthRes.json()) as any;
  assert.equal(healthJson.status, 'ok');
  assert.equal(healthJson.service, 'afrique-business');
  assert.equal(healthJson.version, '3.1.0');
  assert.ok(typeof healthJson.region === 'string' && healthJson.region.length > 0);

  const apiHealthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(apiHealthRes.status, 200);
  const apiHealthJson = (await apiHealthRes.json()) as any;
  assert.equal(apiHealthJson.status, 'ok');
  assert.equal(apiHealthJson.service, 'afrique-business');

  const verRes = await fetch(`${baseUrl}/api/app-version`);
  assert.equal(verRes.status, 200);
  const verJson = (await verRes.json()) as any;
  assert.equal(verJson.success, true);
  assert.equal(verJson.version, '3.1.0');
});

test('Unknown /api/* routes and malformed JSON bodies return JSON instead of HTML', async () => {
  const notFoundRes = await fetch(`${baseUrl}/api/route-inexistante-qa`);
  assert.equal(notFoundRes.status, 404);
  assert.equal((notFoundRes.headers.get('content-type') || '').includes('application/json'), true);
  const notFoundJson = (await notFoundRes.json()) as any;
  assert.equal(notFoundJson.success, false);

  const badJsonRes = await fetch(`${baseUrl}/api/auth/login-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"identifier": "broken-json',
  });
  assert.equal(badJsonRes.status, 400);
  assert.equal((badJsonRes.headers.get('content-type') || '').includes('application/json'), true);
  const badJson = (await badJsonRes.json()) as any;
  assert.equal(badJson.success, false);
});

test('Protected endpoints strictly reject unauthenticated and forged Bearer token requests (401/403)', async () => {
  const checks: Array<{ method: string; path: string; body?: unknown; expected: number[] }> = [
    { method: 'POST', path: '/api/auth/change-password', body: { newPassword: 'hacked123' }, expected: [401] },
    { method: 'POST', path: '/api/listings', body: { title: 'Test' }, expected: [401] },
    { method: 'PUT', path: '/api/listings/nonexistent', body: { title: 'Hack' }, expected: [401] },
    { method: 'DELETE', path: '/api/listings/nonexistent', expected: [401] },
    { method: 'POST', path: '/api/upload-image', body: { dataUrl: 'data:image/png;base64,AA==' }, expected: [401] },
    {
      method: 'POST',
      path: '/api/email/send-transactional',
      body: { to: 'victim@example.com', type: 'WELCOME' },
      expected: [401],
    },
    { method: 'POST', path: '/api/social/reactions', body: { postId: 'p1', reactionType: 'like' }, expected: [401] },
    { method: 'POST', path: '/api/social/shares', body: { postId: 'p1', shareType: 'link_copy' }, expected: [401] },
    { method: 'GET', path: '/api/admin/facebook-status', expected: [401, 403] },
  ];

  for (const c of checks) {
    const res = await fetch(`${baseUrl}${c.path}`, {
      method: c.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer forged.invalid.jwt',
      },
      body: c.body ? JSON.stringify(c.body) : undefined,
    });
    assert.equal(
      c.expected.includes(res.status),
      true,
      `Expected ${c.expected.join('/')} for ${c.method} ${c.path}, got ${res.status}`
    );
  }
});

test('POST /api/auth/register-user & /login-with-password enforce OTP & password verification', async () => {
  const regRes = await fetch(`${baseUrl}/api/auth/register-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: '+2250700000001',
      password: 'Password123',
      fullName: 'Test User',
      code: '000000',
    }),
  });
  assert.equal(regRes.status, 400);
  const regJson = (await regRes.json()) as any;
  assert.equal(regJson.success, false);

  const loginRes = await fetch(`${baseUrl}/api/auth/login-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: '+2250700000001',
      password: 'WrongPassword123',
    }),
  });
  assert.equal(loginRes.status, 401);
  const loginJson = (await loginRes.json()) as any;
  assert.equal(loginJson.success, false);
});

test('POST /api/auth/send-sms-otp does not leak simulated OTP when simulator is disabled', async () => {
  const prevAllowed = process.env.ALLOW_DEV_OTP_SIMULATOR;
  delete process.env.ALLOW_DEV_OTP_SIMULATOR;
  try {
    const res = await fetch(`${baseUrl}/api/auth/send-sms-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+2250701020304' }),
    });
    if (!process.env.TWILIO_ACCOUNT_SID) {
      assert.equal(res.status, 503);
      const json = (await res.json()) as any;
      assert.equal(json.otp, undefined);
      assert.equal(json.success, false);
    }
  } finally {
    if (prevAllowed !== undefined) {
      process.env.ALLOW_DEV_OTP_SIMULATOR = prevAllowed;
    }
  }
});

test('POST /api/auth/quick-sms-login and /reset-password-sms reject invalid/missing OTP without forging sessions', async () => {
  const quickRes = await fetch(`${baseUrl}/api/auth/quick-sms-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+2250700000099', code: '123456' }),
  });
  assert.ok([400, 503].includes(quickRes.status), `Expected 400 or 503, got ${quickRes.status}`);
  const quickJson = (await quickRes.json()) as any;
  assert.equal(quickJson.success, false);
  assert.equal(quickJson.tokenHash, undefined);

  const resetRes = await fetch(`${baseUrl}/api/auth/reset-password-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+2250700000099', code: '000000', newPassword: 'NewPass123' }),
  });
  assert.equal(resetRes.status, 400);
  const resetJson = (await resetRes.json()) as any;
  assert.equal(resetJson.success, false);
});

test('POST /api/auth/resolve-account returns targeted candidate emails without flooding Supabase Auth', async () => {
  const res = await fetch(`${baseUrl}/api/auth/resolve-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '+2250565242349' }),
  });
  assert.equal(res.status, 200);
  const json = (await res.json()) as any;
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.candidateEmails));
  assert.equal(json.candidateEmails[0], 'phone2250565242349@afrique-business.app');
  assert.ok(json.candidateEmails.includes('marcarnaudkonan2@gmail.com'));
  assert.ok(json.candidateEmails.includes('phone2250565242349@afrique-business.app'));
  assert.ok(json.candidateEmails.length <= 10, `Too many candidate emails (${json.candidateEmails.length})`);

  const emailRes = await fetch(`${baseUrl}/api/auth/resolve-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'marcarnaudkonan2@gmail.com' }),
  });
  assert.equal(emailRes.status, 200);
  const emailJson = (await emailRes.json()) as any;
  assert.equal(emailJson.success, true);
  assert.ok(Array.isArray(emailJson.candidateEmails));
  assert.equal(emailJson.candidateEmails[0], 'phone2250565242349@afrique-business.app');
  assert.ok(emailJson.candidateEmails.includes('marcarnaudkonan2@gmail.com'));

  const clientStoreMod = await import('../src/lib/clientAuthStore.ts');
  const clientCandidates = clientStoreMod.generateCandidateEmails('marcarnaudkonan2@gmail.com');
  assert.equal(clientCandidates[0], 'phone2250565242349@afrique-business.app');
  assert.ok(clientCandidates.includes('marcarnaudkonan2@gmail.com'));
});

test('GET /api/auth/capabilities and POST /api/auth/request-recovery-email return honest capability flags and validate inputs', async () => {
  const capRes = await fetch(`${baseUrl}/api/auth/capabilities`);
  assert.equal(capRes.status, 200);
  const capJson = (await capRes.json()) as any;
  assert.equal(capJson.success, true);
  assert.equal(typeof capJson.smsEnabled, 'boolean');
  assert.equal(typeof capJson.adminSyncEnabled, 'boolean');
  assert.equal(typeof capJson.emailRecoveryEnabled, 'boolean');
  assert.equal(typeof capJson.resendConfigured, 'boolean');

  const badRecRes = await fetch(`${baseUrl}/api/auth/request-recovery-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '' }),
  });
  assert.equal(badRecRes.status, 400);
  const badRecJson = (await badRecRes.json()) as any;
  assert.equal(badRecJson.success, false);
});

test('formatTwilioErrorMessage maps Twilio Trial 572006 and Geo/Verified errors cleanly with email fallback', async () => {
  const mod = await import('../server.ts');
  const trialMsg = mod.formatTwilioErrorMessage(572006);
  assert.equal(trialMsg.fallbackToEmail, true);
  assert.match(trialMsg.message, /572006/);

  const unverifiedMsg = mod.formatTwilioErrorMessage(21608);
  assert.equal(unverifiedMsg.fallbackToEmail, true);
  assert.match(unverifiedMsg.message, /21608/);

  const geoMsg = mod.formatTwilioErrorMessage(21408);
  assert.equal(geoMsg.fallbackToEmail, true);
  assert.match(geoMsg.message, /21408/);
});



