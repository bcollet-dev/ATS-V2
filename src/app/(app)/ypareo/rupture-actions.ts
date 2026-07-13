"use server";

import { requireAuth, requireMutator } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import { candidates, matchings, needs, companies, appSettings, ypareoLogs } from "@/db/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  postRuptureContrat,
  postCreerDepart,
  getMotifDepart,
  MOTIFS_RUPTURE_CONTRAT,
  type MotifRuptureCode,
} from "@/lib/ypareo/client";
import { isRuptureAlreadyApplied } from "@/lib/ypareo/rupture-rules";
import { syncNeedStatusFromMatchings } from "@/app/(app)/matching/actions";
import { sendSlackNotification, buildRuptureBlocks, buildAbandonBlocks } from "@/lib/slack";

// Journal des échanges Ypareo — une ligne par appel (rupture contrat, départ
// inscription), corrélées entre elles comme pour le placement.
async function logYpareoCall(input: {
  correlationId: string;
  candidateId: string;
  operation: string;
  endpoint: string;
  requestPayload: Record<string, unknown>;
  actorId: string;
}): Promise<string> {
  const [log] = await db
    .insert(ypareoLogs)
    .values({
      correlationId: input.correlationId,
      candidateId: input.candidateId,
      operation: input.operation,
      endpoint: input.endpoint,
      method: "POST",
      requestPayload: input.requestPayload,
      status: "pending",
      createdBy: input.actorId,
    })
    .returning({ id: ypareoLogs.id });
  return log.id;
}

async function closeYpareoLog(
  logId: string,
  outcome: { ok: true; note?: string } | { ok: false; errorMessage: string }
): Promise<void> {
  await db
    .update(ypareoLogs)
    .set(
      outcome.ok
        ? { status: "success", responseStatus: 200, responsePayload: outcome.note ? { note: outcome.note } : {} }
        : { status: "error", errorMessage: outcome.errorMessage, responsePayload: { message: outcome.errorMessage }, retryable: true }
    )
    .where(eq(ypareoLogs.id, logId));
}

export type TriggerRuptureInput = {
  matchingId: string;
  date: string;
  motif: MotifRuptureCode;
  commentaire?: string;
  resteEnFormation: boolean;
  motifDepartId?: string;
};

type ActionResult = { success: true } | { success: false; error: string } | { success: "partial"; error: string };

