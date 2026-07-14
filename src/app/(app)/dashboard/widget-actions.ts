"use server";

import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import {
  candidates, needs, tasks, taskLinks, activityEvents, matchings, classes, cursus,
  profiles,
} from "@/db/schema";
import { eq, and, isNull, isNotNull, lt, inArray, gte, lte, desc, asc, count, max, sql, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { currentSchoolYear, schoolYearFromStart } from "@/lib/dashboard/school-year";
import type { DashboardScope } from "./DashboardClient";

/**
 * Applique côté serveur la portée demandée : seuls les rôles ayant
 * `dashboard:global` (admin, direction, team_leader) peuvent voir la vue
 * « équipe » (globale). Les autres (admissions, relations entreprises) sont
 * ramenés à leur vue personnelle — l'UI le force déjà, mais l'action serveur
 * doit l'imposer aussi (sinon fuite de données à l'échelle de l'organisation).
 */
function enforceScope(role: string, scope: DashboardScope): DashboardScope {
  return scope === "global" && can(role as AppRole, "dashboard:global") ? "global" : "personal";
}

// ─── Relances ─────────────────────────────────────────────────────────────────

export type OverdueTask = {
  id: string;
  title: string;
  dueAt: string;
  candidateName: string | null;
  candidateId: string | null;
  needTitle: string | null;
  needId: string | null;
  assigneeName: string | null;
};

export type InactiveCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  lastActivityAt: string | null;
  daysSinceActivity: number;
  ownerName: string | null;
};

export async function getRelancesData(scope: DashboardScope): Promise<{
  overdueTasks: OverdueTask[];
  inactiveCandidates: InactiveCandidate[];
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const now = new Date();

  const assigneeProfile = alias(profiles, "assignee");
  const ownerProfile = alias(profiles, "owner_p");

  const [taskRows, candidateRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        candidateId: tasks.candidateId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        needTitle: needs.title,
        needId: tasks.needId,
        assigneeName: assigneeProfile.fullName,
      })
      .from(tasks)
      .leftJoin(candidates, eq(tasks.candidateId, candidates.id))
      .leftJoin(needs, eq(tasks.needId, needs.id))
      .leftJoin(assigneeProfile, eq(tasks.assignedTo, assigneeProfile.id))
      .where(
        and(
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt),
          lt(tasks.dueAt, now),
          scope === "personal" ? eq(tasks.assignedTo, actor.id) : undefined
        )
      )
      .orderBy(asc(tasks.dueAt))
      .limit(50),

    (() => {
      const lastAct = db
        .select({
          candidateId: activityEvents.candidateId,
          lastAt: max(activityEvents.createdAt).as("last_at"),
        })
        .from(activityEvents)
        .groupBy(activityEvents.candidateId)
        .as("last_act");

      return db
        .select({
          id: candidates.id,
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          status: candidates.status,
          lastActivityAt: lastAct.lastAt,
          ownerName: ownerProfile.fullName,
        })
        .from(candidates)
        .leftJoin(lastAct, eq(candidates.id, lastAct.candidateId))
        .leftJoin(ownerProfile, eq(candidates.ownerId, ownerProfile.id))
        .where(
          and(
            inArray(candidates.status, ["to_call", "in_progress"]),
            isNull(candidates.deletedAt),
            or(isNull(lastAct.lastAt), sql`${lastAct.lastAt} < now() - interval '7 days'`),
            scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
          )
        )
        .orderBy(asc(lastAct.lastAt))
        .limit(50);
    })(),
  ]);

  return {
    overdueTasks: taskRows.map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt.toISOString(),
      candidateId: r.candidateId,
      candidateName:
        r.candidateFirstName && r.candidateLastName
          ? `${r.candidateFirstName} ${r.candidateLastName}`
          : null,
      needTitle: r.needTitle,
      needId: r.needId,
      assigneeName: r.assigneeName,
    })),
    inactiveCandidates: candidateRows.map((r) => {
      const lastAt = r.lastActivityAt ? new Date(r.lastActivityAt) : null;
      const days = lastAt
        ? Math.floor((now.getTime() - lastAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        status: r.status,
        lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).toISOString() : null,
        daysSinceActivity: days,
        ownerName: r.ownerName,
      };
    }),
  };
}

