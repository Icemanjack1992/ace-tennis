-- =====================================================================
-- Ace Tennis — update 11: the user deletes his account himself (App Store / Google Play rule).
-- Personal data is erased, login is removed. Confirmed matches stay (opponents' ratings),
-- shown without a name. The administrator account cannot be deleted this way.
-- =====================================================================
alter table public.profiles add column if not exists deleted_at timestamptz;
grant select (deleted_at) on public.profiles to anon, authenticated;

-- the coach region lock must not stop the deletion
create or replace function public.coach_region_lock() returns trigger language plpgsql as $$
begin
  if old.role = 'coach' and new.region is distinct from old.region and coalesce(old.region, '') <> ''
     and new.deleted_at is null and auth.uid() is not null and not is_admin() then
    new.region := old.region;
  end if;
  return new;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Нет доступа'; end if;
  if exists (select 1 from profiles where id = me and role = 'admin') then
    raise exception 'Аккаунт администратора удалить нельзя';
  end if;

  -- what belongs only to this person
  delete from challenges where from_id = me or to_id = me;
  delete from news_comments where user_id = me;
  delete from support_messages where user_id = me;
  delete from complaints where author_id = me or target_id = me;
  delete from reviews where author_id = me or coach_id = me;
  delete from fairplay where rater_id = me or ratee_id = me;
  delete from achievements where user_id = me;
  delete from tournament_entries where user_id = me;
  delete from trainings where player_id = me;
  update trainings set coach_id = null where coach_id = me;
  delete from matches where status <> 'confirmed' and (me = any(team_a) or me = any(team_b));
  delete from coach_invites where regexp_replace(phone, '\D', '', 'g') = (select regexp_replace(coalesce(phone, ''), '\D', '', 'g') from profiles where id = me);

  -- the profile stays only as "deleted player" for old confirmed matches
  update profiles set
    role = 'player', first_name = 'Удалённый', last_name = 'игрок', photo_url = null, phone = null,
    gender = '', birth_year = null, district = '', region = '', availability = '{}', self_level = '', hand = '',
    coach = null, coach_pro = false, coach_verified = false, tg_chat_id = null, tg_username = null,
    terms_ver = '', ban_reason = '', deleted_at = now()
  where id = me;

  -- login: e-mail freed (the person can register again), sessions closed, sign-in blocked
  update auth.users set email = 'deleted-' || me || '@deleted.ace-tennis.uz', phone = null,
    encrypted_password = '', raw_user_meta_data = '{}'::jsonb, banned_until = 'infinity'
  where id = me;
  delete from auth.identities where user_id = me;
  delete from auth.sessions where user_id = me;
  delete from auth.refresh_tokens where user_id = me::text;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Photos: a user may list and delete files only in his own folder (used when the account is deleted)
drop policy if exists photos_own_select on storage.objects;
create policy photos_own_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists photos_own_delete on storage.objects;
create policy photos_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