export async function triggerRupture(input: TriggerRuptureInput): Promise<ActionResult> {
  const actor = await requireMutator();
  if (!can(actor.role as AppRole, "matchings:editStatus")) {
    return { success: false, error: "Vous n'avez pas les droits pour déclencher une rupture" };
  }

  const [matching] = await db
    .select({
      id: matchings.id,
      candidateId: matchings.candidateId,
      needId: matchings.needId,
      ypareoContratId: matchings.ypareoContratId,
      ypareoInscriptionId: matchings.ypareoInscriptionId,
    })
    .from(matchings)
    .where(eq(matchings.id, input.matchingId))
    .limit(1);

  if (!matching) return { success: false, error: "Matching introuvable" };
  if (!matching.ypareoContratId) return { success: false, error: "Aucun contrat Ypareo associé à ce matching" };

  const correlationId = randomUUID();

  // Rupture contrat — seul un 400 indiquant explicitement une rupture déjà
  // enregistrée côté Ypareo autorise à poursuivre la synchronisation ; tout
  // autre échec remonte sans toucher aux statuts (sinon l'ATS enregistrerait
  // une rupture qu'Ypareo a refusée).
  const ruptureLogId = await logYpareoCall({
    correlationId,
    candidateId: matching.candidateId as string,
    operation: "rupture_contrat",
    endpoint: `/contrat-apprentissage/${matching.ypareoContratId}/rupture`,
    requestPayload: { date: input.date, motif: input.motif, commentaire: input.commentaire ?? null },
    actorId: actor.id,
  });
  try {
    await postRuptureContrat(matching.ypareoContratId, {
      date: input.date,
      motif: input.motif,
      ...(input.commentaire ? { commentaire: input.commentaire } : {}),
    });
    await closeYpareoLog(ruptureLogId, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur Ypareo lors de la rupture contrat";
    if (!isRuptureAlreadyApplied(msg)) {
      await closeYpareoLog(ruptureLogId, { ok: false, errorMessage: msg });
      return { success: false, error: msg };
    }
    await closeYpareoLog(ruptureLogId, { ok: true, note: `Rupture déjà enregistrée côté Ypareo — synchronisation locale (${msg})` });
  }

  // Départ inscription — si ça échoue on met quand même la DB à jour et on signale l'erreur partielle
  let departError: string | null = null;
  if (!input.resteEnFormation) {
    if (!matching.ypareoInscriptionId) {
      departError = "Aucune inscription Ypareo pour créer le départ";
    } else if (!input.motifDepartId) {
      departError = "Motif de départ requis";
    } else {
      const departLogId = await logYpareoCall({
        correlationId,
        candidateId: matching.candidateId as string,
        operation: "depart_inscription",
        endpoint: `/inscription/${matching.ypareoInscriptionId}/creer-depart`,
        requestPayload: { dateDepart: input.date, idMotifDepart: input.motifDepartId },
        actorId: actor.id,
      });
      try {
        await postCreerDepart(matching.ypareoInscriptionId, {
          dateDepart: input.date,
          idMotifDepart: input.motifDepartId,
        });
        await closeYpareoLog(departLogId, { ok: true });
      } catch (err) {
        departError = err instanceof Error ? err.message : "Erreur Ypareo lors du départ inscription";
        await closeYpareoLog(departLogId, { ok: false, errorMessage: departError });
      }
    }
  }

  const now = new Date();
  const candidateId = matching.candidateId as string;
  const needId = matching.needId as string;

  // Le matching ruptured passe toujours en rupture
  await db
    .update(matchings)
    .set({ propositionStatus: "rupture", isWinner: false, updatedAt: now })
    .where(eq(matchings.id, matching.id));

  if (input.resteEnFormation) {
    const ruptureDate = new Date(input.date);
    const deadline = new Date(ruptureDate);
    deadline.setMonth(deadline.getMonth() + 6);

    await db
      .update(candidates)
      .set({ status: "rupture", ruptureRechercheDeadline: deadline.toISOString().slice(0, 10), updatedAt: now })
      .where(eq(candidates.id, candidateId));

    await db
      .update(needs)
      .set({ status: "rupture", updatedAt: now })
      .where(eq(needs.id, needId));
  } else {
    await db
      .update(candidates)
      .set({ status: "definitive_refusal", updatedAt: now })
      .where(eq(candidates.id, candidateId));

    const activeMatchings = await db
      .select({ id: matchings.id, needId: matchings.needId })
      .from(matchings)
      .where(
        and(
          eq(matchings.candidateId, candidateId),
          notInArray(matchings.propositionStatus, ["not_retained", "rupture"]),
        )
      );

    if (activeMatchings.length > 0) {
      await db
        .update(matchings)
        .set({ propositionStatus: "not_retained", refusalReason: "Rupture contrat — départ formation", updatedAt: now })
        .where(inArray(matchings.id, activeMatchings.map((m) => m.id)));

      const needIds = [...new Set(activeMatchings.map((m) => m.needId as string))];
      await Promise.all(needIds.map(syncNeedStatusFromMatchings));
    }
  }

  void sendRuptureSlack(candidateId, needId, input.motif, input.commentaire);

  revalidatePath("/candidats");
  revalidatePath("/besoins");
  if (departError) {
    return { success: "partial", error: `Rupture enregistrée dans Ypareo mais départ inscription non créé : ${departError}` };
  }
  return { success: true };
}

export async function triggerAbandon(matchingId: string, motifDepartId: string): Promise<ActionResult> {
  const actor = await requireMutator();
  if (!can(actor.role as AppRole, "matchings:editStatus")) {
    return { success: false, error: "Vous n'avez pas les droits pour déclencher un abandon" };
  }

  const [matching] = await db
    .select({
      id: matchings.id,
      candidateId: matchings.candidateId,
      needId: matchings.needId,
      ypareoContratId: matchings.ypareoContratId,
      ypareoInscriptionId: matchings.ypareoInscriptionId,
    })
    .from(matchings)
    .where(eq(matchings.id, matchingId))
    .limit(1);

  if (!matching) return { success: false, error: "Matching introuvable" };
  if (!matching.ypareoContratId) return { success: false, error: "Aucun contrat Ypareo associé" };
  if (!matching.ypareoInscriptionId) return { success: false, error: "Aucune inscription Ypareo associée" };

  const today = new Date().toISOString().slice(0, 10);
  const correlationId = randomUUID();

  const ruptureLogId = await logYpareoCall({
    correlationId,
    candidateId: matching.candidateId as string,
    operation: "rupture_contrat",
    endpoint: `/contrat-apprentissage/${matching.ypareoContratId}/rupture`,
    requestPayload: { date: today, motif: 2, commentaire: "Abandon" },
    actorId: actor.id,
  });
  try {
    await postRuptureContrat(matching.ypareoContratId, { date: today, motif: 2, commentaire: "Abandon" });
    await closeYpareoLog(ruptureLogId, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur Ypareo rupture contrat";
    await closeYpareoLog(ruptureLogId, { ok: false, errorMessage: msg });
    return { success: false, error: msg };
  }

  const departLogId = await logYpareoCall({
    correlationId,
    candidateId: matching.candidateId as string,
    operation: "depart_inscription",
    endpoint: `/inscription/${matching.ypareoInscriptionId}/creer-depart`,
    requestPayload: { dateDepart: today, idMotifDepart: motifDepartId },
    actorId: actor.id,
  });
  try {
    await postCreerDepart(matching.ypareoInscriptionId, { dateDepart: today, idMotifDepart: motifDepartId });
    await closeYpareoLog(departLogId, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur Ypareo départ inscription";
    await closeYpareoLog(departLogId, { ok: false, errorMessage: msg });
    return { success: false, error: msg };
  }

  const now = new Date();
  const candidateId = matching.candidateId as string;

  await db
    .update(candidates)
    .set({ status: "definitive_refusal", updatedAt: now })
    .where(eq(candidates.id, candidateId));

  const activeMatchings = await db
    .select({ id: matchings.id, needId: matchings.needId })
    .from(matchings)
    .where(
      and(
        eq(matchings.candidateId, candidateId),
        notInArray(matchings.propositionStatus, ["not_retained"]),
      )
    );

  if (activeMatchings.length > 0) {
    await db
      .update(matchings)
      .set({ propositionStatus: "not_retained", refusalReason: "Abandon formation", updatedAt: now })
      .where(inArray(matchings.id, activeMatchings.map((m) => m.id)));

    const needIds = [...new Set(activeMatchings.map((m) => m.needId as string))];
    await Promise.all(needIds.map(syncNeedStatusFromMatchings));
  }

  void sendAbandonSlack(candidateId, matching.needId as string);

  revalidatePath("/candidats");
  revalidatePath("/besoins");
  return { success: true };
}

export async function getMotifsDepartYpareo() {
  return getMotifDepart();
}

// ─── Slack helpers ────────────────────────────────────────────────────────────

async function getGlobalWebhookUrl(): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "slack_global_webhook"))
    .limit(1);
  const val = row?.value;
  return typeof val === "string" && val ? val : null;
}

