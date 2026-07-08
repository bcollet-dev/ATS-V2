export const RETENTION_OPTIONS = [
  { label: "6 mois",  days: 180  },
  { label: "1 an",    days: 365  },
  { label: "2 ans",   days: 730  },
  { label: "3 ans",   days: 1095 },
  { label: "5 ans",   days: 1825 },
] as const;

export type RetentionConfig = {
  candidatesDays: number;
  companiesDays:  number;
};

export type PurgeCounts = {
  candidatesDue: number;
  companiesDue:  number;
};
