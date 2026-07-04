export const MATCHING_ALLOWED_CANDIDATE_STATUSES = [
  "admissible",
  "company_interview",
  "waiting_fre",
  "placed",
  "contract_break",
] as const;

export function canCandidateBeMatched(status: string): boolean {
  return (MATCHING_ALLOWED_CANDIDATE_STATUSES as readonly string[]).includes(status);
}

export const MATCHING_ALLOWED_NEED_STATUSES = [
  "need_in_progress",
  "a_shooter",
  "cv_envoye",
  "interview",
  "waiting_fre",
  "client",
  "rupture",
] as const;

export function canNeedBeMatched(status: string): boolean {
  return (MATCHING_ALLOWED_NEED_STATUSES as readonly string[]).includes(status);
}

export function normalizeNeedPipelineStatus(status: string): string {
  return status === "a_shooter" || status === "cv_envoye" ? "need_in_progress" : status;
}

const PROPOSITION_PRIORITY: Record<string, number> = {
  cv_sent: 1,
  interview: 2,
  waiting_fre: 3,
  placed: 4,
};

function highestActivePropositionStatus(statuses: string[]): string | null {
  let highest: string | null = null;
  let highestPriority = 0;

  for (const status of statuses) {
    const priority = PROPOSITION_PRIORITY[status] ?? 0;
    if (priority > highestPriority) {
      highest = status;
      highestPriority = priority;
    }
  }

  return highest;
}

export function deriveCandidateStatusFromPropositions(statuses: string[]): string {
  const highest = highestActivePropositionStatus(statuses);
  if (highest === "placed") return "placed";
  if (highest === "waiting_fre") return "waiting_fre";
  if (highest === "interview") return "company_interview";
  return "admissible";
}

export function deriveNeedStatusFromPropositions(statuses: string[]): string {
  const highest = highestActivePropositionStatus(statuses);
  if (highest === "placed") return "client";
  if (highest === "waiting_fre") return "waiting_fre";
  if (highest === "interview") return "interview";
  return "need_in_progress";
}
