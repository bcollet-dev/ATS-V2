import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const url = new URL(request.url);
  const origin = url.origin;
  const requestedNext = url.searchParams.get("next") ?? "/trames-mail";
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/trames-mail";
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${origin}/auth/gmail/callback`,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/gmail.send",
    access_type:   "offline",
    prompt:        "select_account consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  response.cookies.set("gmail_oauth_next", nextPath, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
