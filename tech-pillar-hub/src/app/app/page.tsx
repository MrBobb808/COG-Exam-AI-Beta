import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import GoogleConnectionCard from "@/components/GoogleConnectionCard";
import GoogleCoursesSection from "@/components/GoogleCoursesSection";

export default async function AppDashboard() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Non-admin users go straight to the courses view
  const { data: adminCheck } = await supabase
    .from("cohort_members")
    .select("id")
    .eq("user_id", user!.id)
    .eq("role", "admin")
    .eq("status", "active")
    .limit(1);

  if (!adminCheck || adminCheck.length === 0) {
    redirect("/app/courses");
  }

  const admin = supabaseAdmin();

  const [
    { data: connection },
    { data: cohorts },
    { data: mappings },
    { data: syncStates },
  ] = await Promise.all([
    admin
      .from("gc_connections")
      .select("id, google_email, is_valid")
      .eq("user_id", user!.id)
      .single(),
    admin
      .from("cohorts")
      .select("id, name, description")
      .eq("archived", false)
      .order("name"),
    admin
      .from("gc_course_mappings")
      .select("id, cohort_id, google_course_id, course_name, is_active")
      .eq("is_active", true),
    admin
      .from("gc_sync_state")
      .select(
        "id, gc_course_mapping_id, sync_status, last_synced_at, last_error, items_synced"
      ),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Admin Panel</h1>
        <p className="text-sm text-text-secondary mt-1">Manage Google Classroom sync and course settings</p>
      </div>
      <GoogleConnectionCard connection={connection} />
      <GoogleCoursesSection
        connectionId={connection?.id ?? null}
        isConnectionValid={connection?.is_valid ?? false}
        cohorts={cohorts ?? []}
        existingMappings={mappings ?? []}
        syncStates={syncStates ?? []}
      />
    </div>
  );
}
