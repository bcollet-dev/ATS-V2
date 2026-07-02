export type SchoolYear = { startYear: number; start: Date; end: Date; label: string };

export function schoolYearFromStart(startYear: number): SchoolYear {
  const endYear = startYear + 1;
  return {
    startYear,
    start: new Date(startYear, 8, 1),              // 1er septembre
    end: new Date(endYear, 7, 31, 23, 59, 59),     // 31 août
    label: `${startYear}–${endYear}`,
  };
}

export function currentSchoolYear(): SchoolYear {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Dès juillet on bascule sur l'année scolaire suivante (recrutement alternance)
  const startYear = month >= 7 ? year : year - 1;
  return schoolYearFromStart(startYear);
}

export function availableSchoolYears(count = 4): SchoolYear[] {
  const current = currentSchoolYear();
  return Array.from({ length: count }, (_, i) => schoolYearFromStart(current.startYear - i));
}
