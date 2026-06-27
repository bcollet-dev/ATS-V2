import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel", email: "Email", document: "Document",
  follow_up: "Relance", interview: "Entretien", other: "Autre",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function isOverdue(d: Date): boolean {
  return d < new Date();
}

export async function sendDailyDigest({
  to,
  name,
  tasks,
}: {
  to: string;
  name: string;
  tasks: { title: string; category: string; dueAt: Date }[];
}) {
  if (!process.env.GMAIL_APP_PASSWORD) return;

  const overdue = tasks.filter((t) => isOverdue(t.dueAt));
  const upcoming = tasks.filter((t) => !isOverdue(t.dueAt));

  const lines: string[] = [
    `Bonjour ${name},`,
    "",
    `Voici le récap de vos ${tasks.length} tâche${tasks.length > 1 ? "s" : ""} en cours :`,
    "",
  ];

  if (overdue.length > 0) {
    lines.push("⚠️  EN RETARD :");
    overdue.forEach((t) => {
      lines.push(`  - [${CATEGORY_LABELS[t.category] ?? t.category}] ${t.title} (échue le ${formatDate(t.dueAt)})`);
    });
    lines.push("");
  }

  if (upcoming.length > 0) {
    lines.push("📋 À VENIR :");
    upcoming.forEach((t) => {
      lines.push(`  - [${CATEGORY_LABELS[t.category] ?? t.category}] ${t.title} (avant le ${formatDate(t.dueAt)})`);
    });
    lines.push("");
  }

  lines.push("Bonne journée !");

  await transporter.sendMail({
    from: `"ATS EDA Groupe" <${process.env.GMAIL_USER}>`,
    to,
    subject: `[ATS] Vos tâches du jour — ${tasks.length} tâche${tasks.length > 1 ? "s" : ""} en cours`,
    text: lines.join("\n"),
  });
}
