import { performance } from "node:perf_hooks";

const VOLUME = {
  candidates: 1000,
  needs: 300,
  companies: 300,
  documents: 2000,
  users: 10,
  matchings: 1800,
  tasks: 1600,
};

const candidateStatuses = [
  "to_call",
  "in_progress",
  "nrp",
  "interview",
  "pvpp",
  "admissible",
  "company_interview",
  "waiting_fre",
  "placed",
  "rupture",
];

const needStatuses = [
  "ad_chase",
  "prospect",
  "in_progress",
  "interview",
  "waiting_fre",
  "client",
  "lost",
];

const matchingStatuses = [
  "cv_sent",
  "interview",
  "waiting_fre",
  "placed",
  "not_retained",
];

let seed = 20260704;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function dateDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function generateData() {
  const users = Array.from({ length: VOLUME.users }, (_, index) => ({
    id: `user-${index}`,
    fullName: `User ${index + 1}`,
  }));

  const companies = Array.from({ length: VOLUME.companies }, (_, index) => ({
    id: `company-${index}`,
    name: `Company ${String(index).padStart(3, "0")}`,
    deletedAt: null,
  }));

  const candidates = Array.from({ length: VOLUME.candidates }, (_, index) => ({
    id: `candidate-${index}`,
    firstName: `Candidate${String(index).padStart(4, "0")}`,
    lastName: `Test${index}`,
    status: pick(candidateStatuses),
    ownerId: pick(users).id,
    updatedAt: dateDaysAgo(Math.floor(random() * 20)),
    deletedAt: random() < 0.03 ? dateDaysAgo(1) : null,
  }));

  const needs = Array.from({ length: VOLUME.needs }, (_, index) => ({
    id: `need-${index}`,
    title: `Need ${String(index).padStart(3, "0")}`,
    companyId: companies[index % companies.length].id,
    status: pick(needStatuses),
    ownerId: pick(users).id,
    updatedAt: dateDaysAgo(Math.floor(random() * 20)),
    deletedAt: random() < 0.02 ? dateDaysAgo(1) : null,
  }));

  const documents = Array.from({ length: VOLUME.documents }, (_, index) => {
    const candidate = candidates[index % candidates.length];
    const need = needs[index % needs.length];
    const attachToCandidate = random() < 0.7;
    return {
      id: `doc-${index}`,
      candidateId: attachToCandidate ? candidate.id : null,
      needId: attachToCandidate ? null : need.id,
      documentType: index % 5 === 0 ? "cv" : "other",
      createdAt: dateDaysAgo(Math.floor(random() * 60)),
    };
  });

  const matchings = [];
  const seen = new Set();
  while (matchings.length < VOLUME.matchings) {
    const candidate = pick(candidates);
    const need = pick(needs);
    const key = `${candidate.id}:${need.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matchings.push({
      id: `matching-${matchings.length}`,
      candidateId: candidate.id,
      needId: need.id,
      propositionStatus: pick(matchingStatuses),
      isFrozen: random() < 0.05,
      isWinner: random() < 0.1,
      createdAt: dateDaysAgo(Math.floor(random() * 90)),
    });
  }

  const tasks = Array.from({ length: VOLUME.tasks }, (_, index) => ({
    id: `task-${index}`,
    entityType: random() < 0.55 ? "candidate" : "company",
    entityId: random() < 0.55 ? pick(candidates).id : pick(companies).id,
    dueAt: dateDaysAgo(Math.floor(random() * 15) - 5),
    completedAt: random() < 0.35 ? dateDaysAgo(1) : null,
    deletedAt: random() < 0.02 ? dateDaysAgo(1) : null,
  }));

  return { users, companies, candidates, needs, documents, matchings, tasks };
}

function buildCandidatePipeline(data) {
  const rows = data.candidates
    .filter((candidate) => !candidate.deletedAt)
    .sort((a, b) => a.firstName.localeCompare(b.firstName));
  const ids = new Set(rows.map((candidate) => candidate.id));
  const nextTask = new Map();
  for (const task of data.tasks) {
    if (task.entityType !== "candidate" || !ids.has(task.entityId) || task.completedAt || task.deletedAt) continue;
    const previous = nextTask.get(task.entityId);
    if (!previous || task.dueAt < previous) nextTask.set(task.entityId, task.dueAt);
  }
  const matchingsByCandidate = new Map();
  for (const matching of data.matchings) {
    if (!ids.has(matching.candidateId) || matching.propositionStatus === "not_retained") continue;
    const list = matchingsByCandidate.get(matching.candidateId) ?? [];
    list.push(matching.needId);
    matchingsByCandidate.set(matching.candidateId, list);
  }
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    nextTaskAt: nextTask.get(row.id) ?? null,
    activeMatchings: matchingsByCandidate.get(row.id)?.length ?? 0,
  }));
}

function buildNeedPipeline(data) {
  const activeCompanies = new Set(data.companies.filter((company) => !company.deletedAt).map((company) => company.id));
  const rows = data.needs
    .filter((need) => !need.deletedAt && activeCompanies.has(need.companyId))
    .sort((a, b) => a.title.localeCompare(b.title));
  const ids = new Set(rows.map((need) => need.id));
  const counts = new Map();
  for (const matching of data.matchings) {
    if (!ids.has(matching.needId) || matching.propositionStatus === "not_retained") continue;
    const current = counts.get(matching.needId) ?? { active: 0, waitingFre: 0, interview: 0 };
    current.active += 1;
    if (matching.propositionStatus === "waiting_fre") current.waitingFre += 1;
    if (matching.propositionStatus === "interview") current.interview += 1;
    counts.set(matching.needId, current);
  }
  return rows.map((row) => ({ id: row.id, status: row.status, counts: counts.get(row.id) ?? null }));
}

function buildMatchingPage(data) {
  const candidateIds = new Set(
    data.candidates
      .filter((candidate) => !candidate.deletedAt && candidateStatuses.includes(candidate.status))
      .map((candidate) => candidate.id)
  );
  const needIds = new Set(
    data.needs
      .filter((need) => !need.deletedAt && !["lost", "ad_chase", "prospect"].includes(need.status))
      .map((need) => need.id)
  );
  const cvSet = new Set(
    data.documents
      .filter((doc) => doc.documentType === "cv" && doc.candidateId && candidateIds.has(doc.candidateId))
      .map((doc) => doc.candidateId)
  );
  const activeByNeed = new Map();
  for (const matching of data.matchings) {
    if (!needIds.has(matching.needId) || matching.propositionStatus === "not_retained") continue;
    const list = activeByNeed.get(matching.needId) ?? [];
    list.push({ candidateId: matching.candidateId, hasCV: cvSet.has(matching.candidateId) });
    activeByNeed.set(matching.needId, list);
  }
  return { candidateCount: candidateIds.size, needCount: needIds.size, activeNeeds: activeByNeed.size };
}

function buildDashboard(data) {
  const byCandidateStatus = new Map();
  const byNeedStatus = new Map();
  let overdueTasks = 0;
  for (const candidate of data.candidates) {
    if (candidate.deletedAt) continue;
    byCandidateStatus.set(candidate.status, (byCandidateStatus.get(candidate.status) ?? 0) + 1);
  }
  for (const need of data.needs) {
    if (need.deletedAt) continue;
    byNeedStatus.set(need.status, (byNeedStatus.get(need.status) ?? 0) + 1);
  }
  const now = new Date();
  for (const task of data.tasks) {
    if (!task.completedAt && !task.deletedAt && task.dueAt < now) overdueTasks += 1;
  }
  return { byCandidateStatus, byNeedStatus, overdueTasks };
}

function buildDetailPages(data) {
  const candidate = data.candidates[Math.floor(data.candidates.length / 2)];
  const need = data.needs[Math.floor(data.needs.length / 2)];
  const company = data.companies[Math.floor(data.companies.length / 2)];
  return {
    candidateDocuments: data.documents.filter((doc) => doc.candidateId === candidate.id).length,
    candidateMatchings: data.matchings.filter((matching) => matching.candidateId === candidate.id).length,
    needDocuments: data.documents.filter((doc) => doc.needId === need.id).length,
    needMatchings: data.matchings.filter((matching) => matching.needId === need.id).length,
    companyNeeds: data.needs.filter((row) => row.companyId === company.id).length,
  };
}

function measure(label, fn, iterations = 30) {
  const times = [];
  let lastResult;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    lastResult = fn();
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  return { label, median, p95, lastResult };
}

const data = generateData();
const checks = [
  { ...measure("pipeline candidats", () => buildCandidatePipeline(data)), budgetMs: 100 },
  { ...measure("pipeline besoins", () => buildNeedPipeline(data)), budgetMs: 100 },
  { ...measure("page matching", () => buildMatchingPage(data)), budgetMs: 100 },
  { ...measure("dashboard", () => buildDashboard(data)), budgetMs: 60 },
  { ...measure("fiches candidat/besoin/entreprise", () => buildDetailPages(data)), budgetMs: 30 },
];

console.log("Volume cible simule:", VOLUME);
console.log("");
for (const check of checks) {
  const ok = check.p95 <= check.budgetMs;
  console.log(
    `${ok ? "OK" : "FAIL"} ${check.label.padEnd(32)} median=${check.median.toFixed(2)}ms p95=${check.p95.toFixed(2)}ms budget=${check.budgetMs}ms`
  );
}

if (checks.some((check) => check.p95 > check.budgetMs)) {
  process.exitCode = 1;
}
