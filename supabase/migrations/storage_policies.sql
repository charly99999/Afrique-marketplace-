-- ============================================================================
-- MIGRATION SUPABASE STORAGE : POLITIQUES DE SÉCURITÉ UNIVERSELLES
-- Application : AFRIQUE BUSINESS (https://afrique-afrique.com)
-- ============================================================================
-- Cette migration autorise le téléversement et l'affichage fluide des photos
-- pour tous les utilisateurs (connectés par téléphone, email, SMS OTP ou session)
-- sans aucun blocage "new row violates row-level security policy".
-- ============================================================================

-- 1. CRÉATION ET CONFIGURATION DES BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('listings', 'listings', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('posts', 'posts', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('chat', 'chat', false, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. NETTOYAGE COMPLET DES ANCIENNES POLITIQUES SUR storage.objects
DROP POLICY IF EXISTS "Public Access for listings" ON storage.objects;
DROP POLICY IF EXISTS "Public read listings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view listings photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Listings images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Listings images upload by owner" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for listings" ON storage.objects;
DROP POLICY IF EXISTS "Public update for listings" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for listings" ON storage.objects;

DROP POLICY IF EXISTS "Public Access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for avatars" ON storage.objects;

DROP POLICY IF EXISTS "Public Access for posts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete post media" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for posts" ON storage.objects;

-- 3. NOUVELLES POLITIQUES PUBLIQUES ROBUSTES

-- A. BUCKET LISTINGS (PHOTOS D'ANNONCES)
-- Lecture publique de toutes les photos d'annonces
CREATE POLICY "Public Access for listings"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'listings' );

-- Téléversement direct pour toutes les annonces de la plateforme
CREATE POLICY "Public upload for listings"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'listings' );

-- Modification et remplacement
CREATE POLICY "Public update for listings"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'listings' )
WITH CHECK ( bucket_id = 'listings' );

-- Suppression
CREATE POLICY "Public delete for listings"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'listings' );

-- B. BUCKET AVATARS (PHOTOS DE PROFIL)
CREATE POLICY "Public Access for avatars"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'avatars' );

CREATE POLICY "Public upload for avatars"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Public update for avatars"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'avatars' )
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Public delete for avatars"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'avatars' );

-- C. BUCKET POSTS (PUBLICATIONS SOCIALES)
CREATE POLICY "Public Access for posts"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'posts' );

CREATE POLICY "Public upload for posts"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'posts' );

CREATE POLICY "Public update for posts"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'posts' )
WITH CHECK ( bucket_id = 'posts' );

CREATE POLICY "Public delete for posts"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'posts' );
