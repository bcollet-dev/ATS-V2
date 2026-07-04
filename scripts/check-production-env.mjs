import { existsSync, readFileSync } from "node:fs";

const envFiles = [".env.local", ".env.production.local", ".env"];

for (const file of envFiles) {
  if (!existsSync(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rawValue] = trimmed.split("=");
    const key = rawKey.trim();
    if (process.env[key]) continue;
    process.env[key] = rawValue.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "APP_ENCRYPTION_KEY",
  "NIR_ENCRYPTION_KEY",
  "YPAREO_BASE_URL",
  "YPAREO_IDENTIFICATION_TOKEN",
  "YPAREO_PLACEMENT_PATH",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ANTHROPIC_API_KEY",
  "AI_EXTRACTION_ENABLED",
  "AI_EXTRACTION_DPO_APPROVED",
  "CRON_SECRET",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
];

const placeholderPatterns = [
  /^your-/i,
  /^change-me$/i,
  /^todo$/i,
  /\[project-ref\]/i,
  /\[password\]/i,
  /<project-ref>/i,
];

const errors = [];
const warnings = [];

for (const key of required) {
  const value = process.env[key]?.trim();
  if (!value) {
    errors.push(`${key} est manquant`);
    continue;
  }
  if (placeholderPatterns.some((pattern) => pattern.test(value))) {
    errors.push(`${key} contient encore une valeur exemple`);
  }
}

const urlKeys = ["NEXT_PUBLIC_SUPABASE_URL", "YPAREO_BASE_URL", "DATABASE_URL"];
for (const key of urlKeys) {
  const value = process.env[key]?.trim();
  if (!value) continue;
  try {
    const url = new URL(value);
    if (key === "DATABASE_URL" && !["postgresql:", "postgres:"].includes(url.protocol)) {
      errors.push("DATABASE_URL doit etre une URL PostgreSQL");
    }
  } catch {
    errors.push(`${key} n'est pas une URL valide`);
  }
}

const placementPath = process.env.YPAREO_PLACEMENT_PATH?.trim() ?? "";
if (placementPath && !placementPath.startsWith("/")) {
  errors.push("YPAREO_PLACEMENT_PATH doit commencer par /");
}

for (const key of ["APP_ENCRYPTION_KEY", "NIR_ENCRYPTION_KEY"]) {
  const value = process.env[key]?.trim() ?? "";
  if (value && !/^[0-9a-f]{64}$/i.test(value)) {
    errors.push(`${key} doit contenir 64 caracteres hexadecimaux`);
  }
}

const aiEnabled = process.env.AI_EXTRACTION_ENABLED?.trim();
if (aiEnabled && !["true", "false"].includes(aiEnabled)) {
  errors.push("AI_EXTRACTION_ENABLED doit valoir true ou false");
}
if (aiEnabled !== "true") {
  errors.push("AI_EXTRACTION_ENABLED doit valoir true pour ce lancement avec extraction IA automatique");
}
if (aiEnabled === "true" && process.env.AI_EXTRACTION_DPO_APPROVED?.trim() !== "true") {
  errors.push("AI_EXTRACTION_DPO_APPROVED=true est requis pour activer l'extraction IA en production");
}

if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
  warnings.push("NEXT_PUBLIC_SENTRY_DSN absent: monitoring Sentry non actif");
}

if ((process.env.CRON_SECRET?.trim() ?? "").length < 32) {
  warnings.push("CRON_SECRET devrait contenir au moins 32 caracteres aleatoires");
}

if (errors.length > 0) {
  console.error("Configuration production invalide:");
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length > 0) {
    console.error("\nAvertissements:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log("Configuration production: OK");
for (const warning of warnings) console.warn(`Avertissement: ${warning}`);