// ─── Statuts besoins ──────────────────────────────────────────────────────────

const FUNNEL_ORDER = [
  { status: "ad_chase",         label: "Ad Chase" },
  { status: "prospect",         label: "Prospect" },
  { status: "need_in_progress", label: "Besoin en cours" },
  { status: "a_shooter",        label: "À shooter" },
  { status: "cv_envoye",        label: "CV envoyé" },
  { status: "interview",        label: "Entretien" },
  { status: "waiting_fre",      label: "Attente FRE" },
  { status: "client",           label: "Client" },
  { status: "rupture",          label: "Rupture" },
];

export async function getStatutsBesoinsData(scope: DashboardScope): Promise<{
  funnel: { status: string; label: string; count: number }[];
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);

  const rows = await db
    .select({ status: needs.status, cnt: count() })
    .from(needs)
    .where(
      and(
        isNull(needs.deletedAt),
        sql`${needs.status} != 'lost'`,
        scope === "personal" ? eq(needs.ownerId, actor.id) : undefined
      )
    )
    .groupBy(needs.status);

  const map = new Map(rows.map((r) => [r.status as string, r.cnt]));

  return {
    funnel: FUNNEL_ORDER.map(({ status, label }) => ({
      status,
      label,
      count: map.get(status) ?? 0,
    })),
  };
}

// ─── Besoins perdus ───────────────────────────────────────────────────────────

export async function getBesoinsPerduData(scope: DashboardScope, startYear?: number): Promise<{
  total: number;
  topMotifs: { motif: string; count: number }[];
  schoolYear: string;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const baseWhere = and(
    eq(needs.status, "lost"),
    isNull(needs.deletedAt),
    gte(needs.updatedAt, sy.start),
    lte(needs.updatedAt, sy.end),
    scope === "personal" ? eq(needs.ownerId, actor.id) : undefined
  );

  const [totalRow, motifRows] = await Promise.all([
    db.select({ cnt: count() }).from(needs).where(baseWhere),
    db
      .select({
        motif: sql<string>`COALESCE(${needs.lostReason}, 'Sans motif renseigné')`,
        cnt: count(),
      })
      .from(needs)
      .where(baseWhere)
      .groupBy(sql`COALESCE(${needs.lostReason}, 'Sans motif renseigné')`)
      .orderBy(desc(count()))
      .limit(5),
  ]);

  return {
    total: totalRow[0]?.cnt ?? 0,
    topMotifs: motifRows.map((r) => ({
      motif: r.motif.length > 45 ? r.motif.slice(0, 42) + "…" : r.motif,
      count: r.cnt,
    })),
    schoolYear: sy.label,
  };
}

// ─── Taux de placement ────────────────────────────────────────────────────────

export async function getTauxPlacementData(scope: DashboardScope, startYear?: number): Promise<{
  candidatesPlaced: number;
  candidatesTotal: number;
  needsFilled: number;
  needsTotal: number;
  schoolYear: string;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const candidateBase = and(
    isNull(candidates.deletedAt),
    gte(candidates.createdAt, sy.start),
    lte(candidates.createdAt, sy.end),
    scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
  );

  const needBase = and(
    isNull(needs.deletedAt),
    gte(needs.createdAt, sy.start),
    lte(needs.createdAt, sy.end),
    scope === "personal" ? eq(needs.ownerId, actor.id) : undefined
  );

  const [cTotal, cPlaced, nTotal, nFilled] = await Promise.all([
    db.select({ cnt: count() }).from(candidates).where(candidateBase),
    db.select({ cnt: count() }).from(candidates).where(and(candidateBase, eq(candidates.status, "placed"))),
    db.select({ cnt: count() }).from(needs).where(and(needBase, sql`${needs.status} != 'lost'`)),
    db.select({ cnt: count() }).from(needs).where(and(needBase, eq(needs.status, "client"))),
  ]);

  return {
    candidatesTotal: cTotal[0]?.cnt ?? 0,
    candidatesPlaced: cPlaced[0]?.cnt ?? 0,
    needsTotal: nTotal[0]?.cnt ?? 0,
    needsFilled: nFilled[0]?.cnt ?? 0,
    schoolYear: sy.label,
  };
}

