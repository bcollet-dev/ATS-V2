export type SchoolYear = { start: Date; end: Date; label: string };

export function currentSchoolYear(): SchoolYear {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    start: new Date(startYear, 8, 1),   // 1er septembre
    end: new Date(endYear, 7, 31, 23, 59, 59), // 31 août
    label: `${startYear}–${endYear}`,
  };
}
