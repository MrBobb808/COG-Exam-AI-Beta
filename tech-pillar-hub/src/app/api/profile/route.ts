import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    displayName?: string;
    bio?: string;
    ministry?: string;
    cohortYear?: string;
    avatarUrl?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // Ensure profile exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const updateData: Record<string, unknown> = {};
  if (body.displayName !== undefined) updateData.display_name = body.displayName;
  if (body.bio !== undefined) updateData.bio = body.bio;
  if (body.ministry !== undefined) updateData.ministry = body.ministry;
  if (body.cohortYear !== undefined) updateData.cohort_year = body.cohortYear;
  if (body.avatarUrl !== undefined) updateData.avatar_url = body.avatarUrl;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (existing) {
    const { data: profile, error } = await admin
      .from("profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update profile:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  }

  // Create new profile
  const { data: profile, error } = await admin
    .from("profiles")
    .insert({
      user_id: user.id,
      display_name: body.displayName ?? user.email?.split("@")[0] ?? "User",
      ...updateData,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create profile:", error);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile }, { status: 201 });
}
