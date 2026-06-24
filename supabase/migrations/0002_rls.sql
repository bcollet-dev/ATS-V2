-- ============================================================
-- Helpers RLS
-- ============================================================
create or replace function current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles
  where id = auth.uid() and active = true and deleted_at is null
$$;

create or replace function is_ats_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active = true and deleted_at is null
  )
$$;

create or replace function is_ats_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() in ('admin', 'direction', 'team_leader')
$$;

-- ============================================================
-- RLS: profiles
-- ============================================================
alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select to authenticated
  using (is_ats_user());

create policy "profiles_update_self" on profiles
  for update to authenticated
  using (id = auth.uid());

create policy "profiles_manage_admin" on profiles
  for all to authenticated
  using (current_user_role() = 'admin');

-- ============================================================
-- RLS: candidates
-- ============================================================
alter table candidates enable row level security;

create policy "candidates_select" on candidates
  for select to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "candidates_insert" on candidates
  for insert to authenticated
  with check (is_ats_user());

create policy "candidates_update" on candidates
  for update to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "candidates_delete_soft" on candidates
  for update to authenticated
  using (is_ats_manager());

-- ============================================================
-- RLS: companies
-- ============================================================
alter table companies enable row level security;

create policy "companies_select" on companies
  for select to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "companies_insert" on companies
  for insert to authenticated
  with check (is_ats_user());

create policy "companies_update" on companies
  for update to authenticated
  using (is_ats_user() and deleted_at is null);

-- ============================================================
-- RLS: company_contacts
-- ============================================================
alter table company_contacts enable row level security;

create policy "company_contacts_select" on company_contacts
  for select to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "company_contacts_insert" on company_contacts
  for insert to authenticated
  with check (is_ats_user());

create policy "company_contacts_update" on company_contacts
  for update to authenticated
  using (is_ats_user() and deleted_at is null);

-- ============================================================
-- RLS: needs
-- ============================================================
alter table needs enable row level security;

create policy "needs_select" on needs
  for select to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "needs_insert" on needs
  for insert to authenticated
  with check (is_ats_user());

create policy "needs_update" on needs
  for update to authenticated
  using (is_ats_user() and deleted_at is null);

-- ============================================================
-- RLS: matchings
-- ============================================================
alter table matchings enable row level security;

create policy "matchings_select" on matchings
  for select to authenticated
  using (is_ats_user());

create policy "matchings_insert" on matchings
  for insert to authenticated
  with check (is_ats_user());

create policy "matchings_update" on matchings
  for update to authenticated
  using (is_ats_user() and is_frozen = false);

-- ============================================================
-- RLS: documents (accès restreint par rôle)
-- ============================================================
alter table documents enable row level security;

-- Tous les utilisateurs ATS voient les CVs
-- CNI, carte vitale : seulement admissions + direction + admin
create policy "documents_select_cv" on documents
  for select to authenticated
  using (
    is_ats_user()
    and (
      document_type not in ('cni', 'carte_vitale')
      or current_user_role() in ('admin', 'direction', 'admissions')
    )
  );

create policy "documents_insert" on documents
  for insert to authenticated
  with check (is_ats_user());

-- ============================================================
-- RLS: tasks
-- ============================================================
alter table tasks enable row level security;

create policy "tasks_select" on tasks
  for select to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "tasks_insert" on tasks
  for insert to authenticated
  with check (is_ats_user());

create policy "tasks_update" on tasks
  for update to authenticated
  using (
    is_ats_user()
    and deleted_at is null
    and (assigned_to = auth.uid() or is_ats_manager())
  );

-- ============================================================
-- RLS: notifications
-- ============================================================
alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own" on notifications
  for update to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RLS: cursus, classes (lecture seule pour tous)
-- ============================================================
alter table cursus enable row level security;

create policy "cursus_select" on cursus
  for select to authenticated using (is_ats_user());

create policy "cursus_manage" on cursus
  for all to authenticated
  using (current_user_role() in ('admin', 'direction'));

alter table classes enable row level security;

create policy "classes_select" on classes
  for select to authenticated using (is_ats_user());

create policy "classes_manage" on classes
  for all to authenticated
  using (current_user_role() in ('admin', 'direction'));

-- ============================================================
-- RLS: ypareo_logs (lecture manager, écriture système)
-- ============================================================
alter table ypareo_logs enable row level security;

create policy "ypareo_logs_select" on ypareo_logs
  for select to authenticated
  using (is_ats_manager());

-- ============================================================
-- RLS: mail_templates
-- ============================================================
alter table mail_templates enable row level security;

create policy "mail_templates_select" on mail_templates
  for select to authenticated
  using (is_ats_user() and deleted_at is null);

create policy "mail_templates_manage" on mail_templates
  for all to authenticated
  using (is_ats_manager());

-- ============================================================
-- RLS: widget_configs (propre à chaque utilisateur)
-- ============================================================
alter table widget_configs enable row level security;

create policy "widget_configs_own" on widget_configs
  for all to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RLS: activity_events (lecture seule)
-- ============================================================
alter table activity_events enable row level security;

create policy "activity_events_select" on activity_events
  for select to authenticated
  using (is_ats_user());

create policy "activity_events_insert" on activity_events
  for insert to authenticated
  with check (is_ats_user());

-- ============================================================
-- RLS: app_settings (admin seulement)
-- ============================================================
alter table app_settings enable row level security;

create policy "app_settings_select" on app_settings
  for select to authenticated using (is_ats_user());

create policy "app_settings_manage" on app_settings
  for all to authenticated
  using (current_user_role() = 'admin');