// ─── Sources du lead ──────────────────────────────────────────────────────────

export async function getSourcesData(scope: DashboardScope, startYear?: number): Promise<{
  sources: { source: string; count: number }[];
  schoolYear: string;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const rows = await db
    .select({
      source: sql<string>`COALESCE(NULLIF(${candidates.source}, ''), 'Non renseigné')`,
      cnt: count(),
    })
    .from(candidates)
    .where(
      and(
        isNull(candidates.deletedAt),
        gte(candidates.createdAt, sy.start),
        lte(candidates.createdAt, sy.end),
        scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
      )
    )
    .groupBy(sql`COALESCE(NULLIF(${candidates.source}, ''), 'Non renseigné')`)
    .orderBy(desc(count()));

  return {
    sources: rows.map((r) => ({ source: r.source, count: r.cnt })),
    schoolYear: sy.label,
  };
}

// ─── Pipeline cursus ──────────────────────────────────────────────────────────

export async function getPipelineCursusData(scope: DashboardScope, startYear?: number): Promise<{
  rows: { cursus: string; inPipeline: number; placed: number }[];
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const [pipelineRows, placedRows] = await Promise.all([
    db
      .select({
        cursus: sql<string>`COALESCE(NULLIF(${candidates.cursusEnvisage}, ''), 'Non renseigné')`,
        cnt: count(),
      })
      .from(candidates)
      .where(
        and(
          isNull(candidates.deletedAt),
          sql`${candidates.status}::text != ALL(ARRAY['definitive_refusal','temporary_refusal','rupture'])`,
          scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
        )
      )
      .groupBy(sql`COALESCE(NULLIF(${candidates.cursusEnvisage}, ''), 'Non renseigné')`),

    db
      .select({
        cursus: sql<string>`COALESCE(NULLIF(${candidates.cursusEnvisage}, ''), 'Non renseigné')`,
        cnt: count(),
      })
      .from(candidates)
      .where(
        and(
          isNull(candidates.deletedAt),
          eq(candidates.status, "placed"),
          gte(candidates.createdAt, sy.start),
          lte(candidates.createdAt, sy.end),
          scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
        )
      )
      .groupBy(sql`COALESCE(NULLIF(${candidates.cursusEnvisage}, ''), 'Non renseigné')`),
  ]);

  const placedMap = new Map(placedRows.map((r) => [r.cursus, r.cnt]));

  const merged = pipelineRows
    .map((r) => ({
      cursus: r.cursus,
      inPipeline: r.cnt,
      placed: placedMap.get(r.cursus) ?? 0,
    }))
    .sort((a, b) => b.inPipeline - a.inPipeline);

  return { rows: merged };
}

// ─── Placements par classe ────────────────────────────────────────────────────

export async function getPlacementsParClasseData(scope: DashboardScope, startYear?: number): Promise<{
  rows: { classId: string; className: string; cursusName: string; total: number }[];
  hasData: boolean;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const ownerProfile = alias(profiles, "owner_p");

  const rows = await db
    .select({
      classId: classes.id,
      className: classes.name,
      cursusName: cursus.name,
      cnt: count(),
    })
    .from(matchings)
    .innerJoin(classes, eq(matchings.classId, classes.id))
    .innerJoin(cursus, eq(classes.cursusId, cursus.id))
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .leftJoin(ownerProfile, eq(candidates.ownerId, ownerProfile.id))
    .where(
      and(
        eq(matchings.isWinner, true),
        isNull(candidates.deletedAt),
        gte(candidates.updatedAt, sy.start),
        lte(candidates.updatedAt, sy.end),
        scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
      )
    )
    .groupBy(classes.id, classes.name, cursus.name)
    .orderBy(desc(count()));

  return {
    rows: rows.map((r) => ({
      classId: r.classId,
      className: r.className,
      cursusName: r.cursusName,
      total: r.cnt,
    })),
    hasData: rows.length > 0,
  };
}

