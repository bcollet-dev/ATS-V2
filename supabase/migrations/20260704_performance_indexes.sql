create index if not exists candidates_pipeline_idx
  on candidates (deleted_at, status, first_name);

create index if not exists candidates_created_at_idx
  on candidates (created_at);

create index if not exists needs_pipeline_idx
  on needs (deleted_at, status, title);

create index if not exists needs_created_at_idx
  on needs (created_at);

create index if not exists needs_target_cursus_idx
  on needs (target_cursus_id);

create index if not exists companies_directory_idx
  on companies (deleted_at, name);

create index if not exists company_contacts_company_active_idx
  on company_contacts (company_id, deleted_at, first_name);

create index if not exists matchings_candidate_status_idx
  on matchings (candidate_id, proposition_status, created_at);

create index if not exists matchings_need_status_idx
  on matchings (need_id, proposition_status, created_at);

create index if not exists matchings_candidate_frozen_status_idx
  on matchings (candidate_id, is_frozen, proposition_status);

create index if not exists matchings_need_frozen_status_idx
  on matchings (need_id, is_frozen, proposition_status);

create index if not exists matchings_winner_class_idx
  on matchings (is_winner, class_id);

create index if not exists documents_candidate_type_idx
  on documents (candidate_id, document_type, created_at);

create index if not exists documents_company_type_idx
  on documents (company_id, document_type, created_at);

create index if not exists documents_need_type_idx
  on documents (need_id, document_type, created_at);

create index if not exists documents_extraction_status_idx
  on documents (extraction_status, created_at);

create index if not exists tasks_open_due_idx
  on tasks (completed_at, deleted_at, due_at);
