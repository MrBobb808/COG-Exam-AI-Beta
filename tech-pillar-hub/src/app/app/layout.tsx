import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is admin in any cohort
  const { data: adminCheck } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .limit(1);

  const isAdmin = (adminCheck?.length ?? 0) > 0;

  // Fetch profile for sidebar & header
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell
      isAdmin={isAdmin}
      displayName={profile?.display_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      userEmail={user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
