-- VIBE CHECK v11 : durcissement serveur.
-- À exécuter APRÈS 20261014_vibe_player_system.sql. Réexécutable sans risque.
-- Avant, lance supabase/audit_quiz_rpc.sql pour vérifier get_public_quiz / submit_public_quiz.

-- ───────────── 1) Pseudos : uniques, validés, jamais écrasés ─────────────
update public.vibe_player_stats s
set pseudo = left(s.pseudo, 19) || '#' || substr(md5(s.user_id::text), 1, 4)
from (
  select user_id, row_number() over (partition by lower(pseudo) order by created_at, user_id) as rn
  from public.vibe_player_stats
) d
where d.user_id = s.user_id and d.rn > 1;

create unique index if not exists vibe_player_stats_pseudo_uq
  on public.vibe_player_stats (lower(pseudo));

create or replace function public.vibe_clean_pseudo(p_pseudo text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := regexp_replace(trim(coalesce(p_pseudo, '')), '\s+', ' ', 'g');
begin
  if char_length(v) < 3 or char_length(v) > 24 then
    raise exception 'Le pseudo doit contenir entre 3 et 24 caractères.';
  end if;
  if v !~ '^[[:alnum:]][[:alnum:] _.-]*$' then
    raise exception 'Pseudo invalide : lettres, chiffres, espaces, point, tiret et underscore uniquement.';
  end if;
  if lower(v) in ('admin', 'administrateur', 'moderateur', 'modérateur', 'support', 'vibecheck', 'vibe check') then
    raise exception 'Ce pseudo est réservé.';
  end if;
  return v;
end; $$;

-- Crée la fiche joueur si besoin, avec un pseudo aléatoire unique (ex. Joueur4821).
create or replace function public.vibe_ensure_player(p_uid uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare tries integer := 0;
begin
  if exists (select 1 from public.vibe_player_stats where user_id = p_uid) then return; end if;
  loop
    begin
      insert into public.vibe_player_stats(user_id, pseudo)
      values (p_uid, 'Joueur' || lpad((floor(random() * 10000))::integer::text, 4, '0'))
      on conflict (user_id) do nothing;
      return;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 8 then raise; end if;
    end;
  end loop;
end; $$;

-- ───────────── 2) État joueur : ne modifie plus le pseudo ─────────────
drop function if exists public.vibe_get_player_state(text);

create or replace function public.vibe_get_player_state()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  perform public.vibe_ensure_player(uid);
  select jsonb_build_object(
    'pseudo', s.pseudo,
    'xp', s.xp,
    'completed_challenges', coalesce((select jsonb_agg(c.challenge_id) from public.vibe_daily_completions c
        where c.user_id = uid and c.challenge_date = (timezone('utc', now()))::date), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(i.item_id) from public.vibe_player_inventory i
        where i.user_id = uid), '[]'::jsonb)
  ) into result from public.vibe_player_stats s where s.user_id = uid;
  return result;
end; $$;

create or replace function public.vibe_set_pseudo(p_pseudo text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); v text;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  v := public.vibe_clean_pseudo(p_pseudo);
  perform public.vibe_ensure_player(uid);
  begin
    update public.vibe_player_stats set pseudo = v, updated_at = now() where user_id = uid;
  exception when unique_violation then
    raise exception 'Ce pseudo est déjà pris.';
  end;
  return jsonb_build_object('pseudo', v);
end; $$;

-- ───────────── 3) Récompenses : attribuées uniquement par le serveur ─────────────
-- Fonction interne (non appelable par le client). Gère aussi le bonus de 3 missions.
create or replace function public.vibe_grant_daily(p_uid uuid, p_challenge text, p_reward integer)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  today date := (timezone('utc', now()))::date;
  ins integer; done_count integer; bonus integer := 0;
begin
  perform 1 from public.vibe_player_stats where user_id = p_uid for update; -- sérialise par joueur
  insert into public.vibe_daily_completions(user_id, challenge_id, challenge_date, reward_xp)
  values (p_uid, p_challenge, today, p_reward) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then
    return jsonb_build_object('granted', false, 'reward_xp', 0, 'bonus_xp', 0);
  end if;
  update public.vibe_player_stats set xp = xp + p_reward, updated_at = now() where user_id = p_uid;
  insert into public.vibe_xp_events(user_id, amount, reason) values (p_uid, p_reward, 'challenge:' || p_challenge);

  select count(*) into done_count from public.vibe_daily_completions
   where user_id = p_uid and challenge_date = today;
  if done_count >= 3 and not exists (
    select 1 from public.vibe_xp_events where user_id = p_uid and reason = 'bonus:streak:' || today::text
  ) then
    bonus := 50;
    update public.vibe_player_stats set xp = xp + bonus, updated_at = now() where user_id = p_uid;
    insert into public.vibe_xp_events(user_id, amount, reason) values (p_uid, bonus, 'bonus:streak:' || today::text);
  end if;
  return jsonb_build_object('granted', true, 'reward_xp', p_reward, 'bonus_xp', bonus);
end; $$;

-- Le client ne peut plus réclamer que « explore ». quiz/perfect passent par vibe_submit_quiz.
create or replace function public.vibe_complete_daily_challenge(p_challenge_id text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); g jsonb; new_xp integer;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  if p_challenge_id in ('quiz', 'perfect') then
    raise exception 'Cette mission est validée automatiquement à la fin d’un quiz.';
  end if;
  if p_challenge_id is distinct from 'explore' then raise exception 'Défi inconnu.'; end if;
  perform public.vibe_ensure_player(uid);
  g := public.vibe_grant_daily(uid, 'explore', 25);
  select xp into new_xp from public.vibe_player_stats where user_id = uid;
  return jsonb_build_object('xp', new_xp, 'reward_xp', (g->>'reward_xp')::integer,
    'bonus_xp', (g->>'bonus_xp')::integer, 'already_completed', not (g->>'granted')::boolean);
