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

  let body: { name: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, description } = body;

  if (!name || !name.trim()) {
    return NextResponse.json(
      { error: "Missing required field: name" },
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

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      created_by: user.id,
    })
    .select("id, name")
    .single();

  if (cohortError) {
    console.error("Failed to create cohort:", cohortError);
    return NextResponse.json({ error: "Failed to create cohort" }, { status: 500 });
  }

  const { error: memberError } = await admin.from("cohort_members").insert({
    cohort_id: cohort.id,
    user_id: user.id,
    role: "admin",
    status: "active",
  });

  if (memberError) {
    console.error("Failed to add admin member:", memberError);
    await admin.from("cohorts").delete().eq("id", cohort.id);
    return NextResponse.json({ error: "Failed to create cohort membership" }, { status: 500 });
  }

  return NextResponse.json({ cohort }, { status: 201 });
}
