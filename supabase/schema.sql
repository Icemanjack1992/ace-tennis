-- =====================================================================
-- Ace Tennis — database schema for Supabase (PostgreSQL)
-- Run once in Supabase → SQL Editor. Safe to re-run on an empty project.
-- All rating math mirrors js/rating.js and js/logic.js.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('player','coach','admin')),
  first_name text not null default '',
  last_name text not null default '',
  photo_url text,
  gender text default '',
  birth_year int,
  district text default '',
  years int default 0,
  self_level text default '',
  hand text default '',
  availability text[] not null default '{}',
  phone text,
  rating int not null default 1000,
  matches int not null default 0,
  wins int not null default 0,
  form text not null default '',
  league text not null default 'novice',
  points_q int not null default 0,
  points_y int not null default 0,
  q_key text not null default to_char(now(),'YYYY') || '-Q' || to_char(now(),'Q'),
  y_key text not null default to_char(now(),'YYYY'),
  fp_sum numeric not null default 0,
  fp_count int not null default 0,
  banned_until timestamptz,
  top10_days int not null default 0,
  top1_days int not null default 0,
  coach_verified boolean not null default false,
  coach jsonb,              -- {price, specialization[], worksWith, experience}
  lang text not null default 'ru',
  created_at timestamptz not null default now()
);

create table if not exists public.coach_invites (
  phone text primary key,
  first_name text, last_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  league text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  sponsor text default '',
  status text not null default 'registration' check (status in ('registration','running','finished')),
  bracket jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_entries (
  tournament_id uuid references public.tournaments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'single' check (type in ('single','double')),
  team_a uuid[] not null,
  team_b uuid[] not null,
  sets jsonb not null,                 -- [[6,4],[3,6],[10,8]] from team A perspective
  decider text not null default 'set', -- 'set' | 'supertb'
  played_at timestamptz not null,
  created_by uuid not null references public.profiles(id),
  tournament_id uuid references public.tournaments(id),
  round text,
  status text not null default 'pending' check (status in ('pending','confirmed','disputed','cancelled')),
  winner text,
  deltas jsonb not null default '{}',
  points jsonb not null default '{}',
  deadline timestamptz not null default now() + interval '48 hours',
  expired boolean not null default false,
  complained boolean not null default false,
  dispute_reason text,
  disputed_by uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists matches_team_a_idx on public.matches using gin (team_a);
create index if not exists matches_team_b_idx on public.matches using gin (team_b);
create index if not exists matches_status_idx on public.matches (status, deadline);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id),
  coach_id uuid references public.profiles(id),
  hours numeric not null check (hours > 0 and hours <= 8),
  skills text[] not null default '{}',
  note text default '',
  played_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','disputed','cancelled')),
  deadline timestamptz not null default now() + interval '48 hours',
  expired boolean not null default false,
  dispute_reason text,
  created_at timestamptz not null default now()
);
create index if not exists trainings_player_idx on public.trainings (player_id);
create index if not exists trainings_coach_idx on public.trainings (coach_id);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id),
  to_id uuid not null references public.profiles(id),
  at timestamptz not null,
  format text not null default 'single',
  note text default '',
  status text not null default 'sent' check (status in ('sent','accepted','declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id),
  author_id uuid not null references public.profiles(id),
  stars numeric not null check (stars between 1 and 5),
  text text default '',
  created_at timestamptz not null default now(),
  unique (coach_id, author_id)
);

create table if not exists public.fairplay (
  id uuid primary key default gen_random_uuid(),
  ref_kind text not null, ref_id uuid not null,
  rater_id uuid not null references public.profiles(id),
  ratee_id uuid not null references public.profiles(id),
  stars int not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (ref_id, rater_id)
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  reason text not null,
  ref_id uuid,
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  reply text default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  section text not null default 'community' check (section in ('tournaments','season','community')),
  photos text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  text text not null check (length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  title text not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, code, detail)
);

-- ---------------------------------------------------------------------
-- Pure helpers (same formulas as js/rating.js)
-- ---------------------------------------------------------------------
create or replace function public.k_factor(p_matches int) returns int
language sql immutable as $$ select case when p_matches < 10 then 32 else 16 end $$;

create or replace function public.elo_delta(p_own numeric, p_opp numeric, p_score int, p_matches int) returns int
language sql immutable as $$
  select floor(k_factor(p_matches) * (p_score - 1 / (1 + power(10::numeric, (p_opp - p_own) / 400))) + 0.5)::int
$$;

create or replace function public.league_for(p_rating int, p_matches int) returns text
language sql immutable as $$
  select case when p_matches < 5 then 'novice'
              when p_rating >= 1150 then 'masters'
              when p_rating >= 1050 then 'gold'
              when p_rating >= 950 then 'silver'
              else 'bronze' end
$$;

create or replace function public.league_rank(p_league text) returns int
language sql immutable as $$
  select array_position(array['novice','bronze','silver','gold','masters'], p_league) - 1
$$;

create or replace function public.season_points(p_won boolean, p_beat_higher boolean, p_tournament boolean, p_farmed boolean) returns int
language sql immutable as $$
  select case when p_farmed then 0 else
    (10 + case when p_won then 20 else 0 end + case when p_won and p_beat_higher then 15 else 0 end)
    * case when p_tournament then 2 else 1 end end
$$;

create or replace function public.winner_from_sets(p_sets jsonb) returns text
language plpgsql immutable as $$
declare s jsonb; a int := 0; b int := 0;
begin
  for s in select * from jsonb_array_elements(p_sets) loop
    if (s->>0)::int > (s->>1)::int then a := a + 1;
    elsif (s->>1)::int > (s->>0)::int then b := b + 1; end if;
  end loop;
  if a = b then return null; end if;
  return case when a > b then 'A' else 'B' end;
end $$;

create or replace function public.current_q() returns text language sql stable as
$$ select to_char(now(),'YYYY') || '-Q' || to_char(now(),'Q') $$;
create or replace function public.current_y() returns text language sql stable as
$$ select to_char(now(),'YYYY') $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and banned_until > now())
$$;

