-- ============================================================
-- Trigger: updated_at automatique
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- Trigger: dérivation automatique du statut candidat
-- depuis le statut de proposition le plus avancé de ses matchings
-- ============================================================
create or replace function derive_candidate_status()
returns trigger as $$
declare
  most_advanced proposition_status;
  derived candidate_status;
begin
  -- Cherche le statut de proposition le plus avancé parmi les matchings
  -- non gelés du candidat
  select proposition_status
  into most_advanced
  from matchings
  where candidate_id = coalesce(new.candidate_id, old.candidate_id)
    and is_frozen = false
    and proposition_status != 'not_retained'
  order by
    case proposition_status
      when 'placed'      then 5
      when 'waiting_fre' then 4
      when 'interview'   then 3
      when 'cv_sent'     then 2
      else 0
    end desc
  limit 1;

  -- Mappe vers le statut candidat
  derived := case most_advanced
    when 'placed'      then 'placed'::candidate_status
    when 'waiting_fre' then 'waiting_fre'::candidate_status
    when 'interview'   then 'company_interview'::candidate_status
    when 'cv_sent'     then 'admissible'::candidate_status
    else null
  end;

  -- Si aucun matching actif → repli sur admissible
  if derived is null then
    derived := 'admissible';
  end if;

  -- Met à jour le candidat uniquement pour les statuts post-admissible
  update candidates
  set
    status = derived,
    updated_at = now()
  where id = coalesce(new.candidate_id, old.candidate_id)
    and status in (
      'admissible', 'company_interview', 'waiting_fre', 'placed'
    );

  return coalesce(new, old);
end;
$$ language plpgsql;

-- ============================================================
-- Trigger: dérivation automatique du statut besoin
-- ============================================================
create or replace function derive_need_status()
returns trigger as $$
declare
  most_advanced proposition_status;
  derived need_status;
begin
  select proposition_status
  into most_advanced
  from matchings
  where need_id = coalesce(new.need_id, old.need_id)
    and is_frozen = false
    and proposition_status != 'not_retained'
  order by
    case proposition_status
      when 'placed'      then 5
      when 'waiting_fre' then 4
      when 'interview'   then 3
      when 'cv_sent'     then 2
      else 0
    end desc
  limit 1;

  derived := case most_advanced
    when 'placed'      then 'client'::need_status
    when 'waiting_fre' then 'waiting_fre'::need_status
    when 'interview'   then 'interview'::need_status
    when 'cv_sent'     then 'need_in_progress'::need_status
    else null
  end;

  if derived is null then
    derived := 'need_in_progress';
  end if;

  update needs
  set
    status = derived,
    updated_at = now()
  where id = coalesce(new.need_id, old.need_id)
    and status in (
      'need_in_progress', 'interview', 'waiting_fre', 'client'
    );

  return coalesce(new, old);
end;
$$ language plpgsql;

-- ============================================================
-- Attacher les triggers
-- ============================================================

-- updated_at sur toutes les tables mutables
create trigger set_updated_at_profiles
  before update on profiles
  for each row execute function set_updated_at();

create trigger set_updated_at_candidates
  before update on candidates
  for each row execute function set_updated_at();

create trigger set_updated_at_companies
  before update on companies
  for each row execute function set_updated_at();

create trigger set_updated_at_company_contacts
  before update on company_contacts
  for each row execute function set_updated_at();

create trigger set_updated_at_needs
  before update on needs
  for each row execute function set_updated_at();

create trigger set_updated_at_matchings
  before update on matchings
  for each row execute function set_updated_at();

create trigger set_updated_at_tasks
  before update on tasks
  for each row execute function set_updated_at();

create trigger set_updated_at_mail_templates
  before update on mail_templates
  for each row execute function set_updated_at();

create trigger set_updated_at_widget_configs
  before update on widget_configs
  for each row execute function set_updated_at();

create trigger set_updated_at_app_settings
  before update on app_settings
  for each row execute function set_updated_at();

-- Dérivation statut candidat
create trigger derive_candidate_status_on_matching
  after insert or update of proposition_status, is_frozen or delete on matchings
  for each row execute function derive_candidate_status();

-- Dérivation statut besoin
create trigger derive_need_status_on_matching
  after insert or update of proposition_status, is_frozen or delete on matchings
  for each row execute function derive_need_status();

-- ============================================================
-- Fonction: profil auto-créé à l'inscription Supabase Auth
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'admissions'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
