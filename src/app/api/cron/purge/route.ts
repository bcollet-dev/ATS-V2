import { NextResponse, type NextRequest } from "next/server";
import { runPurge } from "@/app/(app)/settings/rgpd/actions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron non configuré" }, { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPurge();
  return NextResponse.json({ ok: true, ...result });
}
