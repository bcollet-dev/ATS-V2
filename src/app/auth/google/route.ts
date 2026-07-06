import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  const { data } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: "https://www.googleapis.com/auth/gmail.send",
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (data.url) return NextResponse.redirect(data.url);
  redirect("/login?error=oauth");
}