end; $$;

-- Envoie le quiz ET attribue les récompenses d'après le score calculé par le serveur.
create or replace function public.vibe_submit_quiz(p_slug text, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid(); v_pseudo text; r jsonb; v_score integer; v_total integer;
  g_quiz jsonb := '{"reward_xp":0,"bonus_xp":0}'; g_perfect jsonb := '{"reward_xp":0,"bonus_xp":0}';
  has_answer boolean; new_xp integer;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  if p_slug is null or char_length(p_slug) > 80 then raise exception 'Quiz invalide.'; end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) not between 1 and 100 then
    raise exception 'Réponses invalides.';
  end if;
  perform public.vibe_ensure_player(uid);
  select pseudo into v_pseudo from public.vibe_player_stats where user_id = uid;

  -- Fonction existante : le score est calculé côté serveur, pas par le client.
  -- submit_public_quiz renvoie directement du jsonb ({score, total_questions, ...}).
  r := to_jsonb(public.submit_public_quiz(p_slug, v_pseudo, p_answers));

  v_score := case when (r->>'score') ~ '^\d+$' then (r->>'score')::integer
                  when (r->>'correct_answers') ~ '^\d+$' then (r->>'correct_answers')::integer end;
  v_total := case when (r->>'total_questions') ~ '^\d+$' then (r->>'total_questions')::integer
                  else jsonb_array_length(p_answers) end;

  select exists (select 1 from jsonb_array_elements(p_answers) a where a->>'selected_option_id' is not null)
    into has_answer;

  if has_answer then
    g_quiz := public.vibe_grant_daily(uid, 'quiz', 25);
    if v_score is not null and v_total > 0 and v_score = v_total then
      g_perfect := public.vibe_grant_daily(uid, 'perfect', 40);
    end if;
  end if;

  select xp into new_xp from public.vibe_player_stats where user_id = uid;
  return jsonb_build_object(
    'score', coalesce(v_score, 0), 'total', v_total, 'xp', new_xp,
    'reward_xp', (g_quiz->>'reward_xp')::integer + (g_perfect->>'reward_xp')::integer,
    'bonus_xp', (g_quiz->>'bonus_xp')::integer + (g_perfect->>'bonus_xp')::integer,
    'completed_challenges', coalesce((select jsonb_agg(c.challenge_id) from public.vibe_daily_completions c
        where c.user_id = uid and c.challenge_date = (timezone('utc', now()))::date), '[]'::jsonb)
  );
end; $$;

-- ───────────── 4) Classement : XP gagnés (acheter ne fait plus perdre de rang) ─────────────
create or replace function public.vibe_get_leaderboard(p_period text default 'global')
returns table(rank bigint, pseudo text, level integer, xp bigint)
language sql security definer set search_path = public, auth as $$
  with params as (
    select case lower(coalesce(p_period, 'global'))
             when 'jour' then 'day' when 'day' then 'day'
             when 'semaine' then 'week' when 'week' then 'week'
             else 'global' end as period,
           date_trunc('day', now() at time zone 'utc') as day_start,
           date_trunc('week', now() at time zone 'utc') as week_start
  ), totals as (
    select s.pseudo,
      (s.xp + coalesce(sum(-e.amount) filter (where e.amount < 0), 0))::bigint as lifetime,
      (case p.period
        when 'day'  then coalesce(sum(e.amount) filter (where e.amount > 0 and (e.created_at at time zone 'utc') >= p.day_start), 0)
        when 'week' then coalesce(sum(e.amount) filter (where e.amount > 0 and (e.created_at at time zone 'utc') >= p.week_start), 0)
        else s.xp + coalesce(sum(-e.amount) filter (where e.amount < 0), 0)
      end)::bigint as score
    from public.vibe_player_stats s
    cross join params p
    left join public.vibe_xp_events e on e.user_id = s.user_id
    group by s.user_id, s.pseudo, s.xp, p.period, p.day_start, p.week_start
  )
  select row_number() over (order by t.score desc, t.pseudo asc),
         t.pseudo,
         greatest(1, (t.lifetime / 300)::integer + 1),
         t.score
  from totals t
  where t.score > 0
  order by t.score desc, t.pseudo asc
  limit 10;
$$;

-- ───────────── 5) Droits ─────────────
revoke all on function public.vibe_clean_pseudo(text) from public, anon, authenticated;
revoke all on function public.vibe_ensure_player(uuid) from public, anon, authenticated;
revoke all on function public.vibe_grant_daily(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.vibe_get_player_state() from public, anon;
revoke all on function public.vibe_set_pseudo(text) from public, anon;
revoke all on function public.vibe_submit_quiz(text, jsonb) from public, anon;
revoke all on function public.vibe_complete_daily_challenge(text) from public, anon;
revoke all on function public.vibe_purchase_reward(text) from public, anon;
revoke all on function public.vibe_get_leaderboard(text) from public, anon;
grant execute on function public.vibe_get_player_state() to authenticated;
grant execute on function public.vibe_set_pseudo(text) to authenticated;
grant execute on function public.vibe_submit_quiz(text, jsonb) to authenticated;
grant execute on function public.vibe_complete_daily_challenge(text) to authenticated;
grant execute on function public.vibe_purchase_reward(text) to authenticated;
grant execute on function public.vibe_get_leaderboard(text) to authenticated;
