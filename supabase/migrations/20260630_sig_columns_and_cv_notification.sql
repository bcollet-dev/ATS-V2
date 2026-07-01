-- Structured signature fields on profiles (replaces free-text email_signature)
alter table profiles
  add column if not exists sig_photo_url     text,
  add column if not exists sig_job_title     text,
  add column if not exists sig_entity        text,
  add column if not exists sig_phone         text,
  add column if not exists sig_linkedin_url  text,
  add column if not exists sig_instagram_url text;

-- Default CV notification flag on mail_templates (exclusive — at most one row true at a time)
alter table mail_templates
  add column if not exists is_default_cv_notification boolean not null default false;
