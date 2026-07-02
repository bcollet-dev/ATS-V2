// Feedback loop : vérifie chaque pré-condition du chemin d'envoi email
// Usage : node scripts/test-gmail-send.mjs
import { config } from "dotenv";
import { createRequire } from "module";
config({ path: ".env.local" });

const clientId     = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log("\n=== Pré-conditions ===");

// 1. Env vars
if (!clientId || !clientSecret) {
  console.error("❌ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants");
  process.exit(1);
}
console.log("✅ GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET présents");

// 2. Refresh token en base
const { default: postgres } = await import("postgres");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
const [profile] = await sql`
  SELECT email, google_refresh_token
  FROM profiles
  WHERE deleted_at IS NULL
  LIMIT 1
`;
await sql.end();

if (!profile) {
  console.error("❌ Aucun profil trouvé en base");
  process.exit(1);
}
if (!profile.google_refresh_token) {
  console.error(`❌ google_refresh_token NULL pour ${profile.email}`);
  console.error("   → L'utilisateur doit compléter le flux Gmail OAuth (/trames-mail > Paramétrage > Connecter Gmail)");
  process.exit(1);
}
console.log(`✅ Refresh token présent pour ${profile.email}`);

// 3. Test OAuth2 token refresh
console.log("\n=== Test token OAuth2 ===");
const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    refresh_token: profile.google_refresh_token,
    grant_type:    "refresh_token",
  }).toString(),
});
const tokenData = await tokenRes.json();
if (!tokenRes.ok || !tokenData.access_token) {
  console.error("❌ Refresh token invalide ou expiré :", tokenData.error, tokenData.error_description);
  process.exit(1);
}
console.log("✅ access_token obtenu");

// 4. Test envoi nodemailer
console.log("\n=== Test envoi ===");
const { default: nodemailer } = await import("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type:         "OAuth2",
    user:         profile.email,
    clientId,
    clientSecret,
    refreshToken: profile.google_refresh_token,
  },
});
try {
  await transporter.sendMail({
    from:    `"ATS Test" <${profile.email}>`,
    to:      profile.email,
    subject: "[TEST] ATS Gmail OAuth — diagnostic",
    text:    "Si vous lisez ce message, l'envoi Gmail fonctionne correctement.",
  });
  console.log(`✅ Email de test envoyé à ${profile.email}`);
} catch (err) {
  console.error("❌ Échec envoi :", err.message);
  process.exit(1);
}
