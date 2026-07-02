export type YpareoPlacementSource = "candidate" | "need";

export type YpareoDraftField = {
  label: string;
  value: string | null;
  required?: boolean;
};

export type YpareoDraftSection = {
  title: string;
  fields: YpareoDraftField[];
};

export type YpareoClassOption = {
  id: string;
  externalId: string | null;
  name: string;
  code: string | null;
  site: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type YpareoPlacementDraft = {
  source: YpareoPlacementSource;
  sourceId: string;
  candidateId: string | null;
  needId: string | null;
  companyId: string | null;
  matchingId: string | null;
  title: string;
  subtitle: string;
  sections: YpareoDraftSection[];
  classOptions: YpareoClassOption[];
  missingFields: string[];
  blockingIssues: string[];
  warnings: string[];
};
