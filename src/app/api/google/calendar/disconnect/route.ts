import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createGoogleTokenAdminClient } from "@/lib/google-calendar";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  try {
    const admin = createGoogleTokenAdminClient();
    const { error } = await admin
      .from("johden_google_calendar_tokens")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ disconnected: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }
}
