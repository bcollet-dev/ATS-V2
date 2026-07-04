-- Harden profile self-updates before production with real data.
-- A user may update only non-sensitive personal settings, never role/status/tokens.

drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_update_self_safe" on public.profiles
  for update to authenticated
  using (id = auth.uid() and active = true and deleted_at is null)
  with check (id = auth.uid() and active = true and deleted_at is null);

revoke update on public.profiles from authenticated;

grant update (
  full_name,
  name_confirmed,
  email_signature,
  sig_photo_url,
  sig_job_title,
  sig_entity,
  sig_phone,
  sig_linkedin_url,
  sig_instagram_url,
  updated_at
) on public.profiles to authenticated;
