import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";

  // Utilisateur a annulé le consentement Google → retour propre sans message d'erreur
  if (error === "access_denied") {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Erreur GoTrue (trigger RAISE EXCEPTION = server_error, ou autre)
  // → non autorisé, message explicite
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=unauthorized`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (!sessionError && data.session) {
      const refreshToken = data.session.provider_refresh_token;
      if (refreshToken) {
        await db
          .update(profiles)
          .set({ googleRefreshToken: refreshToken })
          .where(eq(profiles.id, data.session.user.id));
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Échec technique (réseau, expiration du code, etc.)
  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
