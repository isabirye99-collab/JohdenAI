import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createGoogleTokenAdminClient,
  decryptGoogleToken,
  getGoogleCalendarEnv,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

type StoredToken = { refresh_token_encrypted: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  let timeMin: string;
  let timeMax: string;
  try {
    const body = await request.json() as { timeMin?: string; timeMax?: string };
    timeMin = String(body.timeMin ?? "");
    timeMax = String(body.timeMax ?? "");
    const start = Date.parse(timeMin);
    const end = Date.parse(timeMax);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "invalid_time_range" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const admin = createGoogleTokenAdminClient();
    const { data, error } = await admin
      .from("johden_google_calendar_tokens")
      .select("refresh_token_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    const stored = data as StoredToken | null;
    if (!stored) return NextResponse.json({ error: "calendar_not_connected" }, { status: 409 });

    const clientId = getGoogleCalendarEnv("GOOGLE_CLIENT_ID");
    const clientSecret = getGoogleCalendarEnv("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new Error("Google OAuth configuration is missing.");

    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptGoogleToken(stored.refresh_token_encrypted),
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const refreshed = await refreshResponse.json() as { access_token?: string };
    if (!refreshResponse.ok || !refreshed.access_token) {
      return NextResponse.json({ error: "google_reauthorization_required" }, { status: 401 });
    }

    const busyResponse = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshed.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      }),
      cache: "no-store",
    });
    const busy = await busyResponse.json() as {
      calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } };
    };
    if (!busyResponse.ok) return NextResponse.json({ error: "calendar_availability_failed" }, { status: 502 });
    return NextResponse.json(
      { busy: busy.calendars?.primary?.busy ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "availability_unavailable" }, { status: 500 });
  }
}
