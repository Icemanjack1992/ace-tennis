-- =====================================================================
-- Ace Tennis — update 09: courts (map, choice in challenges and matches),
-- coach request with a document photo, "verified coach", coach region set by the admin.
-- Run AFTER update-08.sql.
-- =====================================================================

-- 1) Courts ------------------------------------------------------------
create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  city text not null default '',
  name text not null,
  address text not null default '',
  lat double precision,
  lng double precision,
  courts_count int not null default 1 check (courts_count between 1 and 60),
  surface text not null default '' check (surface in ('', 'hard', 'clay', 'grass', 'carpet', 'mixed')),
  indoor boolean not null default false,
  lights boolean not null default false,
  phone text not null default '',
  price text not null default '',
  note text not null default '',
  checked boolean not null default false,   -- the admin confirmed name and place
  active boolean not null default true,     -- hidden courts stay in old matches
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists courts_region_idx on public.courts (region) where active;
drop trigger if exists courts_touch on public.courts;
create trigger courts_touch before update on public.courts for each row execute function public.touch_updated_at();

alter table public.courts enable row level security;
drop policy if exists courts_read on public.courts;
create policy courts_read on public.courts for select to anon, authenticated using (active or (select is_admin()));
drop policy if exists courts_admin_ins on public.courts;
create policy courts_admin_ins on public.courts for insert to authenticated with check ((select is_admin()));
drop policy if exists courts_admin_upd on public.courts;
create policy courts_admin_upd on public.courts for update to authenticated using ((select is_admin())) with check ((select is_admin()));
revoke all on public.courts from anon, authenticated;
grant select on public.courts to anon, authenticated;
grant insert, update on public.courts to authenticated;

-- Where the game is played
alter table public.challenges add column if not exists court_id uuid references public.courts(id) on delete set null;
alter table public.matches add column if not exists court_id uuid references public.courts(id) on delete set null;

-- 2) Coach request with a document -------------------------------------
alter table public.coach_requests add column if not exists doc_paths text[] not null default '{}';
grant insert (first_name, last_name, phone, experience, about, terms_ver, region, doc_paths) on public.coach_requests to anon, authenticated;

-- Private bucket: only the admin can open the photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-docs', 'coach-docs', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists coach_docs_insert on storage.objects;
create policy coach_docs_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'coach-docs' and (storage.foldername(name))[1] = 'req');
drop policy if exists coach_docs_admin on storage.objects;
create policy coach_docs_admin on storage.objects for select to authenticated
  using (bucket_id = 'coach-docs' and (select is_admin()));

-- 3) Verified coach, region from the admin ------------------------------
alter table public.profiles add column if not exists coach_pro boolean not null default false;
grant select (coach_pro) on public.profiles to anon, authenticated;
alter table public.coach_invites add column if not exists region text not null default '';
alter table public.coach_invites add column if not exists pro boolean not null default false;

