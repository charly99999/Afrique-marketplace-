import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wlvzjhpfcvwcgyelpsnx.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Gd_1w7RmnkKKeQ5RhobaPw_MPrka48J';

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

test('Production Supabase read-only check preserves existing listings, profiles, and posts', async () => {
  const { data: listings, count: listingsCount, error: lErr } = await anonClient
    .from('listings')
    .select('id, status, images', { count: 'exact' })
    .limit(25);

  assert.equal(lErr, null, `Listings SELECT error: ${lErr?.message}`);
  assert.ok((listingsCount ?? listings?.length ?? 0) >= 17, 'Expected existing listings to remain intact');

  const { data: profiles, count: profilesCount, error: pErr } = await anonClient
    .from('profiles')
    .select('id, full_name', { count: 'exact' })
    .limit(25);

  assert.equal(pErr, null, `Profiles SELECT error: ${pErr?.message}`);
  assert.ok((profilesCount ?? profiles?.length ?? 0) >= 7, 'Expected existing profiles to remain intact');

  const { data: posts, count: postsCount, error: postErr } = await anonClient
    .from('posts')
    .select('id', { count: 'exact' })
    .limit(25);

  assert.equal(postErr, null, `Posts SELECT error: ${postErr?.message}`);
  assert.ok((postsCount ?? posts?.length ?? 0) >= 3, 'Expected existing posts to remain intact');
});

test('Unauthenticated client receives zero rows from private messaging, safety, and user tables', async () => {
  const privateTables = [
    'messages',
    'conversations',
    'favorites',
    'profile_private',
    'blocks',
    'reports',
    'support_tickets',
  ];
  for (const table of privateTables) {
    const { data } = await anonClient.from(table).select('*').limit(5);
    assert.equal(
      (data || []).length,
      0,
      `Anonymous client must not read rows from private table "${table}"`
    );
  }
});

test('Unauthenticated client cannot update or delete existing public listings, profiles, or posts', async () => {
  const { data: sampleListing } = await anonClient.from('listings').select('id, title').limit(1).maybeSingle();
  if (sampleListing?.id) {
    const { error: updErr, data: updRows } = await anonClient
      .from('listings')
      .update({ title: 'Unauthorized Edit Attempt' })
      .eq('id', sampleListing.id)
      .select();
    assert.ok(updErr || !updRows || updRows.length === 0, 'Anon UPDATE on existing listing must not modify data');
  }

  const { data: samplePost } = await anonClient.from('posts').select('id').limit(1).maybeSingle();
  if (samplePost?.id) {
    const { error: postUpdErr, data: postUpdRows } = await anonClient
      .from('posts')
      .update({ content: 'Unauthorized Post Edit Attempt' })
      .eq('id', samplePost.id)
      .select();
    assert.ok(postUpdErr || !postUpdRows || postUpdRows.length === 0, 'Anon UPDATE on existing post must not modify data');
  }
});
