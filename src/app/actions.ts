"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const go = (path: string, key: string, value: string) => redirect(`${path}?${key}=${encodeURIComponent(value)}`);

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) go("/login", "error", "Enter your email and password.");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) go("/login", "error", error.message);
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) go("/signup", "error", "Use a valid email and a password of at least 8 characters.");
  const supabase = await createClient();
  const h = await headers();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || h.get("origin") || "http://localhost:3000";
  const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${siteUrl}/auth/callback` } });
  if (error) go("/signup", "error", error.message);
  go("/login", "message", "Account created. Check your email if confirmation is enabled.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