drop function if exists public.resolve_coach_request(uuid, boolean);
create or replace function public.resolve_coach_request(p_id uuid, p_approve boolean, p_region text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r coach_requests; rg text; v_pro boolean; digits text;
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  select * into r from coach_requests where id = p_id and status = 'new';
  if r.id is null then raise exception 'Заявка не найдена'; end if;
  if p_approve then
    rg := coalesce(nullif(p_region, ''), r.region, '');
    if rg = '' then raise exception 'Выберите область тренера'; end if;
    v_pro := cardinality(r.doc_paths) > 0;
    digits := regexp_replace(r.phone, '\D', '', 'g');
    perform invite_coach(r.phone, r.first_name, r.last_name);
    update coach_invites set region = rg, pro = v_pro where regexp_replace(phone, '\D', '', 'g') = digits;
    update profiles set region = rg, coach_pro = v_pro
     where regexp_replace(coalesce(phone, ''), '\D', '', 'g') = digits and role = 'coach';
    update coach_requests set region = rg where id = p_id;
  end if;
  update coach_requests set status = case when p_approve then 'approved' else 'rejected' end where id = p_id;
end $$;
revoke execute on function public.resolve_coach_request(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_coach_request(uuid, boolean, text) to authenticated;

-- The admin changes a coach's region or "verified" mark later
create or replace function public.set_coach(p_user uuid, p_region text, p_pro boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Только администратор'; end if;
  update profiles set region = coalesce(nullif(p_region, ''), region), coach_pro = coalesce(p_pro, coach_pro)
   where id = p_user and role = 'coach';
  if not found then raise exception 'Тренер не найден'; end if;
end $$;
revoke execute on function public.set_coach(uuid, text, boolean) from public, anon;
grant execute on function public.set_coach(uuid, text, boolean) to authenticated;

-- A coach becomes a coach when he enters the invited number: region and mark come from the invite
create or replace function public.set_my_phone(p_phone text) returns text
language plpgsql security definer set search_path = public as $$
declare
  digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  inv coach_invites;
begin
  if auth.uid() is null then raise exception 'Нет доступа'; end if;
  if digits ~ '^\d{9}$' then digits := '998' || digits; end if;
  if digits !~ '^998\d{9}$' then raise exception 'Введите номер в формате +998 XX XXX XX XX'; end if;
  update profiles set phone = digits where id = auth.uid();
  select * into inv from coach_invites where regexp_replace(phone, '\D', '', 'g') = digits;
  if inv.phone is not null then
    update profiles set role = 'coach', coach_verified = true, coach = coalesce(coach, '{}'::jsonb),
      coach_pro = coach_pro or inv.pro,
      region = case when inv.region <> '' then inv.region else region end,
      first_name = case when coalesce(first_name, '') = '' then inv.first_name else first_name end,
      last_name = case when coalesce(last_name, '') = '' then inv.last_name else last_name end
    where id = auth.uid() and role = 'player';
  end if;
  return digits;
end $$;
grant execute on function public.set_my_phone(text) to authenticated;

-- A coach cannot move himself to another region: the admin decides
create or replace function public.coach_region_lock() returns trigger language plpgsql as $$
begin
  if old.role = 'coach' and new.region is distinct from old.region and coalesce(old.region, '') <> ''
     and auth.uid() is not null and not is_admin() then
    new.region := old.region;
  end if;
  return new;
end $$;
drop trigger if exists profiles_coach_region on public.profiles;
create trigger profiles_coach_region before update on public.profiles for each row execute function public.coach_region_lock();

-- 4) Courts found on the internet (OpenStreetMap, Afisha.uz). Names without a check are marked checked = false.
insert into public.courts (region, city, name, address, lat, lng, courts_count, surface, phone, checked, source)
select * from (values
  ('tashkent_city', 'Ташкент', 'СК «Юнусабад»', 'Юнусабадский район', 41.3469, 69.28396, 6, 'mixed', '+998 71 234 77 60', true, 'osm+afisha'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты «Буревестник»', '', 41.32542, 69.2792, 8, '', '', true, 'osm'),
  ('tashkent_city', 'Ташкент', 'Республиканская школа олимпийского резерва по теннису', '', 41.35075, 69.34376, 17, '', '+998 71 208 19 01', true, 'osm+afisha'),
  ('tashkent_city', 'Ташкент', 'СК «Учкун»', 'Юнусабадский район', 41.35903, 69.28504, 6, 'clay', '+998 99 902 78 02', true, 'osm+afisha'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты «Пахтакор»', '', 41.31576, 69.26285, 8, 'clay', '+998 90 333 11 51', true, 'osm+afisha'),
  ('tashkent_city', 'Ташкент', 'Спорткомплекс «Aviasozlar»', '', 41.29298, 69.33952, 1, '', '', true, 'osm'),
  ('tashkent_city', 'Ташкент', 'Спортшкола №1 Бектемир', 'Бектемирский район', 41.25754, 69.37563, 1, '', '', true, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.3247, 69.30532, 6, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.27427, 69.27988, 4, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.36295, 69.20751, 3, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.25316, 69.32787, 3, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.27869, 69.33878, 2, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.33265, 69.33006, 3, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.32218, 69.30681, 5, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.27568, 69.27317, 3, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.2749, 69.20005, 2, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.30015, 69.27999, 3, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.3299, 69.19112, 2, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.3289, 69.42928, 3, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.29305, 69.18635, 2, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.33037, 69.34134, 4, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.32103, 69.41887, 4, '', '', false, 'osm'),
  ('tashkent_city', 'Ташкент', 'Теннисные корты', '', 41.30923, 69.29528, 2, '', '', false, 'osm'),
  ('tashkent', 'Бостанлыкский район', 'Теннисные корты (Чарвак)', '', 41.64731, 69.87998, 2, '', '', false, 'osm'),
  ('tashkent', 'Бостанлыкский район', 'Теннисные корты (Чарвак)', '', 41.65731, 69.95596, 2, '', '', false, 'osm'),
  ('tashkent', 'Алмалык', 'Теннисный корт', '', 40.86795, 69.58823, 1, '', '', false, 'osm'),
  ('namangan', 'Наманган', 'Теннисные корты «Дўстлик»', '', 41.00167, 71.60223, 9, '', '', true, 'osm'),
  ('namangan', 'Наманган', 'Теннисные корты', '', 40.99883, 71.60807, 3, '', '', false, 'osm'),
  ('fergana', 'Фергана', 'Теннисный корт', '', 40.36683, 71.7809, 1, '', '', false, 'osm'),
  ('fergana', 'Фергана', 'Теннисные корты', '', 40.36689, 71.83707, 2, '', '', false, 'osm'),
  ('fergana', 'Маргилан', 'Теннисные корты', '', 40.47449, 71.76182, 2, '', '', false, 'osm'),
  ('samarkand', 'Самарканд', 'Теннисные корты', '', 39.65469, 66.9474, 3, '', '', false, 'osm'),
  ('samarkand', 'Самарканд', 'Теннисный корт', '', 39.65495, 66.97309, 1, '', '', false, 'osm'),
  ('bukhara', 'Бухара', 'Теннисный комплекс «Дилкушо»', 'ул. Чулпон', 39.78391, 64.43025, 6, '', '', true, 'osm'),
  ('bukhara', 'Бухара', 'Спорткомплекс «Хумо»', '', 39.76331, 64.41553, 1, '', '', true, 'osm'),
  ('bukhara', 'Бухара', 'Теннисные корты', '', 39.76055, 64.41968, 2, '', '', false, 'osm'),
  ('jizzakh', 'Джизак', 'Теннисные корты', '', 40.13458, 67.82662, 4, '', '', false, 'osm'),
  ('jizzakh', 'Джизак', 'Теннисные корты', '', 40.10587, 67.82424, 4, '', '', false, 'osm'),
  ('jizzakh', 'Джизак', 'Теннисные корты', '', 40.08556, 67.90102, 2, '', '', false, 'osm'),
  ('navoi', 'Навои', 'Теннисные корты', '', 40.09664, 65.37644, 2, '', '', false, 'osm'),
  ('navoi', 'Навои', 'Теннисные корты', '', 40.07968, 65.37689, 4, '', '', false, 'osm'),
  ('kashkadarya', 'Карши', 'Теннисные корты', '', 38.84612, 65.78415, 5, '', '', false, 'osm'),
  ('syrdarya', 'Гулистан', 'Теннисные корты', '', 40.50847, 68.76842, 3, '', '', false, 'osm'),
  ('khorezm', 'Ургенч', 'Теннисные корты', 'ул. Пахлавон Махмуд', 41.56042, 60.61817, 5, '', '', false, 'osm'),
  ('karakalpakstan', 'Нукус', 'Теннисный клуб «Туран»', '', 42.45894, 59.59786, 4, '', '', true, 'osm'),
  ('karakalpakstan', 'Нукус', 'Теннисные корты', '', 42.45298, 59.628, 2, '', '', false, 'osm')
) v(region, city, name, address, lat, lng, courts_count, surface, phone, checked, source)
where not exists (select 1 from public.courts);