// ─── Délai moyen de placement ─────────────────────────────────────────────────

export async function getDelaiPlacementData(scope: DashboardScope, startYear?: number): Promise<{
  avgDays: number | null;
  byCursus: { cursus: string; avgDays: number }[];
  schoolYear: string;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const baseWhere = and(
    isNull(candidates.deletedAt),
    eq(candidates.status, "placed"),
    gte(candidates.createdAt, sy.start),
    lte(candidates.createdAt, sy.end),
    scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
  );

  const [globalRow, cursusRows] = await Promise.all([
    db
      .select({
        avg: sql<number>`ROUND(AVG(EXTRACT(EPOCH FROM (${candidates.updatedAt} - ${candidates.createdAt})) / 86400))`,
      })
      .from(candidates)
      .where(baseWhere),
    db
      .select({
        cursus: sql<string>`COALESCE(NULLIF(${candidates.cursusEnvisage}, ''), 'Non renseigné')`,
        avg: sql<number>`ROUND(AVG(EXTRACT(EPOCH FROM (${candidates.updatedAt} - ${candidates.createdAt})) / 86400))`,
      })
      .from(candidates)
      .where(baseWhere)
      .groupBy(sql`COALESCE(NULLIF(${candidates.cursusEnvisage}, ''), 'Non renseigné')`)
      .orderBy(sql`AVG(EXTRACT(EPOCH FROM (${candidates.updatedAt} - ${candidates.createdAt})))`)
      .limit(6),
  ]);

  return {
    avgDays: globalRow[0]?.avg ?? null,
    byCursus: cursusRows.map((r) => ({ cursus: r.cursus, avgDays: r.avg })),
    schoolYear: sy.label,
  };
}

// ─── Taux de rupture ──────────────────────────────────────────────────────────

export async function getTauxRuptureData(scope: DashboardScope, startYear?: number): Promise<{
  ruptures: number;
  placements: number;
  schoolYear: string;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const baseWhere = and(
    isNull(candidates.deletedAt),
    gte(candidates.createdAt, sy.start),
    lte(candidates.createdAt, sy.end),
    scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
  );

  const [ruptureRow, placedRow] = await Promise.all([
    db.select({ cnt: count() }).from(candidates).where(and(baseWhere, eq(candidates.status, "rupture"))),
    db.select({ cnt: count() }).from(candidates).where(and(baseWhere, eq(candidates.status, "placed"))),
  ]);

  return {
    ruptures: ruptureRow[0]?.cnt ?? 0,
    placements: placedRow[0]?.cnt ?? 0,
    schoolYear: sy.label,
  };
}

// ─── Comparatif N / N-1 ───────────────────────────────────────────────────────

export async function getComparatifData(scope: DashboardScope, startYear?: number): Promise<{
  current: { label: string; candidatesPlaced: number; candidatesTotal: number; needsFilled: number; needsTotal: number };
  previous: { label: string; candidatesPlaced: number; candidatesTotal: number; needsFilled: number; needsTotal: number };
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();
  const syPrev = schoolYearFromStart(sy.startYear - 1);

  async function fetchForYear(s: typeof sy) {
    const base = (start: Date, end: Date) =>
      and(
        isNull(candidates.deletedAt),
        gte(candidates.createdAt, start),
        lte(candidates.createdAt, end),
        scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
      );
    const needBase = (start: Date, end: Date) =>
      and(
        isNull(needs.deletedAt),
        gte(needs.createdAt, start),
        lte(needs.createdAt, end),
        scope === "personal" ? eq(needs.ownerId, actor.id) : undefined
      );

    const [cTotal, cPlaced, nTotal, nFilled] = await Promise.all([
      db.select({ cnt: count() }).from(candidates).where(base(s.start, s.end)),
      db.select({ cnt: count() }).from(candidates).where(and(base(s.start, s.end), eq(candidates.status, "placed"))),
      db.select({ cnt: count() }).from(needs).where(and(needBase(s.start, s.end), sql`${needs.status} != 'lost'`)),
      db.select({ cnt: count() }).from(needs).where(and(needBase(s.start, s.end), eq(needs.status, "client"))),
    ]);
    return {
      label: s.label,
      candidatesTotal: cTotal[0]?.cnt ?? 0,
      candidatesPlaced: cPlaced[0]?.cnt ?? 0,
      needsTotal: nTotal[0]?.cnt ?? 0,
      needsFilled: nFilled[0]?.cnt ?? 0,
    };
  }

  const [current, previous] = await Promise.all([fetchForYear(sy), fetchForYear(syPrev)]);
  return { current, previous };
}

