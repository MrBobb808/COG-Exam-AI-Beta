import { NextResponse } from "next/server";
import { google } from "googleapis";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAuthenticatedClient } from "@/lib/google/oauth";

export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    .select("id, refresh_token_ref, is_valid")
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return NextResponse.json(
      { error: "No Google connection found. Connect first." },
      { status: 404 }
    );
  }

  if (!connection.is_valid) {
    return NextResponse.json(
      { error: "Google connection is invalid. Please reconnect." },
      { status: 403 }
    );
  }

  try {
    const authClient = createAuthenticatedClient(connection.refresh_token_ref);
    const classroom = google.classroom({ version: "v1", auth: authClient });

    const res = await classroom.courses.list({
      courseStates: ["ACTIVE"],
      pageSize: 100,
    });

    const courses = (res.data.courses || []).map((course) => ({
      id: course.id,
      name: course.name,
      section: course.section,
      descriptionHeading: course.descriptionHeading,
      courseState: course.courseState,
      alternateLink: course.alternateLink,
    }));

    return NextResponse.json({ courses, connectionId: connection.id });
  } catch (err: unknown) {
    const status =
      (err as { code?: number })?.code ??
      (err as { response?: { status?: number } })?.response?.status;

    if (status === 401) {
      await admin
        .from("gc_connections")
        .update({ is_valid: false })
        .eq("id", connection.id);

      return NextResponse.json(
        { error: "Google token expired. Please reconnect." },
        { status: 401 }
      );
    }

    console.error("Google Classroom API error:", err);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
