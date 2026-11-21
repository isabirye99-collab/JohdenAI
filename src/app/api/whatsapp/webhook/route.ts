import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function verifyMetaSignature(
  rawBody: ArrayBuffer,
  signatureHeader: string,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, rawBody);
  const expected = `sha256=${toHex(digest)}`;
  return safeEqual(expected, signatureHeader);
}

async function getWebhookSecret(
  name: "WHATSAPP_VERIFY_TOKEN" | "META_APP_SECRET",
): Promise<string | undefined> {
  let contextRead = false;
  let contextBindingPresent = false;
  let contextErrorName: string | undefined;

  // Read the environment attached to this incoming Cloudflare Worker request.
  try {
    const context = await getCloudflareContext({ async: true });
    contextRead = true;
    const bindings = context.env as unknown as Record<string, unknown> | undefined;
    const value = bindings?.[name];

    if (typeof value === "string" && value.length > 0) {
      console.info("WhatsApp webhook configuration lookup", {
        name,
        source: "cloudflare-context",
        configured: true,
      });
      return value;
    }

    contextBindingPresent = value !== undefined && value !== null;
  } catch (error) {
    contextErrorName =
      error instanceof Error ? error.name : "UnknownContextError";
  }

  // Node.js compatibility can expose Worker bindings through process.env.
  const processValue = process.env[name];
  if (typeof processValue === "string" && processValue.length > 0) {
    console.info("WhatsApp webhook configuration lookup", {
      name,
      source: "process-env",
      configured: true,
      contextRead,
    });
    return processValue;
  }

  // Log availability metadata only. Never log secret values.
  console.error("WhatsApp webhook secret unavailable to the running Worker", {
    name,
    contextRead,
    contextBindingPresent,
    processEnvPresent: typeof processValue === "string" && processValue.length > 0,
    ...(contextErrorName ? { contextErrorName } : {}),
  });

  return undefined;
}

/** Meta webhook verification handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  let expectedToken: string | undefined;

  try {
    expectedToken = await getWebhookSecret("WHATSAPP_VERIFY_TOKEN");
  } catch (error) {
    console.error("Unable to read WhatsApp webhook verification configuration", error);
    return NextResponse.json(
      { error: "Webhook verification configuration is unavailable." },
      { status: 503 },
    );
  }

  // TEMPORARY DIAGNOSTIC FALLBACK: remove after confirming the Meta handshake.
  // This public test token is only for GET verification; POST signature checks still require META_APP_SECRET.
  if (!expectedToken) {
    expectedToken = "JohdenAI-Webhook-Test-2026-11-21";
    console.warn("Using temporary WhatsApp webhook diagnostic token because the Worker binding is unavailable.");
  }

  if (mode === "subscribe" && token && safeEqual(token, expectedToken) && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

/**
 * Accept signed Meta webhook events. This endpoint acknowledges valid events;
 * message processing, persistence, and sending are deliberately not enabled yet.
 */
export async function POST(request: NextRequest) {
  let appSecret: string | undefined;

  try {
    appSecret = await getWebhookSecret("META_APP_SECRET");
  } catch (error) {
    console.error("Unable to read WhatsApp webhook signature configuration", error);
    return NextResponse.json(
      { error: "Webhook signature configuration is unavailable." },
      { status: 503 },
    );
  }

  if (!appSecret) {
    return NextResponse.json(
      { error: "Webhook signature verification is not configured." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const rawBody = await request.arrayBuffer();

  let validSignature = false;
  try {
    validSignature = await verifyMetaSignature(rawBody, signature, appSecret);
  } catch {
    validSignature = false;
  }

  if (!validSignature) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(rawBody)) as {
      object?: string;
      entry?: Array<{ changes?: Array<{ field?: string }> }> ;
    };

    const fields = (payload.entry ?? []).flatMap((entry) =>
      (entry.changes ?? []).map((change) => change.field ?? "unknown"),
    );
    console.info("Verified WhatsApp webhook event", {
      object: payload.object ?? "unknown",
      fields: [...new Set(fields)],
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
