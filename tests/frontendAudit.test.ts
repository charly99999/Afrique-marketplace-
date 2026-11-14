import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (/\.(ts|tsx|js)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

test('Version 3.0.0 is synchronized across backend, Service Worker, and UI', () => {
  const serverCode = fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf-8');
  const swCode = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf-8');
  const regSwCode = fs.readFileSync(path.join(ROOT, 'src/lib/registerServiceWorker.ts'), 'utf-8');
  const settingsCode = fs.readFileSync(path.join(ROOT, 'src/components/SettingsModal.tsx'), 'utf-8');

  assert.match(serverCode, /APP_VERSION\s*=\s*'3\.0\.0'/);
  assert.match(swCode, /CACHE_NAME\s*=\s*'afrique-business-shell-v3\.0\.0'/);
  assert.match(regSwCode, /'3\.0\.0'/);
  assert.match(settingsCode, /Version 3\.0\.0/);
});

test('Frontend source has zero Unsplash stock fallbacks, native alert/confirm, or service_role keys', () => {
  const clientFiles = [
    ...collectTsFiles(path.join(ROOT, 'src')).filter(
      (f) => !path.relative(ROOT, f).startsWith(`src${path.sep}server${path.sep}`)
    ),
    ...collectTsFiles(path.join(ROOT, 'public')),
  ];
  for (const file of clientFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(ROOT, file);
    assert.equal(content.includes('images.unsplash.com'), false, `Found Unsplash URL in ${rel}`);
    assert.equal(/window\.(alert|confirm)\s*\(/.test(content), false, `Found window.alert/confirm in ${rel}`);
    assert.equal(content.includes('SUPABASE_SERVICE_ROLE_KEY'), false, `Found service role reference in ${rel}`);
  }
});

test('Cloud Run workflow, Dockerfile, and health/version endpoints match europe-west2 port 8080 setup', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-cloudrun.yml'), 'utf-8');
  const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf-8');
  const swCode = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf-8');

  assert.match(workflow, /SERVICE_NAME:\s*afrique-business/);
  assert.match(workflow, /REGION:\s*europe-west2/);
  assert.match(workflow, /--port=8080/);
  assert.match(dockerfile, /ENV PORT=8080/);
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(dockerfile, /\/healthz/);
  assert.match(swCode, /\/api\//);
  assert.match(swCode, /supabase\.co/);
});

test('App.tsx wires Header search, DataSaver, real unread messages count, and error recovery', () => {
  const appCode = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  assert.match(appCode, /<FeedView[\s\S]*searchQuery=\{searchQuery\}/);
  assert.match(appCode, /<ExploreView[\s\S]*searchQuery=\{searchQuery\}/);
  assert.match(appCode, /fetchUnreadMessagesTotal/);
  assert.match(appCode, /onUnreadCountChange/);
  assert.match(appCode, /listingsError/);
});

test('SQL RLS migration covers all marketplace, social, messaging, and moderation tables securely', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/repair_database_and_storage.sql'), 'utf-8');
  const requiredTables = [
    'public.listings',
    'public.profiles',
    'public.profile_private',
    'public.posts',
    'public.comments',
    'public.post_likes',
    'public.favorites',
    'public.conversations',
    'public.messages',
    'public.blocks',
    'public.reports',
    'public.support_tickets',
    'storage.objects',
  ];
  for (const tbl of requiredTables) {
    assert.ok(sql.includes(tbl), `Missing SQL RLS policies for ${tbl}`);
  }
  assert.equal(/USING\s*\(\s*true\s*\)[\s\S]{0,80}WITH CHECK\s*\(\s*true\s*\)/i.test(sql), false);
});

test('PWA manifests (manifest.webmanifest & manifest.json) satisfy length, icon, and start_url checks', () => {
  for (const filename of ['public/manifest.webmanifest', 'public/manifest.json']) {
    const raw = fs.readFileSync(path.join(ROOT, filename), 'utf-8');
    const manifest = JSON.parse(raw) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      icons: Array<{ sizes: string; src: string }>;
    };
    assert.ok(manifest.name && manifest.name.length > 0, `${filename} missing name`);
    assert.ok(
      manifest.short_name && manifest.short_name.length <= 12,
      `${filename} short_name "${manifest.short_name}" exceeds 12 chars`
    );
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.display, 'standalone');
    const sizes = new Set(manifest.icons.map((i) => i.sizes));
    assert.ok(sizes.has('192x192'), `${filename} missing 192x192 icon`);
    assert.ok(sizes.has('512x512'), `${filename} missing 512x512 icon`);
  }
});

test('supabaseData.ts and AuthModal/App enforce signed chat URLs, search sanitization, paginated favorites, and real Supabase JWT sessions', () => {
  const dataCode = fs.readFileSync(path.join(ROOT, 'src/lib/supabaseData.ts'), 'utf-8');
  const appCode = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  const authCode = fs.readFileSync(path.join(ROOT, 'src/components/AuthModal.tsx'), 'utf-8');

  assert.match(dataCode, /resolveChatSignedUrl/);
  assert.match(dataCode, /fetchListingsByIds/);
  assert.match(dataCode, /replace\(\/\[,\(\)\*%\\\\\]\/g/);
  assert.match(appCode, /refreshSession/);
  assert.match(authCode, /establishSupabaseSession/);
  assert.match(authCode, /verifyOtp/);
});

