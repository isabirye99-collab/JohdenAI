import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createGoogleTokenAdminClient,
  encryptGoogleToken,
  googleRedirectUri,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
};

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const redirectToDashboard = (result: string) =>
    NextResponse.redirect(new URL(`/dashboard?calendar=${result}`, origin));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const stateCookie = request.cookies.get("johden_google_oauth_state")?.value;
  const stateParam = request.nextUrl.searchParams.get("state");
  if (!stateCookie || !stateParam || stateCookie !== stateParam) return redirectToDashboard("security_error");

  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) return redirectToDashboard("cancelled");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirectToDashboard("setup_error");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !tokens.access_token) return redirectToDashboard("token_error");

    const admin = createGoogleTokenAdminClient();
    const { data: existing, error: readError } = await admin
      .from("johden_google_calendar_tokens")
      .select("refresh_token_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) return redirectToDashboard("save_error");

    const refreshToken = tokens.refresh_token
      ? encryptGoogleToken(tokens.refresh_token)
      : existing?.refresh_token_encrypted;
    if (!refreshToken) return redirectToDashboard("consent_required");

    const { error: saveError } = await admin.from("johden_google_calendar_tokens").upsert({
      user_id: user.id,
      google_email: user.email ?? null,
      refresh_token_encrypted: refreshToken,
      scopes: (tokens.scope ?? "https://www.googleapis.com/auth/calendar.freebusy").split(" "),
      updated_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) return redirectToDashboard("save_error");
    return redirectToDashboard("connected");
  } catch {
    return redirectToDashboard("connection_error");
  }
}
