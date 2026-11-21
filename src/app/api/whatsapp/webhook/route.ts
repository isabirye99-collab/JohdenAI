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

/**
 * Meta webhook verification handshake.
 * Configure WHATSAPP_VERIFY_TOKEN as a server-side Cloudflare secret and use
 * the same value in Meta's Verify token field.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    return NextResponse.json(
      { error: "Webhook verification is not configured." },
      { status: 503 },
    );
  }

  if (mode === "subscribe" && token && safeEqual(token, expectedToken) && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
}

/**
 * Accept signed Meta webhook events. This endpoint acknowledges valid events;
 * message processing, persistence, and sending are deliberately not enabled yet.
 */
export async function POST(request: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
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
      entry?: Array<{ changes?: Array<{ field?: string }> }>;
    };

    // Log only event categories, never message contents or phone numbers.
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
