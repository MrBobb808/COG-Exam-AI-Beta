import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { syncCourse } from "@/lib/google/sync";

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Admin check ─────────────────────────────────────────────────────────────
  const admin = supabaseAdmin();
  const { data: membership } = await admin
    .from("cohort_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { mappingId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mappingId } = body;
  if (!mappingId) {
    return NextResponse.json({ error: "Missing required field: mappingId" }, { status: 400 });
  }

  // ── Fetch mapping (must belong to user's connection) ────────────────────────
  const { data: mapping } = await admin
    .from("gc_course_mappings")
    .select("id, cohort_id, google_course_id, gc_connection_id, is_active")
    .eq("id", mappingId)
    .single();

  if (!mapping) {
    return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
  }
  if (!mapping.is_active) {
    return NextResponse.json({ error: "Mapping is not active" }, { status: 400 });
  }

  // ── Fetch connection (must belong to this user) ─────────────────────────────
  const { data: connection } = await admin
    .from("gc_connections")
    .select("id, refresh_token_ref, is_valid")
    .eq("id", mapping.gc_connection_id)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "Google connection not found" }, { status: 404 });
  }
  if (!connection.is_valid) {
    return NextResponse.json(
      { error: "Google connection is invalid. Please reconnect." },
      { status: 403 }
    );
  }

  // ── Fetch sync state ────────────────────────────────────────────────────────
  const { data: syncState } = await admin
    .from("gc_sync_state")
    .select("id, sync_status")
    .eq("gc_course_mapping_id", mappingId)
    .single();

  if (!syncState) {
    return NextResponse.json({ error: "Sync state not found" }, { status: 404 });
  }

  if (syncState.sync_status === "syncing") {
    return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
  }

  // ── Set status → syncing ────────────────────────────────────────────────────
  await admin
    .from("gc_sync_state")
    .update({ sync_status: "syncing", last_error: null })
    .eq("id", syncState.id);

  // ── Run sync ────────────────────────────────────────────────────────────────
  try {
    const result = await syncCourse({
      googleCourseId: mapping.google_course_id,
      cohortId: mapping.cohort_id,
      refreshToken: connection.refresh_token_ref,
      connectionId: connection.id,
      userId: user.id,
    });

    // Mark completed — if some steps had non-fatal errors, surface them in last_error
    const partialError =
      result.stepErrors.length > 0
        ? result.stepErrors.map((e) => `${e.step}: ${e.error}`).join("; ")
        : null;

    await admin.from("gc_sync_state").update({
      sync_status: "completed",
      last_synced_at: new Date().toISOString(),
      items_synced: result.itemsSynced,
      last_error: partialError,
    }).eq("id", syncState.id);

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    console.error("Sync error:", err);

    // If Google rejected the token, mark connection invalid
    const code =
      (err as { code?: number })?.code ??
      (err as { response?: { status?: number } })?.response?.status;
    if (code === 401) {
      await admin
        .from("gc_connections")
        .update({ is_valid: false })
        .eq("id", connection.id);
    }

    await admin.from("gc_sync_state").update({
      sync_status: "error",
      last_error: message,
    }).eq("id", syncState.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
