-- ============================================================================
-- AFRIQUE BUSINESS : POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS) STRICTES
-- Domaine de production : https://afrique-afrique.com
-- ============================================================================
-- Ce script configure des règles de sécurité granulaires, adaptées à la structure
-- réelle de la base de données.
--
-- RÈGLES FONDAMENTALES RESPECTÉES :
-- 1. Lecture publique des annonces, profils et posts (pour les visiteurs et acheteurs).
-- 2. Création STRICTEMENT réservée aux utilisateurs authentifiés avec vérification d'identité (auth.uid() = user_id).
-- 3. Modification et suppression STRICTEMENT réservées au propriétaire authentifié.
-- 4. Protection intégrale des profils et données privées (profile_private).
-- 5. Téléversement de photos restreint aux utilisateurs authentifiés dans leur propre dossier racine (auth.uid()::text).
-- 6. AUCUNE modification de auth.users (préservation totale des comptes et des états de confirmation).
-- 7. AUCUNE suppression de données (aucune annonce, profil, post ou photo n'est supprimé).
-- ============================================================================


-- ============================================================================
-- 1. TABLE public.listings (ANNONCES DU MARCHÉ)
-- ============================================================================
-- Colonne propriétaire : user_id (UUID faisant référence à auth.users.id)
-- Relations : user_id -> profiles.id
ALTER TABLE IF EXISTS public.listings ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques sur listings
DROP POLICY IF EXISTS "Public can view listings" ON public.listings;
DROP POLICY IF EXISTS "Anyone can read listings" ON public.listings;
DROP POLICY IF EXISTS "Allow public read listings" ON public.listings;
DROP POLICY IF EXISTS "Users can view listings" ON public.listings;
DROP POLICY IF EXISTS "Public can view active listings or own listings" ON public.listings;

DROP POLICY IF EXISTS "Users can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Authenticated users can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Users can insert their own listings" ON public.listings;
DROP POLICY IF EXISTS "Allow public insert listings" ON public.listings;
DROP POLICY IF EXISTS "Authenticated users can create own listings" ON public.listings;

DROP POLICY IF EXISTS "Users can update listings" ON public.listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
DROP POLICY IF EXISTS "Allow public update listings" ON public.listings;
DROP POLICY IF EXISTS "Authenticated owners can update own listings" ON public.listings;

DROP POLICY IF EXISTS "Users can delete listings" ON public.listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;
DROP POLICY IF EXISTS "Allow public delete listings" ON public.listings;
DROP POLICY IF EXISTS "Authenticated owners can delete own listings" ON public.listings;

-- SELECT : Lecture publique de toutes les annonces actives (acheteurs/visiteurs),
-- et lecture de ses propres annonces pour le vendeur quel que soit le statut.
CREATE POLICY "Public can view active listings or own listings"
ON public.listings FOR SELECT
TO public
USING (
  status = 'active' 
  OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

-- INSERT : Seul un utilisateur authentifié peut créer une annonce,
-- et user_id doit OBLIGATOIREMENT être son propre auth.uid().
CREATE POLICY "Authenticated users can create own listings"
ON public.listings FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
);

-- UPDATE : Seul le propriétaire authentifié de l'annonce peut la modifier.
CREATE POLICY "Authenticated owners can update own listings"
ON public.listings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE : Seul le propriétaire authentifié de l'annonce peut la supprimer.
CREATE POLICY "Authenticated owners can delete own listings"
ON public.listings FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- ============================================================================
-- 2. TABLE public.profiles (PROFILS UTILISATEURS PUBLICS)
-- ============================================================================
-- Colonne propriétaire : id (UUID clé primaire = auth.users.id)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques sur profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile only" ON public.profiles;

-- SELECT : Tout le monde peut voir les profils des vendeurs et membres
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
TO public
USING (true);

-- INSERT : Un utilisateur authentifié peut créer uniquement son propre profil (id = auth.uid())
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- UPDATE : Seul l'utilisateur authentifié peut modifier ses propres informations
CREATE POLICY "Users can update own profile only"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- DELETE : Seul l'utilisateur authentifié peut supprimer son propre profil
CREATE POLICY "Users can delete own profile only"
ON public.profiles FOR DELETE
TO authenticated
USING (auth.uid() = id);


-- ============================================================================
-- 3. TABLE public.profile_private (DONNÉES PRIVÉES & NUMÉROS CONFIDENTIELS)
-- ============================================================================
-- Colonne propriétaire : id (UUID = auth.users.id)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profile_private') THEN
    ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read profile_private" ON public.profile_private;
    DROP POLICY IF EXISTS "Allow public insert profile_private" ON public.profile_private;
    DROP POLICY IF EXISTS "Allow public update profile_private" ON public.profile_private;
    DROP POLICY IF EXISTS "Users can view own private profile" ON public.profile_private;
    DROP POLICY IF EXISTS "Users can insert own private profile" ON public.profile_private;
    DROP POLICY IF EXISTS "Users can update own private profile" ON public.profile_private;
    DROP POLICY IF EXISTS "Users can delete own private profile" ON public.profile_private;

    -- SELECT : Seul le propriétaire authentifié peut lire ses données privées
    CREATE POLICY "Users can view own private profile"
    ON public.profile_private FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

    -- INSERT : Seul le propriétaire authentifié peut insérer ses données privées
    CREATE POLICY "Users can insert own private profile"
    ON public.profile_private FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

    -- UPDATE : Seul le propriétaire authentifié peut mettre à jour ses données privées
    CREATE POLICY "Users can update own private profile"
    ON public.profile_private FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

    -- DELETE : Seul le propriétaire authentifié peut supprimer ses données privées
    CREATE POLICY "Users can delete own private profile"
    ON public.profile_private FOR DELETE
    TO authenticated
    USING (auth.uid() = id);
  END IF;
END $$;


-- ============================================================================
-- 4. TABLES SOCIALES (posts, comments, post_likes)
-- ============================================================================
DO $$ 
BEGIN
  -- Table posts (Publications)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'posts') THEN
    ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read posts" ON public.posts;
    DROP POLICY IF EXISTS "Allow public insert posts" ON public.posts;
    DROP POLICY IF EXISTS "Allow public update posts" ON public.posts;
    DROP POLICY IF EXISTS "Allow public delete posts" ON public.posts;
    DROP POLICY IF EXISTS "Public can view posts" ON public.posts;
    DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
    DROP POLICY IF EXISTS "Authors can update own posts" ON public.posts;
    DROP POLICY IF EXISTS "Authors can delete own posts" ON public.posts;

    CREATE POLICY "Public can view posts" ON public.posts FOR SELECT TO public USING (true);
    CREATE POLICY "Authenticated users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Authors can update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Authors can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;

  -- Table comments (Commentaires)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comments') THEN
    ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public can view comments" ON public.comments;
    DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
    DROP POLICY IF EXISTS "Authors can update own comments" ON public.comments;
    DROP POLICY IF EXISTS "Authors can delete own comments" ON public.comments;

    CREATE POLICY "Public can view comments" ON public.comments FOR SELECT TO public USING (true);
    CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Authors can update own comments" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Authors can delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;

  -- Table post_likes (Mentions J'aime)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'post_likes') THEN
    ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public can view post_likes" ON public.post_likes;
    DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.post_likes;
    DROP POLICY IF EXISTS "Users can remove own likes" ON public.post_likes;

    CREATE POLICY "Public can view post_likes" ON public.post_likes FOR SELECT TO public USING (true);
    CREATE POLICY "Authenticated users can like posts" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can remove own likes" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;

  -- Table favorites (Favoris d'annonces)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'favorites') THEN
    ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
    DROP POLICY IF EXISTS "Users can add own favorites" ON public.favorites;
    DROP POLICY IF EXISTS "Users can remove own favorites" ON public.favorites;

    CREATE POLICY "Users can view own favorites" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
    CREATE POLICY "Users can add own favorites" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    CREATE POLICY "Users can remove own favorites" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================================
-- 5. TABLES MESSAGERIE (conversations, messages)
-- ============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'conversations') THEN
    ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Allow public insert conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Participants can create conversations" ON public.conversations;
    DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

    CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
    CREATE POLICY "Participants can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
    CREATE POLICY "Participants can update conversations" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read messages" ON public.messages;
    DROP POLICY IF EXISTS "Allow public insert messages" ON public.messages;
    DROP POLICY IF EXISTS "Conversation participants can view messages" ON public.messages;
    DROP POLICY IF EXISTS "Sender can insert message in own conversation" ON public.messages;

    DROP POLICY IF EXISTS "Participants can update messages in own conversation" ON public.messages;

    CREATE POLICY "Conversation participants can view messages" 
    ON public.messages FOR SELECT 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = conversation_id 
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    );

    CREATE POLICY "Sender can insert message in own conversation" 
    ON public.messages FOR INSERT 
    TO authenticated 
    WITH CHECK (
      auth.uid() = sender_id
      AND EXISTS (
        SELECT 1 FROM public.conversations c 
        WHERE c.id = conversation_id 
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    );

    CREATE POLICY "Participants can update messages in own conversation"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
      )
    );
  END IF;