// ─── Activité par conseiller ──────────────────────────────────────────────────

export async function getActiviteConseillerData(scope: DashboardScope, startYear?: number): Promise<{
  rows: { userId: string; name: string; events: number; tasksCompleted: number }[];
  schoolYear: string;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const sy = startYear != null ? schoolYearFromStart(startYear) : currentSchoolYear();

  const [eventRows, taskRows] = await Promise.all([
    db
      .select({
        userId: activityEvents.actorId,
        name: profiles.fullName,
        cnt: count(),
      })
      .from(activityEvents)
      .innerJoin(profiles, eq(activityEvents.actorId, profiles.id))
      .where(
        and(
          gte(activityEvents.createdAt, sy.start),
          lte(activityEvents.createdAt, sy.end),
          scope === "personal" ? eq(activityEvents.actorId, actor.id) : undefined
        )
      )
      .groupBy(activityEvents.actorId, profiles.fullName)
      .orderBy(desc(count())),

    db
      .select({
        userId: tasks.assignedTo,
        cnt: count(),
      })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          sql`${tasks.completedAt} IS NOT NULL`,
          gte(tasks.completedAt, sy.start),
          lte(tasks.completedAt, sy.end),
          scope === "personal" ? eq(tasks.assignedTo, actor.id) : undefined
        )
      )
      .groupBy(tasks.assignedTo),
  ]);

  const taskMap = new Map(taskRows.map((r) => [r.userId, r.cnt]));

  return {
    rows: eventRows.map((r) => ({
      userId: r.userId ?? "",
      name: r.name ?? "Inconnu",
      events: r.cnt,
      tasksCompleted: taskMap.get(r.userId ?? "") ?? 0,
    })),
    schoolYear: sy.label,
  };
}

// ─── Nouvelles inscriptions ───────────────────────────────────────────────────

export async function getNouvellesInscriptionsData(scope: DashboardScope): Promise<{
  last7: number;
  last30: number;
  prev7: number;
  prev30: number;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400_000);
  const d14 = new Date(now.getTime() - 14 * 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const d60 = new Date(now.getTime() - 60 * 86400_000);

  const base = (start: Date, end: Date) =>
    and(
      isNull(candidates.deletedAt),
      gte(candidates.createdAt, start),
      lte(candidates.createdAt, end),
      scope === "personal" ? eq(candidates.ownerId, actor.id) : undefined
    );

  const [r7, r30, p7, p30] = await Promise.all([
    db.select({ cnt: count() }).from(candidates).where(base(d7, now)),
    db.select({ cnt: count() }).from(candidates).where(base(d30, now)),
    db.select({ cnt: count() }).from(candidates).where(base(d14, d7)),
    db.select({ cnt: count() }).from(candidates).where(base(d60, d30)),
  ]);

  return {
    last7: r7[0]?.cnt ?? 0,
    last30: r30[0]?.cnt ?? 0,
    prev7: p7[0]?.cnt ?? 0,
    prev30: p30[0]?.cnt ?? 0,
  };
}

// ─── Nouveaux besoins ─────────────────────────────────────────────────────────

