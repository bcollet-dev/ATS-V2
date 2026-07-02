import { pgEnum } from "drizzle-orm/pg-core";

export const appRole = pgEnum("app_role", [
  "admin",
  "direction",
  "team_leader",
  "admissions",
  "relations_entreprises",
]);

export const candidateStatus = pgEnum("candidate_status", [
  "to_call",
  "in_progress",
  "no_response",
  "interview",
  "pvpp",
  "admissible",
  "company_interview",
  "waiting_fre",
  "placed",
  "temporary_refusal",
  "definitive_refusal",
  "contract_break",
]);

export const needStatus = pgEnum("need_status", [
  "ad_chase",
  "prospect",
  "need_in_progress",
  "a_shooter",
  "cv_envoye",
  "interview",
  "waiting_fre",
  "client",
  "rupture",
  "lost",
]);

export const propositionStatus = pgEnum("proposition_status", [
  "cv_sent",
  "interview",
  "waiting_fre",
  "placed",
  "not_retained",
]);

export const documentType = pgEnum("document_type", [
  "cv",
  "cni",
  "carte_vitale",
  "fre",
  "diplome",
  "other",
]);

export const taskCategory = pgEnum("task_category", [
  "call",
  "email",
  "document",
  "follow_up",
  "interview",
  "other",
  "video_interview",
  "onsite_interview",
  "administrative",
]);

export const taskLinkEntityType = pgEnum("task_link_entity_type", [
  "candidate",
  "company",
]);

export const ypareoExchangeStatus = pgEnum("ypareo_exchange_status", [
  "success",
  "error",
  "pending",
  "retryable",
  "not_retryable",
]);

export const mailAudience = pgEnum("mail_audience", [
  "candidate",
  "company",
  "need",
  "all",
]);
