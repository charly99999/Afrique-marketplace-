-- ============================================================================
-- MIGRATION SUPABASE STORAGE : POLITIQUES DE SÉCURITÉ RLS (BUCKET: listings)
-- Application : AFRIQUE BUSINESS (https://afrique-afrique.com)
-- ============================================================================
-- Cette migration configure précisément les permissions de stockage pour
-- éliminer l'erreur "new row violates row-level security policy" lors de
-- l'ajout de photos d'annonces, tout en maintenant un contrôle d'accès strict.
-- ============================================================================

-- 1. CONFIGURATION DU BUCKET 'listings'
-- Le bucket doit être public pour que les acheteurs puissent visualiser les photos d'annonces.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listings',
  'listings',
  true,
  5242880, -- 5 Mo max par photo
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg'];

-- Configuration complémentaire des buckets associés (avatars, posts, chat)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('posts', 'posts', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('chat', 'chat', false, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. NETTOYAGE DES ANCIENNES POLITIQUES EN DOUBLON OU CONFLICTUELLES
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

-- 3. POLITIQUES RLS SUR storage.objects POUR LE BUCKET 'listings'

-- A. LECTURE PUBLIQUE (SELECT)
-- N'importe quel visiteur (connecté ou anonyme) peut afficher les photos des annonces publiées
CREATE POLICY "Public Access for listings"
ON storage.objects FOR SELECT
USING ( bucket_id = 'listings' );

-- B. INSERTION (UPLOAD)
-- Un utilisateur connecté peut ajouter une photo d'annonce UNIQUEMENT dans le sous-dossier portant son propre ID utilisateur
-- Exemple de chemin validé : d2882463-6bcf-414a-8844-6c06279e50e0/1794184289_photo.webp
CREATE POLICY "Authenticated users can upload listing photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- C. MODIFICATION (UPDATE)
-- Seul l'auteur authentifié peut modifier ou écraser ses propres fichiers
CREATE POLICY "Users can update their own listing photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- D. SUPPRESSION (DELETE)
-- Seul le propriétaire authentifié peut supprimer les photos de ses annonces
CREATE POLICY "Users can delete their own listing photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- POLITIQUES RLS COMPLÉMENTAIRES POUR LES BUCKETS AVATARS ET POSTS
-- ============================================================================

-- Avatars : lecture publique, écriture limitée au sous-dossier de l'utilisateur
DROP POLICY IF EXISTS "Public Access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Public Access for avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Publications du Fil Social (posts) : lecture publique, ajout par l'auteur
DROP POLICY IF EXISTS "Public Access for posts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete post media" ON storage.objects;

CREATE POLICY "Public Access for posts"
ON storage.objects FOR SELECT
USING ( bucket_id = 'posts' );

CREATE POLICY "Users can upload post media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update post media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete post media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
