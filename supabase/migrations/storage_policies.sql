-- ============================================================================
-- MIGRATION SUPABASE STORAGE : POLITIQUES DE SÉCURITÉ STRICTES PAR UTILISATEUR
-- Application : AFRIQUE BUSINESS (https://afrique-afrique.com)
-- ============================================================================
-- 1. Seuls les utilisateurs authentifiés peuvent téléverser.
-- 2. Chaque utilisateur peut téléverser, modifier et supprimer UNIQUEMENT dans son propre dossier :
--    Dossier racine = ${auth.uid()} (vérifié par (storage.foldername(name))[1] = auth.uid()::text)
-- 3. La lecture publique est autorisée uniquement pour les buckets publics (listings, avatars, posts)
--    afin que les visiteurs du marché et du fil social puissent afficher les photos.
-- ============================================================================

-- 1. CRÉATION ET CONFIGURATION DES BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('listings', 'listings', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('posts', 'posts', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg']),
  ('chat', 'chat', false, 10485760, ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. NETTOYAGE COMPLET DES ANCIENNES POLITIQUES
DROP POLICY IF EXISTS "Public Access for listings" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for listings" ON storage.objects;
DROP POLICY IF EXISTS "Public update for listings" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for listings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own listing photos" ON storage.objects;

DROP POLICY IF EXISTS "Public Access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public update for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

DROP POLICY IF EXISTS "Public Access for posts" ON storage.objects;
DROP POLICY IF EXISTS "Public upload for posts" ON storage.objects;
DROP POLICY IF EXISTS "Public update for posts" ON storage.objects;
DROP POLICY IF EXISTS "Public delete for posts" ON storage.objects;

DROP POLICY IF EXISTS "Public view for public media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Chat participants can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own chat files" ON storage.objects;

-- 3. NOUVELLES POLITIQUES STRICTES

-- A. LECTURE PUBLIQUE POUR LES PHOTOS PUBLIQUES DU MARCHÉ ET DU FIL SOCIAL
CREATE POLICY "Public view for public media"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id IN ('listings', 'avatars', 'posts')
);

-- B. TÉLÉVERSEMENT : Utilisateur authentifié uniquement dans son propre dossier ${auth.uid()}
CREATE POLICY "Authenticated users can upload own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('listings', 'avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- C. MODIFICATION : Uniquement le propriétaire du fichier
CREATE POLICY "Users can update own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('listings', 'avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN ('listings', 'avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- D. SUPPRESSION : Uniquement le propriétaire du fichier
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('listings', 'avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- E. BUCKET PRIVÉ CHAT
CREATE POLICY "Chat participants can view chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id::text = (storage.foldername(name))[2]
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  )
);

CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own chat files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
