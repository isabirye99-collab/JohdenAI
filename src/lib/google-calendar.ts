import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type GoogleCalendarEnvName =
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "GOOGLE_TOKEN_ENCRYPTION_KEY"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "GOOGLE_REDIRECT_URI"
  | "NEXT_PUBLIC_SITE_URL";

export function getGoogleCalendarEnv(name: GoogleCalendarEnvName) {
  try {
    const cloudflareEnv = getCloudflareContext().env as Record<string, unknown>;
    const value = cloudflareEnv[name];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // Local Node.js development uses process.env instead.
  }
  return process.env[name];
}

function encryptionKey() {
  const value = getGoogleCalendarEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal key.");
  }
  return Buffer.from(value, "hex");
}

export function encryptGoogleToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptGoogleToken(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored Google token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createGoogleTokenAdminClient() {
  const url = getGoogleCalendarEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getGoogleCalendarEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Server-side Supabase credentials are missing.");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function googleRedirectUri(origin?: string) {
  const baseUrl = origin || getGoogleCalendarEnv("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";
  return getGoogleCalendarEnv("GOOGLE_REDIRECT_URI") || new URL("/api/google/calendar/callback", baseUrl).toString();
}