END $$;


-- ============================================================================
-- 5B. MODÉRATION & ASSISTANCE (blocks, reports, support_tickets)
-- ============================================================================
-- Aucune donnée de signalement, blocage ou ticket support ne doit être lisible publiquement.
DO $$
BEGIN
  -- Table blocks (blocker_id, blocked_id)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocks') THEN
    ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read blocks" ON public.blocks;
    DROP POLICY IF EXISTS "Users can view own blocks" ON public.blocks;
    DROP POLICY IF EXISTS "Users can create own blocks" ON public.blocks;
    DROP POLICY IF EXISTS "Users can delete own blocks" ON public.blocks;

    CREATE POLICY "Users can view own blocks"
    ON public.blocks FOR SELECT
    TO authenticated
    USING (auth.uid() = blocker_id);

    CREATE POLICY "Users can create own blocks"
    ON public.blocks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = blocker_id AND blocker_id <> blocked_id);

    CREATE POLICY "Users can delete own blocks"
    ON public.blocks FOR DELETE
    TO authenticated
    USING (auth.uid() = blocker_id);
  END IF;

  -- Table reports (reporter_id, target_type, target_id, reason, details)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reports') THEN
    ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read reports" ON public.reports;
    DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
    DROP POLICY IF EXISTS "Users can submit reports" ON public.reports;

    CREATE POLICY "Users can view own reports"
    ON public.reports FOR SELECT
    TO authenticated
    USING (auth.uid() = reporter_id);

    CREATE POLICY "Users can submit reports"
    ON public.reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = reporter_id);
  END IF;

  -- Table support_tickets (user_id, kind, subject, message, status)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_tickets') THEN
    ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read support_tickets" ON public.support_tickets;
    DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
    DROP POLICY IF EXISTS "Users can create own support tickets" ON public.support_tickets;

    CREATE POLICY "Users can view own support tickets"
    ON public.support_tickets FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

    CREATE POLICY "Users can create own support tickets"
    ON public.support_tickets FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================================
