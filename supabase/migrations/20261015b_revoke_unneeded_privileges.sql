-- VIBE CHECK : retire des droits inutiles aux rôles publics. Non destructif, réexécutable.
-- (Proposé après l'audit du 2026-10-15 ; à appliquer après 20261015_vibe_hardening.sql.)

-- 1) Fonction interne de Supabase (déclencheur d'événement) : ne doit pas être appelable via l'API REST.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- 2) Droits de table inutiles : l'application passe uniquement par des fonctions RPC.
--    Les politiques RLS restent en place ; on retire seulement TRUNCATE / TRIGGER / REFERENCES.
revoke truncate, trigger, references on table
  public.answer_options, public.attempts, public.daily_challenges, public.entitlements,
  public.profiles, public.questions, public.quizzes, public.reports, public.responses
from anon, authenticated;
