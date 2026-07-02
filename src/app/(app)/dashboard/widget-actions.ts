"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  candidates, needs, tasks, activityEvents, matchings, classes, cursus,
  profiles,
} from "@/db/schema";
import { eq, and, isNull, lt, inArray, gte, lte, desc, asc, count, max, sql, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { currentSchoolYear } from "@/lib/dashboard/school-year";
import type { DashboardScope } from "./DashboardClient";

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
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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
            or(isNull(lastAct.lastAt), lt(lastAct.lastAt, sevenDaysAgo)),
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

export async function getBesoinsPerduData(scope: DashboardScope): Promise<{
  total: number;
  topMotifs: { motif: string; count: number }[];
  schoolYear: string;
}> {
  const actor = await requireAuth();
  const sy = currentSchoolYear();

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

export async function getTauxPlacementData(scope: DashboardScope): Promise<{
  candidatesPlaced: number;
  candidatesTotal: number;
  needsFilled: number;
  needsTotal: number;
  schoolYear: string;
}> {
  const actor = await requireAuth();
  const sy = currentSchoolYear();

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

export async function getSourcesData(scope: DashboardScope): Promise<{
  sources: { source: string; count: number }[];
  schoolYear: string;
}> {
  const actor = await requireAuth();
  const sy = currentSchoolYear();

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

const ARCHIVED_STATUSES = ["definitive_refusal", "temporary_refusal", "contract_break"];

export async function getPipelineCursusData(scope: DashboardScope): Promise<{
  rows: { cursus: string; inPipeline: number; placed: number }[];
}> {
  const actor = await requireAuth();
  const sy = currentSchoolYear();

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
          sql`${candidates.status} != ALL(ARRAY['definitive_refusal','temporary_refusal','contract_break']::text[])`,
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

export async function getPlacementsParClasseData(scope: DashboardScope): Promise<{
  rows: { classId: string; className: string; cursusName: string; total: number }[];
  hasData: boolean;
}> {
  const actor = await requireAuth();
  const sy = currentSchoolYear();

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
