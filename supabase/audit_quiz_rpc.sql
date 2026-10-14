-- Audit en lecture seule des fonctions de quiz qui ne sont pas dans les migrations.
-- À lancer dans le SQL Editor de Supabase, puis relire les résultats.

-- 1) Code des deux fonctions : vérifie que get_public_quiz ne renvoie PAS les bonnes réponses
--    (champs du type is_correct, correct_option_id, answer…) et que submit_public_quiz calcule le score.
select p.proname, pg_get_function_arguments(p.oid) as args, pg_get_function_result(p.oid) as returns,
       p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('get_public_quiz', 'submit_public_quiz');

-- 2) Colonnes sensibles dans le schéma public
select table_name, column_name from information_schema.columns
where table_schema = 'public' and (column_name ilike '%correct%' or column_name ilike '%answer%');

-- 3) Tables publiques sans RLS (doit être vide pour les tables de quiz)
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 4) Droits directs de anon / authenticated sur les tables (doit être vide pour les tables de quiz)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');