-- 5C. INDEXES NON DESTRUCTIFS POUR PERFORMANCES & FIABILITÉ
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_listings_country_status_created ON public.listings (country, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON public.listings (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created ON public.comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at ASC);


-- ============================================================================
-- 6. SUPABASE STORAGE : POLITIQUES DE STOCKAGE GRANULAIRES ET SÉCURISÉES
-- ============================================================================
-- Structure des dossiers utilisée par l'application :
-- Bucket listings : ${user_id}/${filename}.webp
-- Bucket avatars  : ${user_id}/${filename}.webp
-- Bucket posts    : ${user_id}/${filename}.webp
-- Bucket chat     : ${user_id}/${conversation_id}/${filename}.webp

-- 1. Configuration des buckets
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

-- 2. Nettoyage de toutes les anciennes politiques sur storage.objects
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

-- 3. Nouvelles politiques de stockage strictes

-- A. LECTURE PUBLIQUE DES PHOTOS DU MARCHÉ ET DU FIL (listings, avatars, posts)
-- Tout acheteur et visiteur doit pouvoir afficher les photos des annonces et avatars
CREATE POLICY "Public view for public media"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id IN ('listings', 'avatars', 'posts')
);

-- B. TÉLÉVERSEMENT : Uniquement utilisateur authentifié dans son propre dossier ${auth.uid()}
-- Interdit formellement tout téléversement anonyme ou dans le dossier d'un autre utilisateur
CREATE POLICY "Authenticated users can upload own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('listings', 'avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- C. MODIFICATION : Seul le propriétaire authentifié du fichier peut le remplacer
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

-- D. SUPPRESSION : Seul le propriétaire authentifié du fichier peut le supprimer
CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('listings', 'avatars', 'posts')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- E. BUCKET PRIVÉ CHAT
-- Seuls les participants authentifiés de la discussion peuvent voir leurs pièces jointes
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
