import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGoogleTokenAdminClient } from "@/lib/google-calendar";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const admin = createGoogleTokenAdminClient();
    const { data, error } = await admin
      .from("johden_google_calendar_tokens")
      .select("connected_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(
      { connected: Boolean(data), connectedAt: data?.connected_at ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ connected: false, error: "status_unavailable" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