create or replace function public.grant_achievement(p_user uuid, p_code text, p_title text, p_detail text default '')
returns void language sql security definer set search_path = public as $$
  insert into achievements(user_id, code, title, detail) values (p_user, p_code, p_title, coalesce(p_detail,''))
  on conflict (user_id, code, detail) do nothing
$$;

-- ---------------------------------------------------------------------
-- New user → profile (coach invite by phone turns the role into coach)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv coach_invites;
begin
  select * into inv from coach_invites where phone = new.phone;
  insert into profiles(id, phone, role, first_name, last_name, coach_verified, coach)
  values (new.id, new.phone,
          case when inv.phone is not null then 'coach' else 'player' end,
          coalesce(inv.first_name,''), coalesce(inv.last_name,''),
          inv.phone is not null,
          case when inv.phone is not null then '{}'::jsonb end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Core: apply a confirmed match (rating, points, form, league, achievements)
-- ---------------------------------------------------------------------
create or replace function public._apply_match(p_match uuid, p_by uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m matches; w text; ra numeric; rb numeric; rank_a int; rank_b int;
  pid uuid; on_a boolean; won boolean; d int; p int; opp uuid[]; same_cnt int; own_rank int; opp_rank int;
  prof profiles; v_deltas jsonb := '{}'; v_points jsonb := '{}';
begin
  select * into m from matches where id = p_match for update;
  w := winner_from_sets(m.sets);
  if w is null then raise exception 'Счёт по сетам не определяет победителя'; end if;

  update profiles set points_q = 0, q_key = current_q(),
         league = case when matches >= 5 then league_for(rating, matches) else league end
   where id = any(m.team_a || m.team_b) and q_key <> current_q();
  update profiles set points_y = 0, y_key = current_y()
   where id = any(m.team_a || m.team_b) and y_key <> current_y();

  select avg(rating) into ra from profiles where id = any(m.team_a);
  select avg(rating) into rb from profiles where id = any(m.team_b);
  select max(league_rank(league)) into rank_a from profiles where id = any(m.team_a);
  select max(league_rank(league)) into rank_b from profiles where id = any(m.team_b);

  foreach pid in array (m.team_a || m.team_b) loop
    select * into prof from profiles where id = pid for update;
    on_a := pid = any(m.team_a);
    won := (w = 'A') = on_a;
    d := elo_delta(case when on_a then ra else rb end, case when on_a then rb else ra end,
                   case when won then 1 else 0 end, prof.matches);
    opp := case when on_a then m.team_b else m.team_a end;
    select count(*) into same_cnt from matches x
     where x.status = 'confirmed' and x.id <> m.id
       and date_trunc('month', x.played_at) = date_trunc('month', m.played_at)
       and pid = any(x.team_a || x.team_b) and (x.team_a || x.team_b) && opp;
    own_rank := league_rank(prof.league);
    opp_rank := case when on_a then rank_b else rank_a end;
    p := season_points(won, opp_rank > own_rank, m.tournament_id is not null, same_cnt >= 2);

    update profiles set
      rating = rating + d,
      matches = matches + 1,
      wins = wins + case when won then 1 else 0 end,
      form = left((case when won then 'В' else 'П' end) || form, 5),
      points_q = points_q + p,
      points_y = points_y + p,
      league = case when league = 'novice' and matches + 1 >= 5 then league_for(rating + d, matches + 1) else league end
    where id = pid returning * into prof;

    v_deltas := v_deltas || jsonb_build_object(pid::text, d);
    v_points := v_points || jsonb_build_object(pid::text, p);

    if left(prof.form, 5) = 'ВВВВВ' then perform grant_achievement(pid, 'streak5', 'Серия 5 побед'); end if;
    if prof.matches in (10, 50, 100) then perform grant_achievement(pid, 'matches' || prof.matches, prof.matches || ' матчей'); end if;
    if won and opp_rank > own_rank then perform grant_achievement(pid, 'giant', 'Победа над лигой выше'); end if;
  end loop;

  update matches set status = 'confirmed', winner = w, deltas = v_deltas, points = v_points,
         confirmed_by = p_by, confirmed_at = now()
   where id = m.id;

  if m.tournament_id is not null then perform _advance_bracket(m.tournament_id, m.id); end if;
end $$;

create or replace function public.confirm_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m matches; confirmers uuid[];
begin
  select * into m from matches where id = p_match;
  if m.id is null then raise exception 'Матч не найден'; end if;
  if m.status <> 'pending' then raise exception 'Запись уже обработана'; end if;
  confirmers := case when m.created_by = any(m.team_a) then m.team_b else m.team_a end;
  if not (auth.uid() = any(confirmers)) then raise exception 'Подтвердить может только соперник'; end if;
  perform _apply_match(p_match, auth.uid());
end $$;

create or replace function public.confirm_training(p_training uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update trainings set status = 'confirmed'
   where id = p_training and coach_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Подтвердить может только тренер'; end if;
end $$;

create or replace function public.dispute_record(p_kind text, p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'match' then
    update matches set status = 'disputed', dispute_reason = p_reason, disputed_by = auth.uid()
     where id = p_id and status = 'pending'
       and auth.uid() = any(case when created_by = any(team_a) then team_b else team_a end);
  else
    update trainings set status = 'disputed', dispute_reason = p_reason
     where id = p_id and status = 'pending' and coach_id = auth.uid();
  end if;
  if not found then raise exception 'Нет доступа'; end if;
end $$;

create or replace function public.cancel_own(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'match' then
    update matches set status = 'cancelled' where id = p_id and created_by = auth.uid() and status = 'pending';
  else
    update trainings set status = 'cancelled' where id = p_id and player_id = auth.uid() and status = 'pending';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------
create or replace function public._advance_bracket(p_t uuid, p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b jsonb; m matches; win text; lose text; i int; side text; fin jsonb; tname text;
begin
  select bracket, name into b, tname from tournaments where id = p_t for update;
  select * into m from matches where id = p_match;
  win := (case when m.winner = 'A' then m.team_a[1] else m.team_b[1] end)::text;
  lose := (case when m.winner = 'A' then m.team_b[1] else m.team_a[1] end)::text;
  for i in 0..3 loop
    if b->'qf'->i->>'matchId' = p_match::text then
      side := case when i % 2 = 0 then 'a' else 'b' end;
      b := jsonb_set(b, array['qf', i::text, 'winner'], to_jsonb(win));
      b := jsonb_set(b, array['sf', (i / 2)::text, side], to_jsonb(win));
      b := jsonb_set(b, array['cons', (i / 2)::text, side], to_jsonb(lose));
    end if;
  end loop;
  for i in 0..1 loop
    if b->'sf'->i->>'matchId' = p_match::text then
      b := jsonb_set(b, array['sf', i::text, 'winner'], to_jsonb(win));
      b := jsonb_set(b, array['final', case when i = 0 then 'a' else 'b' end], to_jsonb(win));
    end if;
    if b->'cons'->i->>'matchId' = p_match::text then
      b := jsonb_set(b, array['cons', i::text, 'winner'], to_jsonb(win));
    end if;
  end loop;
  if b->'final'->>'matchId' = p_match::text then
    b := jsonb_set(b, array['final', 'winner'], to_jsonb(win));
    update profiles set points_q = points_q + 100, points_y = points_y + 100 where id = win::uuid;
    update profiles set points_q = points_q + 60, points_y = points_y + 60 where id = lose::uuid;
    perform grant_achievement(win::uuid, 'tour_win', 'Победитель турнира', tname);
    perform grant_achievement(lose::uuid, 'tour_final', 'Финалист турнира', tname);
    update tournaments set status = 'finished' where id = p_t;
  end if;
  update tournaments set bracket = b where id = p_t;
end $$;

create or replace function public.apply_tournament(p_t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me profiles; t tournaments;
begin
  select * into me from profiles where id = auth.uid();
  select * into t from tournaments where id = p_t;
  if t.status <> 'registration' then raise exception 'Регистрация закрыта'; end if;
  if me.fp_count > 0 and me.fp_sum / me.fp_count < 3.5 then raise exception 'Fair Play ниже 3,5 — заявка недоступна'; end if;
  if me.league <> t.league then raise exception 'Турнир для другой лиги'; end if;
  if me.banned_until > now() then raise exception 'Аккаунт временно заблокирован'; end if;
  insert into tournament_entries(tournament_id, user_id) values (p_t, me.id) on conflict do nothing;
end $$;

create or replace function public.start_tournament(p_t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; empty jsonb := '{"a":null,"b":null,"winner":null,"matchId":null}';
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  select array_agg(e.user_id order by p.rating desc) into ids
    from tournament_entries e join profiles p on p.id = e.user_id
   where e.tournament_id = p_t and e.status = 'approved';
  if coalesce(array_length(ids, 1), 0) <> 8 then
    raise exception 'Нужно ровно 8 утверждённых игроков (сейчас %)', coalesce(array_length(ids, 1), 0);
  end if;
  update tournaments set status = 'running', bracket = jsonb_build_object(
    'qf', jsonb_build_array(
      jsonb_build_object('a', ids[1], 'b', ids[8], 'winner', null, 'matchId', null),
      jsonb_build_object('a', ids[4], 'b', ids[5], 'winner', null, 'matchId', null),
      jsonb_build_object('a', ids[3], 'b', ids[6], 'winner', null, 'matchId', null),
      jsonb_build_object('a', ids[2], 'b', ids[7], 'winner', null, 'matchId', null)),
    'sf', jsonb_build_array(empty, empty),
    'final', empty,
    'cons', jsonb_build_array(empty, empty))
  where id = p_t;
end $$;

-- p_path: '{qf,2}' | '{sf,0}' | '{cons,1}' | '{final}'
create or replace function public.create_tournament_match(p_t uuid, p_path text[], p_sets jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare b jsonb; slot jsonb; me uuid := auth.uid(); opp uuid; mid uuid;
begin
  if winner_from_sets(p_sets) is null then raise exception 'Счёт по сетам не определяет победителя'; end if;
  select bracket into b from tournaments where id = p_t and status = 'running' for update;
  slot := b #> p_path;
  if slot is null then raise exception 'Матч не найден'; end if;
  if slot->>'matchId' is not null then raise exception 'Результат уже введён'; end if;
  if slot->>'a' = me::text then opp := (slot->>'b')::uuid;
  elsif slot->>'b' = me::text then opp := (slot->>'a')::uuid;
  else raise exception 'Это не ваш матч'; end if;
  insert into matches(type, team_a, team_b, sets, played_at, created_by, tournament_id, round)
  values ('single', array[me], array[opp], p_sets, now(), me, p_t, p_path[1]) returning id into mid;
  update tournaments set bracket = jsonb_set(b, p_path || array['matchId'], to_jsonb(mid::text)) where id = p_t;
  return mid;
end $$;

-- ---------------------------------------------------------------------
-- Fair Play, complaints, moderation
-- ---------------------------------------------------------------------
create or replace function public.rate_fairplay(p_kind text, p_ref uuid, p_ratee uuid, p_stars int) returns void
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if p_kind = 'match' then
    select true into ok from matches where id = p_ref and status = 'confirmed'
      and auth.uid() = any(team_a || team_b) and p_ratee = any(team_a || team_b) and p_ratee <> auth.uid();
  else
    select true into ok from trainings where id = p_ref and status = 'confirmed'
      and auth.uid() in (player_id, coach_id) and p_ratee in (player_id, coach_id) and p_ratee <> auth.uid();
  end if;
  if ok is null then raise exception 'Оценить можно только участника подтверждённой игры'; end if;
  insert into fairplay(ref_kind, ref_id, rater_id, ratee_id, stars) values (p_kind, p_ref, auth.uid(), p_ratee, p_stars);
  update profiles set fp_sum = fp_sum + p_stars, fp_count = fp_count + 1 where id = p_ratee;
end $$;

create or replace function public.resolve_complaint(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c complaints; n int;
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  update complaints set status = case when p_accept then 'accepted' else 'rejected' end, resolved_at = now()
   where id = p_id returning * into c;
  if p_accept then
    select count(*) into n from complaints
     where target_id = c.target_id and status = 'accepted' and resolved_at >= now() - interval '30 days';
    update profiles set fp_sum = fp_sum + 1, fp_count = fp_count + 1,
      banned_until = case when n >= 4 then now() + interval '30 days'
                          when n >= 2 then now() + interval '7 days' else banned_until end
     where id = c.target_id;
  end if;
end $$;

create or replace function public.resolve_dispute(p_match uuid, p_keep boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  if p_keep then perform _apply_match(p_match, auth.uid());
  else update matches set status = 'cancelled' where id = p_match; end if;
end $$;

create or replace function public.set_ban(p_user uuid, p_days int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  update profiles set banned_until = case when p_days > 0 then now() + make_interval(days => p_days) end where id = p_user;
end $$;

create or replace function public.invite_coach(p_phone text, p_first text, p_last text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  insert into coach_invites(phone, first_name, last_name) values (p_phone, p_first, p_last)
    on conflict (phone) do update set first_name = excluded.first_name, last_name = excluded.last_name;
  update profiles set role = 'coach', coach_verified = true, coach = coalesce(coach, '{}'::jsonb)
   where phone = p_phone and role = 'player';
end $$;

create or replace function public.answer_challenge(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('accepted','declined') then raise exception 'Неверный статус'; end if;
  update challenges set status = p_status where id = p_id and to_id = auth.uid() and status = 'sent';
  if not found then raise exception 'Нет доступа'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Scheduled jobs (enable pg_cron in Supabase → Database → Extensions)
-- ---------------------------------------------------------------------
create or replace function public.expire_pending() returns void
language sql security definer set search_path = public as $$
  update matches set status = 'cancelled', expired = true where status = 'pending' and deadline < now();
  update trainings set status = 'cancelled', expired = true where status = 'pending' and deadline < now();
$$;

-- Daily: days-in-top counters; on the first day of a quarter/year: titles, reset, league recalculation
create or replace function public.daily_season_job() returns void
language plpgsql security definer set search_path = public as $$
declare lg text; r record; prev_q text; prev_y text;
begin
  -- days in top-10 / top-1 of own league (quarter points)
  update profiles p set top10_days = top10_days + 1 from (
    select id, rank() over (partition by league order by points_q desc, rating desc) rk
      from profiles where matches > 0 and role <> 'admin') t
   where p.id = t.id and t.rk <= 10;
  update profiles p set top1_days = top1_days + 1 from (
    select id, rank() over (partition by league order by points_q desc, rating desc) rk
      from profiles where matches > 0 and role <> 'admin') t
   where p.id = t.id and t.rk = 1;

  if exists (select 1 from profiles where q_key <> current_q() and matches > 0) then
    for r in
      select id, league, q_key, rank() over (partition by league order by points_q desc, rating desc) rk
        from profiles where matches > 0 and role <> 'admin' and q_key <> current_q() and points_q > 0
    loop
      if r.rk = 1 then perform grant_achievement(r.id, 'q_champion', 'Чемпион квартала', r.q_key || ' · ' || r.league);
      elsif r.rk <= 3 then perform grant_achievement(r.id, 'q_top3', 'Топ-3 квартала', r.q_key || ' · ' || r.league);
      elsif r.rk <= 10 then perform grant_achievement(r.id, 'q_top10', 'Топ-10 квартала', r.q_key || ' · ' || r.league);
      end if;
    end loop;
    update profiles set
      league = case when matches >= 5 then league_for(rating, matches) else league end,
      points_q = 0, q_key = current_q(), top10_days = 0, top1_days = 0
     where q_key <> current_q();
  end if;

  if exists (select 1 from profiles where y_key <> current_y() and matches > 0) then
    for r in
      select id, y_key, rank() over (order by points_y desc, rating desc) rk
        from profiles where matches > 0 and role <> 'admin' and y_key <> current_y() and points_y > 0
    loop
      if r.rk = 1 then perform grant_achievement(r.id, 'y_champion', 'Чемпион года', r.y_key);
      elsif r.rk <= 10 then perform grant_achievement(r.id, 'y_top10', 'Топ-10 года', r.y_key);
      end if;
    end loop;
    update profiles set points_y = 0, y_key = current_y() where y_key <> current_y();
  end if;
end $$;

-- To schedule (after enabling pg_cron):
-- select cron.schedule('expire-pending', '*/15 * * * *', 'select public.expire_pending()');
-- select cron.schedule('season-daily', '5 19 * * *', 'select public.daily_season_job()');  -- 00:05 Tashkent

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.coach_invites enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.matches enable row level security;
alter table public.trainings enable row level security;
alter table public.challenges enable row level security;
alter table public.reviews enable row level security;
alter table public.fairplay enable row level security;
alter table public.complaints enable row level security;
alter table public.news enable row level security;
alter table public.news_comments enable row level security;
alter table public.achievements enable row level security;

-- profiles: everyone signed in can read; users edit only their own personal fields
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (first_name, last_name, photo_url, gender, birth_year, district, years, self_level, hand, availability, coach, lang)
  on public.profiles to authenticated;

drop policy if exists invites_admin on public.coach_invites;
create policy invites_admin on public.coach_invites for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select to authenticated using (true);
drop policy if exists tournaments_admin on public.tournaments;
create policy tournaments_admin on public.tournaments for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists entries_read on public.tournament_entries;
create policy entries_read on public.tournament_entries for select to authenticated using (true);
drop policy if exists entries_admin on public.tournament_entries;
create policy entries_admin on public.tournament_entries for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using (true);
drop policy if exists matches_insert on public.matches;
create policy matches_insert on public.matches for insert to authenticated with check (
  created_by = auth.uid() and auth.uid() = any(team_a || team_b) and status = 'pending'
  and winner is null and tournament_id is null and deltas = '{}'::jsonb and points = '{}'::jsonb
  and deadline <= now() + interval '49 hours' and played_at <= now() + interval '1 day'
  and not (team_a && team_b) and not is_banned()
);

drop policy if exists trainings_read on public.trainings;
create policy trainings_read on public.trainings for select to authenticated using (true);
drop policy if exists trainings_insert on public.trainings;
create policy trainings_insert on public.trainings for insert to authenticated with check (
  player_id = auth.uid() and not is_banned()
  and status = case when coach_id is null then 'confirmed' else 'pending' end
  and deadline <= now() + interval '49 hours'
);

drop policy if exists challenges_read on public.challenges;
create policy challenges_read on public.challenges for select to authenticated using (auth.uid() in (from_id, to_id));
drop policy if exists challenges_insert on public.challenges;
create policy challenges_insert on public.challenges for insert to authenticated with check (from_id = auth.uid() and status = 'sent' and not is_banned());

drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select to authenticated using (true);
drop policy if exists reviews_write on public.reviews;
create policy reviews_write on public.reviews for insert to authenticated with check (
  author_id = auth.uid() and exists (select 1 from trainings t where t.coach_id = reviews.coach_id and t.player_id = auth.uid() and t.status = 'confirmed')
);
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists fairplay_read on public.fairplay;
create policy fairplay_read on public.fairplay for select to authenticated using (rater_id = auth.uid() or is_admin());

drop policy if exists complaints_read on public.complaints;
create policy complaints_read on public.complaints for select to authenticated using (author_id = auth.uid() or is_admin());
drop policy if exists complaints_insert on public.complaints;
create policy complaints_insert on public.complaints for insert to authenticated with check (author_id = auth.uid() and status = 'open' and target_id <> auth.uid());

drop policy if exists news_read on public.news;
create policy news_read on public.news for select to authenticated using (true);
drop policy if exists news_admin on public.news;
create policy news_admin on public.news for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists comments_read on public.news_comments;
create policy comments_read on public.news_comments for select to authenticated using (true);
drop policy if exists comments_insert on public.news_comments;
create policy comments_insert on public.news_comments for insert to authenticated with check (user_id = auth.uid() and not is_banned());
drop policy if exists comments_delete on public.news_comments;
create policy comments_delete on public.news_comments for delete to authenticated using (user_id = auth.uid() or is_admin());

drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select to authenticated using (true);

-- Internal functions are not callable from the app
revoke execute on function public._apply_match(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._advance_bracket(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.grant_achievement(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.expire_pending() from public, anon, authenticated;
revoke execute on function public.daily_season_job() from public, anon, authenticated;

-- Photos bucket (profile photos and news photos)
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
