-- Configuration de la tâche planifiée pg_cron dans Supabase
-- Exécute automatiquement la fonction import-facebook toutes les heures

-- 1. Activer l'extension pg_net et pg_cron si nécessaire
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Planifier l'appel HTTP vers la fonction Supabase Edge Function toutes les heures (à la minute 0)
SELECT cron.schedule(
  'sync-facebook-posts-hourly',
  '0 * * * *', -- Toutes les heures
  $$
  SELECT net.http_post(
    url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/import-facebook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'pg_cron')
  );
  $$
);

-- Note : L'application Node/Express Afrique Business intègre déjà un planificateur horaire automatique
-- équivalent actif en continu (startFacebookHourlyScheduler) sur le serveur.
