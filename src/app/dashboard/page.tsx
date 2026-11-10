import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");

  const userId = String(data.claims.sub);
  const userEmail = typeof data.claims.email === "string" ? data.claims.email : "Signed-in account";
  return <DashboardClient userId={userId} userEmail={userEmail} />;
}
