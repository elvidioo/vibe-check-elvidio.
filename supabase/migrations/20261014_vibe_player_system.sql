-- VIBE CHECK: portefeuille XP, défis journaliers, inventaire et classement.
-- À exécuter dans Supabase SQL Editor après avoir activé Anonymous Sign-Ins dans Auth > Providers.

create table if not exists public.vibe_player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pseudo text not null default 'Joueur' check (char_length(pseudo) between 1 and 24),
  xp integer not null default 120 check (xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vibe_xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vibe_daily_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null check (challenge_id in ('quiz','perfect','explore')),
  challenge_date date not null default (timezone('utc', now()))::date,
  reward_xp integer not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, challenge_id, challenge_date)
);

create table if not exists public.vibe_shop_catalog (
  item_id text primary key,
  item_name text not null,
  cost_xp integer not null check (cost_xp >= 0),
  enabled boolean not null default true
);

create table if not exists public.vibe_player_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.vibe_shop_catalog(item_id),
  purchased_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

insert into public.vibe_shop_catalog(item_id, item_name, cost_xp) values
  ('aura', 'Neon Aura', 150),
  ('frame', 'Cadre Cyber', 80),
  ('badge', 'Badge Élite', 100),
  ('trail', 'Trace éclair', 120),
  ('avatar', 'Avatar Pixel', 60)
on conflict (item_id) do update set item_name = excluded.item_name, cost_xp = excluded.cost_xp, enabled = true;

alter table public.vibe_player_stats enable row level security;
alter table public.vibe_xp_events enable row level security;
alter table public.vibe_daily_completions enable row level security;
alter table public.vibe_shop_catalog enable row level security;
alter table public.vibe_player_inventory enable row level security;

-- Les tables privées ne donnent aucun accès direct au client. Les écritures passent par RPC.
revoke all on public.vibe_player_stats from anon, authenticated;
revoke all on public.vibe_xp_events from anon, authenticated;
revoke all on public.vibe_daily_completions from anon, authenticated;
revoke all on public.vibe_shop_catalog from anon, authenticated;
revoke all on public.vibe_player_inventory from anon, authenticated;

create or replace function public.vibe_get_player_state(p_pseudo text default 'Joueur')
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  insert into public.vibe_player_stats(user_id, pseudo) values (uid, coalesce(nullif(left(trim(p_pseudo),24),''),'Joueur'))
  on conflict (user_id) do update set pseudo = excluded.pseudo, updated_at = now();
  select jsonb_build_object(
    'pseudo', s.pseudo,
    'xp', s.xp,
    'completed_challenges', coalesce((select jsonb_agg(c.challenge_id) from public.vibe_daily_completions c where c.user_id=uid and c.challenge_date=(timezone('utc',now()))::date), '[]'::jsonb),
    'inventory', coalesce((select jsonb_agg(i.item_id) from public.vibe_player_inventory i where i.user_id=uid), '[]'::jsonb)
  ) into result from public.vibe_player_stats s where s.user_id=uid;
  return result;
end; $$;

create or replace function public.vibe_complete_daily_challenge(p_challenge_id text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); reward integer; inserted_count integer; new_xp integer;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  reward := case p_challenge_id when 'quiz' then 25 when 'perfect' then 40 when 'explore' then 25 else null end;
  if reward is null then raise exception 'Défi inconnu.'; end if;
  insert into public.vibe_player_stats(user_id, pseudo) values (uid, 'Joueur') on conflict (user_id) do nothing;
  insert into public.vibe_daily_completions(user_id, challenge_id, challenge_date, reward_xp)
  values (uid, p_challenge_id, (timezone('utc',now()))::date, reward)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then
    update public.vibe_player_stats set xp=xp+reward, updated_at=now() where user_id=uid;
    insert into public.vibe_xp_events(user_id,amount,reason) values(uid,reward,'challenge:'||p_challenge_id);
  end if;
  select xp into new_xp from public.vibe_player_stats where user_id=uid;
  return jsonb_build_object('xp',new_xp,'reward_xp',case when inserted_count > 0 then reward else 0 end,'already_completed',inserted_count = 0);
end; $$;

create or replace function public.vibe_purchase_reward(p_item_id text)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); cost integer; current_xp integer; owned boolean;
begin
  if uid is null then raise exception 'Session joueur requise.'; end if;
  select cost_xp into cost from public.vibe_shop_catalog where item_id=p_item_id and enabled=true;
  if cost is null then raise exception 'Objet indisponible.'; end if;
  insert into public.vibe_player_stats(user_id,pseudo) values(uid,'Joueur') on conflict(user_id) do nothing;
  select exists(select 1 from public.vibe_player_inventory where user_id=uid and item_id=p_item_id) into owned;
  if not owned then
    select xp into current_xp from public.vibe_player_stats where user_id=uid for update;
    if current_xp < cost then raise exception 'XP insuffisants.'; end if;
    update public.vibe_player_stats set xp=xp-cost, updated_at=now() where user_id=uid;
    insert into public.vibe_player_inventory(user_id,item_id) values(uid,p_item_id);
    insert into public.vibe_xp_events(user_id,amount,reason) values(uid,-cost,'purchase:'||p_item_id);
  end if;
  select xp into current_xp from public.vibe_player_stats where user_id=uid;
  return jsonb_build_object('xp',current_xp,'already_owned',owned,'item_id',p_item_id);
end; $$;

create or replace function public.vibe_get_leaderboard(p_period text default 'global')
returns table(rank bigint, pseudo text, level integer, xp bigint)
language sql security definer set search_path = public, auth as $$
  with totals as (
    select s.user_id, s.pseudo,
      case lower(coalesce(p_period,'global'))
        when 'jour' then coalesce(sum(e.amount) filter (where e.created_at >= date_trunc('day',now())),0)
        when 'day' then coalesce(sum(e.amount) filter (where e.created_at >= date_trunc('day',now())),0)
        when 'semaine' then coalesce(sum(e.amount) filter (where e.created_at >= date_trunc('week',now())),0)
        when 'week' then coalesce(sum(e.amount) filter (where e.created_at >= date_trunc('week',now())),0)
        else s.xp
      end::bigint as score
    from public.vibe_player_stats s left join public.vibe_xp_events e on e.user_id=s.user_id
    group by s.user_id,s.pseudo,s.xp
  )
  select row_number() over(order by t.score desc,t.pseudo asc), t.pseudo,
    greatest(1, floor(greatest(t.score,0)/300.0)::integer+1), greatest(t.score,0)
  from totals t order by t.score desc,t.pseudo asc limit 10;
$$;

revoke all on function public.vibe_get_player_state(text) from public;
revoke all on function public.vibe_complete_daily_challenge(text) from public;
revoke all on function public.vibe_purchase_reward(text) from public;
revoke all on function public.vibe_get_leaderboard(text) from public;
grant execute on function public.vibe_get_player_state(text) to authenticated;
grant execute on function public.vibe_complete_daily_challenge(text) to authenticated;
grant execute on function public.vibe_purchase_reward(text) to authenticated;
grant execute on function public.vibe_get_leaderboard(text) to authenticated;
