"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { candidates, matchings, needs } from "@/db/schema";
import { eq, and, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  postRuptureContrat,
  postCreerDepart,
  getMotifDepart,
  type MotifRuptureCode,
} from "@/lib/ypareo/client";
import { syncNeedStatusFromMatchings } from "@/app/(app)/matching/actions";

export type TriggerRuptureInput = {
  matchingId: string;
  date: string;
  motif: MotifRuptureCode;
  commentaire?: string;
  resteEnFormation: boolean;
  motifDepartId?: string;
};

type ActionResult = { success: true } | { success: false; error: string };

export async function triggerRupture(input: TriggerRuptureInput): Promise<ActionResult> {
  await requireAuth();

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

  try {
    await postRuptureContrat(matching.ypareoContratId, {
      date: input.date,
      motif: input.motif,
      ...(input.commentaire ? { commentaire: input.commentaire } : {}),
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur Ypareo lors de la rupture contrat" };
  }

  if (!input.resteEnFormation) {
    if (!matching.ypareoInscriptionId) return { success: false, error: "Aucune inscription Ypareo pour créer le départ" };
    if (!input.motifDepartId) return { success: false, error: "Motif de départ requis" };
    try {
      await postCreerDepart(matching.ypareoInscriptionId, {
        dateDepart: input.date,
        idMotifDepart: input.motifDepartId,
      });
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Erreur Ypareo lors du départ inscription" };
    }
  }

  const now = new Date();
  const candidateId = matching.candidateId as string;
  const needId = matching.needId as string;

  // Le matching ruptured passe toujours en contract_break
  await db
    .update(matchings)
    .set({ propositionStatus: "contract_break", isWinner: false, updatedAt: now })
    .where(eq(matchings.id, matching.id));

  if (input.resteEnFormation) {
    const ruptureDate = new Date(input.date);
    const deadline = new Date(ruptureDate);
    deadline.setMonth(deadline.getMonth() + 6);

    await db
      .update(candidates)
      .set({ status: "contract_break", ruptureRechercheDeadline: deadline.toISOString().slice(0, 10), updatedAt: now })
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
          notInArray(matchings.propositionStatus, ["not_retained", "contract_break"]),
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

  revalidatePath("/candidats");
  revalidatePath("/besoins");
  return { success: true };
}

export async function triggerAbandon(matchingId: string, motifDepartId: string): Promise<ActionResult> {
  await requireAuth();

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

  try {
    await postRuptureContrat(matching.ypareoContratId, { date: today, motif: 2, commentaire: "Abandon" });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur Ypareo rupture contrat" };
  }

  try {
    await postCreerDepart(matching.ypareoInscriptionId, { dateDepart: today, idMotifDepart: motifDepartId });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur Ypareo départ inscription" };
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

  revalidatePath("/candidats");
  revalidatePath("/besoins");
  return { success: true };
}

export async function getMotifsDepartYpareo() {
  return getMotifDepart();
}
