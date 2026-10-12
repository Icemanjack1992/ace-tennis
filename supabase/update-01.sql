-- =====================================================================
-- Ace Tennis — update 01 (run once after schema.sql):
--   1) login through the Telegram bot
--   2) named seasons instead of quarters
-- =====================================================================

-- One login attempt: the app makes a random nonce, the bot fills it in after the user shares the phone
create table if not exists public.tg_logins (
  nonce text primary key,
  tg_user_id bigint,
  chat_id bigint,
  user_id uuid,
  email text,
  status text not null default 'started' check (status in ('started','ready','used')),
  created_at timestamptz not null default now()
);
alter table public.tg_logins enable row level security;  -- no policies: only the server (service role) touches it

alter table public.profiles add column if not exists tg_chat_id bigint;
alter table public.profiles add column if not exists tg_username text;

-- Find an existing account by phone (digits only, e.g. 998901234567). Server only.
create or replace function public.tg_find_user(p_phone text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where regexp_replace(coalesce(phone,''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g') limit 1
$$;
revoke execute on function public.tg_find_user(text) from public, anon, authenticated;

-- Phones are compared by digits only everywhere (Telegram, SMS and admin input differ in "+")
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare inv coach_invites; digits text := regexp_replace(coalesce(new.phone,''), '\D', '', 'g');
begin
  select * into inv from coach_invites where regexp_replace(phone, '\D', '', 'g') = digits and digits <> '';
  insert into profiles(id, phone, role, first_name, last_name, coach_verified, coach)
  values (new.id, nullif(digits,''),
          case when inv.phone is not null then 'coach' else 'player' end,
          coalesce(inv.first_name,''), coalesce(inv.last_name,''),
          inv.phone is not null,
          case when inv.phone is not null then '{}'::jsonb end)
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.invite_coach(p_phone text, p_first text, p_last text) returns void
language plpgsql security definer set search_path = public as $$
declare digits text := regexp_replace(p_phone, '\D', '', 'g');
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  insert into coach_invites(phone, first_name, last_name) values (digits, p_first, p_last)
    on conflict (phone) do update set first_name = excluded.first_name, last_name = excluded.last_name;
  update profiles set role = 'coach', coach_verified = true, coach = coalesce(coach, '{}'::jsonb)
   where regexp_replace(coalesce(phone,''), '\D', '', 'g') = digits and role = 'player';
end $$;

-- Old unfinished login attempts are removed by the 15-minute job
create or replace function public.expire_pending() returns void
language sql security definer set search_path = public as $$
  update matches set status = 'cancelled', expired = true where status = 'pending' and deadline < now();
  update trainings set status = 'cancelled', expired = true where status = 'pending' and deadline < now();
  delete from tg_logins where created_at < now() - interval '1 day';
$$;
revoke execute on function public.expire_pending() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Named seasons
-- ---------------------------------------------------------------------
alter table public.profiles alter column q_key set default '';

-- Seasons: spring Mar–May, summer Jun–Aug, autumn Sep–Nov, winter Dec–Feb (named by the year it starts)
create or replace function public.current_q() returns text language sql stable as $$
  select case
    when extract(month from now() at time zone 'Asia/Tashkent') between 3 and 5 then to_char(now() at time zone 'Asia/Tashkent','YYYY') || '-spring'
    when extract(month from now() at time zone 'Asia/Tashkent') between 6 and 8 then to_char(now() at time zone 'Asia/Tashkent','YYYY') || '-summer'
    when extract(month from now() at time zone 'Asia/Tashkent') between 9 and 11 then to_char(now() at time zone 'Asia/Tashkent','YYYY') || '-autumn'
    when extract(month from now() at time zone 'Asia/Tashkent') = 12 then to_char(now() at time zone 'Asia/Tashkent','YYYY') || '-winter'
    else (extract(year from now() at time zone 'Asia/Tashkent')::int - 1)::text || '-winter' end
$$;

create or replace function public.league_label(p_league text) returns text language sql immutable as $$
  select case p_league when 'novice' then 'Новички' when 'bronze' then 'Бронза' when 'silver' then 'Серебро'
    when 'gold' then 'Золото' when 'masters' then 'Мастерс' else p_league end
$$;

-- '2026-autumn' → 'Осенний 26'
create or replace function public.season_label(p_key text) returns text language sql immutable as $$
  select case split_part(p_key, '-', 2) when 'spring' then 'Весенний' when 'summer' then 'Летний'
    when 'autumn' then 'Осенний' when 'winter' then 'Зимний' else p_key end || ' ' || right(split_part(p_key, '-', 1), 2)
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

  if exists (select 1 from profiles where q_key <> current_q() and q_key <> '' and matches > 0) then
    for r in
      select id, league, q_key, rank() over (partition by league order by points_q desc, rating desc) rk
        from profiles where matches > 0 and role <> 'admin' and q_key <> current_q() and q_key <> '' and points_q > 0
    loop
      if r.rk = 1 then perform grant_achievement(r.id, 'q_champion', 'Чемпион сезона', season_label(r.q_key) || ' · ' || league_label(r.league));
      elsif r.rk <= 3 then perform grant_achievement(r.id, 'q_top3', 'Топ-3 сезона', season_label(r.q_key) || ' · ' || league_label(r.league));
      elsif r.rk <= 10 then perform grant_achievement(r.id, 'q_top10', 'Топ-10 сезона', season_label(r.q_key) || ' · ' || league_label(r.league));
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
revoke execute on function public.daily_season_job() from public, anon, authenticated;