export async function getNouveauxBesoinsData(scope: DashboardScope): Promise<{
  last7: number;
  last30: number;
  prev7: number;
  prev30: number;
}> {
  const actor = await requireAuth();
  scope = enforceScope(actor.role, scope);
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400_000);
  const d14 = new Date(now.getTime() - 14 * 86400_000);
  const d30 = new Date(now.getTime() - 30 * 86400_000);
  const d60 = new Date(now.getTime() - 60 * 86400_000);

  const base = (start: Date, end: Date) =>
    and(
      isNull(needs.deletedAt),
      gte(needs.createdAt, start),
      lte(needs.createdAt, end),
      scope === "personal" ? eq(needs.ownerId, actor.id) : undefined
    );

  const [r7, r30, p7, p30] = await Promise.all([
    db.select({ cnt: count() }).from(needs).where(base(d7, now)),
    db.select({ cnt: count() }).from(needs).where(base(d30, now)),
    db.select({ cnt: count() }).from(needs).where(base(d14, d7)),
    db.select({ cnt: count() }).from(needs).where(base(d60, d30)),
  ]);

  return {
    last7: r7[0]?.cnt ?? 0,
    last30: r30[0]?.cnt ?? 0,
    prev7: p7[0]?.cnt ?? 0,
    prev30: p30[0]?.cnt ?? 0,
  };
}

// ─── Ruptures en cours ────────────────────────────────────────────────────────

export type RuptureEnCours = {
  id: string;
  firstName: string;
  lastName: string;
  ruptureRechercheDeadline: string;
};

export async function getRupturesEnCours(): Promise<RuptureEnCours[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      ruptureRechercheDeadline: candidates.ruptureRechercheDeadline,
    })
    .from(candidates)
    .where(
      and(
        eq(candidates.status, "rupture"),
        isNull(candidates.deletedAt),
        isNotNull(candidates.ruptureRechercheDeadline),
      )
    )
    .orderBy(asc(candidates.ruptureRechercheDeadline));

  return rows
    .filter((r) => r.ruptureRechercheDeadline !== null)
    .map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      ruptureRechercheDeadline: r.ruptureRechercheDeadline!,
    }));
}

// ─── Mes tâches ───────────────────────────────────────────────────────────────

export type MyTaskRow = {
  id: string;
  title: string;
  category: string;
  dueAt: string;
  candidateId: string | null;
  candidateName: string | null;
  candidateStatus: string | null;
};

// Tâches ouvertes de l'utilisateur connecté, avec le premier candidat lié
// (nécessaire au flux entretien : démarrer / non présent).
export async function getMyTasksData(): Promise<MyTaskRow[]> {
  const actor = await requireAuth();

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      dueAt: tasks.dueAt,
      legacyCandidateId: tasks.candidateId,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.assignedTo, actor.id),
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
      )
    )
    .orderBy(asc(tasks.dueAt))
    .limit(50);

  if (rows.length === 0) return [];

  const taskIds = rows.map((r) => r.id);
  const linkRows = await db
    .select({ taskId: taskLinks.taskId, entityId: taskLinks.entityId })
    .from(taskLinks)
    .where(and(inArray(taskLinks.taskId, taskIds), eq(taskLinks.entityType, "candidate")))
    .orderBy(asc(taskLinks.createdAt));

  const candidateByTask = new Map<string, string>();
  for (const link of linkRows) {
    if (!candidateByTask.has(link.taskId)) candidateByTask.set(link.taskId, link.entityId);
  }
  for (const row of rows) {
    if (!candidateByTask.has(row.id) && row.legacyCandidateId) {
      candidateByTask.set(row.id, row.legacyCandidateId);
    }
  }

  const candidateIds = [...new Set(candidateByTask.values())];
  const candidateRows = candidateIds.length
    ? await db
        .select({
          id: candidates.id,
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          status: candidates.status,
        })
        .from(candidates)
        .where(and(inArray(candidates.id, candidateIds), isNull(candidates.deletedAt)))
    : [];
  const candidateMap = new Map(candidateRows.map((c) => [c.id, c]));

  return rows.map((r) => {
    const candidateId = candidateByTask.get(r.id) ?? null;
    const candidat = candidateId ? candidateMap.get(candidateId) : undefined;
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      dueAt: r.dueAt.toISOString(),
      candidateId: candidat?.id ?? null,
      candidateName: candidat ? `${candidat.firstName} ${candidat.lastName}` : null,
      candidateStatus: candidat?.status ?? null,
    };
  });
}