async function resolveNames(
  candidateId: string,
  needId: string,
): Promise<{ candidateName: string; companyName: string }> {
  const [candidateRow, needRow] = await Promise.all([
    db.select({ firstName: candidates.firstName, lastName: candidates.lastName })
      .from(candidates).where(eq(candidates.id, candidateId)).limit(1),
    db.select({ companyId: needs.companyId }).from(needs).where(eq(needs.id, needId)).limit(1),
  ]);
  const candidateName = candidateRow[0]
    ? `${candidateRow[0].firstName} ${candidateRow[0].lastName.toUpperCase()}`
    : "Candidat";
  const companyId = needRow[0]?.companyId;
  const companyName = companyId
    ? (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1))[0]?.name ?? "Entreprise"
    : "Entreprise";
  return { candidateName, companyName };
}

async function sendRuptureSlack(
  candidateId: string,
  needId: string,
  motifCode: MotifRuptureCode,
  commentaire?: string,
): Promise<void> {
  try {
    const [webhookUrl, { candidateName, companyName }] = await Promise.all([
      getGlobalWebhookUrl(),
      resolveNames(candidateId, needId),
    ]);
    if (!webhookUrl) return;
    const motif = MOTIFS_RUPTURE_CONTRAT.find((m) => m.code === motifCode)?.label;
    await sendSlackNotification(webhookUrl, buildRuptureBlocks({ candidateName, companyName, motif, commentaire }));
  } catch {
    // Non-blocking
  }
}

async function sendAbandonSlack(candidateId: string, needId: string): Promise<void> {
  try {
    const [webhookUrl, { candidateName, companyName }] = await Promise.all([
      getGlobalWebhookUrl(),
      resolveNames(candidateId, needId),
    ]);
    if (!webhookUrl) return;
    await sendSlackNotification(webhookUrl, buildAbandonBlocks({ candidateName, companyName }));
  } catch {
    // Non-blocking
  }
}
