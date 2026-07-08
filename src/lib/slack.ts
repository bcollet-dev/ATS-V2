type SlackBlock = Record<string, unknown>;

export type SlackResult = { ok: true } | { ok: false; error: string };

export async function sendSlackNotification(
  webhookUrl: string,
  blocks: SlackBlock[],
): Promise<SlackResult> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Slack a répondu ${res.status}${text ? ` : ${text}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}

export function buildPlacementBlocks({
  candidateName,
  companyName,
  className,
  contractStartDate,
}: {
  candidateName: string;
  companyName: string;
  className: string;
  contractStartDate: string | null;
}): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `✅ *${candidateName}* validé(e) dans l'entreprise *${companyName}*\nClasse : *${className}*\nDébut du contrat : ${contractStartDate ?? "—"}`,
      },
    },
  ];
}

export function buildFreBlocks({
  candidateName,
  companyName,
  className,
}: {
  candidateName: string;
  companyName: string;
  className: string;
}): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 *${candidateName}* — FRE à compléter\nEntreprise : *${companyName}*\nClasse : *${className}*`,
      },
    },
  ];
}

export function buildEntretienBlocks({
  candidateName,
  companyName,
}: {
  candidateName: string;
  companyName: string;
}): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🤝 *${candidateName}* — Entretien entreprise\nEntreprise : *${companyName}*`,
      },
    },
  ];
}

export function buildRuptureBlocks({
  candidateName,
  companyName,
  motif,
  commentaire,
}: {
  candidateName: string;
  companyName: string;
  motif?: string | null;
  commentaire?: string | null;
}): SlackBlock[] {
  const lines = [`💔 *${candidateName}* — Rupture de contrat\nEntreprise : *${companyName}*`];
  if (motif) lines.push(`Motif : ${motif}`);
  if (commentaire) lines.push(`Commentaire : ${commentaire}`);
  return [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }];
}

export function buildAbandonBlocks({
  candidateName,
  companyName,
  motif,
  commentaire,
}: {
  candidateName: string;
  companyName: string;
  motif?: string | null;
  commentaire?: string | null;
}): SlackBlock[] {
  const lines = [`🚪 *${candidateName}* — Abandon de formation\nEntreprise : *${companyName}*`];
  if (motif) lines.push(`Motif : ${motif}`);
  if (commentaire) lines.push(`Commentaire : ${commentaire}`);
  return [{ type: "section", text: { type: "mrkdwn", text: lines.join("\n") } }];
}

export function buildTestBlocks(className: string): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔔 *Test de notification* — Canal configuré pour la classe *${className}*`,
      },
    },
  ];
}
