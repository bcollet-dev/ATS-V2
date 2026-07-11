import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptSecret } from "@/lib/secret-box";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code        = searchParams.get("code");
  const state       = searchParams.get("state");
  const error       = searchParams.get("error");
  const storedState = request.cookies.get("gmail_oauth_state")?.value;
  const storedNext  = request.cookies.get("gmail_oauth_next")?.value ?? "/trames/mail";
  const nextPath    = storedNext.startsWith("/") && !storedNext.startsWith("//")
    ? storedNext
    : "/trames/mail";

  function done(path: string) {
    const res = NextResponse.redirect(`${origin}${path}`);
    res.cookies.delete("gmail_oauth_state");
    res.cookies.delete("gmail_oauth_next");
    return res;
  }

  if (error === "access_denied") return done("/trames/mail");
  if (!code || !state || !storedState || state !== storedState) {
    return done("/trames/mail?gmail=error");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return done("/login");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${origin}/auth/gmail/callback`,
      grant_type:    "authorization_code",
    }).toString(),
  });

  if (!tokenRes.ok) return done("/trames/mail?gmail=error");

  const tokens = await tokenRes.json() as { refresh_token?: string };
  if (!tokens.refresh_token) return done("/trames/mail?gmail=no_token");

  await db
    .update(profiles)
    .set({ googleRefreshToken: encryptSecret(tokens.refresh_token) })
    .where(eq(profiles.id, user.id));

  return done(nextPath === "/trames/mail" ? "/trames/mail?gmail=connected" : nextPath);
}
