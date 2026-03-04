import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    cohortId: string;
    googleCourseId: string;
    courseName: string;
    gcConnectionId: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { cohortId, googleCourseId, courseName, gcConnectionId } = body;

  if (!cohortId || !googleCourseId || !courseName || !gcConnectionId) {
    return NextResponse.json(
      { error: "Missing required fields: cohortId, googleCourseId, courseName, gcConnectionId" },
      { status: 400 }
    );
  }

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

  const { data: connection } = await admin
    .from("gc_connections")
    .select("id")
    .eq("id", gcConnectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "Invalid connection" }, { status: 400 });
  }

  const { data: cohort } = await admin
    .from("cohorts")
    .select("id")
    .eq("id", cohortId)
    .single();

  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
  }

  const { data: mapping, error: mappingError } = await admin
    .from("gc_course_mappings")
    .insert({
      cohort_id: cohortId,
      google_course_id: googleCourseId,
      gc_connection_id: gcConnectionId,
      course_name: courseName,
    })
    .select("id")
    .single();

  if (mappingError) {
    if (mappingError.code === "23505") {
      return NextResponse.json(
        { error: "This cohort or Google course is already mapped" },
        { status: 409 }
      );
    }
    console.error("Failed to create course mapping:", mappingError);
    return NextResponse.json({ error: "Failed to create mapping" }, { status: 500 });
  }

  const { error: syncError } = await admin.from("gc_sync_state").insert({
    gc_course_mapping_id: mapping.id,
    sync_status: "idle",
    page_tokens: {},
  });

  if (syncError) {
    console.error("Failed to create sync state:", syncError);
    await admin.from("gc_course_mappings").delete().eq("id", mapping.id);
    return NextResponse.json({ error: "Failed to initialize sync state" }, { status: 500 });
  }

  return NextResponse.json(
    {
      mapping: {
        id: mapping.id,
        cohortId,
        googleCourseId,
        courseName,
      },
    },
    { status: 201 }
  );
}
