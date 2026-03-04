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

  let body: { cohortId: string; email: string; role?: "student" | "instructor" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { cohortId, email, role = "student" } = body;

  if (!cohortId || !email?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: cohortId, email" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify caller is staff for this cohort
  const { data: callerMembership } = await admin
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .in("role", ["admin", "instructor"])
    .eq("status", "active")
    .limit(1)
    .single();

  if (!callerMembership) {
    return NextResponse.json(
      { error: "Staff access required" },
      { status: 403 }
    );
  }

  // Look up user by email using admin API
  const {
    data: { users: matchedUsers },
    error: listError,
  } = await admin.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    console.error("Failed to list users:", listError);
    return NextResponse.json(
      { error: "Failed to look up user" },
      { status: 500 }
    );
  }

  const targetUser = matchedUsers.find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  if (!targetUser) {
    return NextResponse.json(
      {
        error:
          "User not found. They must create an account first, then you can add them.",
      },
      { status: 404 }
    );
  }

  // Check if already a member
  const { data: existingMember } = await admin
    .from("cohort_members")
    .select("id, status")
    .eq("cohort_id", cohortId)
    .eq("user_id", targetUser.id)
    .maybeSingle();

  if (existingMember) {
    if (existingMember.status === "active") {
      return NextResponse.json(
        { error: "User is already an active member of this course" },
        { status: 409 }
      );
    }

    // Reactivate inactive member
    const { data: reactivated, error: reactivateError } = await admin
      .from("cohort_members")
      .update({ status: "active", role })
      .eq("id", existingMember.id)
      .select("id, cohort_id, user_id, role, status")
      .single();

    if (reactivateError) {
      console.error("Failed to reactivate member:", reactivateError);
      return NextResponse.json(
        { error: "Failed to reactivate member" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      member: { ...reactivated, email: targetUser.email },
    });
  }

  // Create new membership
  const { data: member, error: memberError } = await admin
    .from("cohort_members")
    .insert({
      cohort_id: cohortId,
      user_id: targetUser.id,
      role,
      status: "active",
    })
    .select("id, cohort_id, user_id, role, status")
    .single();

  if (memberError) {
    console.error("Failed to add member:", memberError);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { member: { ...member, email: targetUser.email } },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { memberId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { memberId } = body;

  if (!memberId) {
    return NextResponse.json(
      { error: "Missing required field: memberId" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Fetch the member to get cohort info
  const { data: targetMember } = await admin
    .from("cohort_members")
    .select("id, cohort_id, user_id, role")
    .eq("id", memberId)
    .single();

  if (!targetMember) {
    return NextResponse.json(
      { error: "Member not found" },
      { status: 404 }
    );
  }

  // Verify caller is staff
  const { data: callerMembership } = await admin
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", targetMember.cohort_id)
    .eq("user_id", user.id)
    .in("role", ["admin", "instructor"])
    .eq("status", "active")
    .limit(1)
    .single();

  if (!callerMembership) {
    return NextResponse.json(
      { error: "Staff access required" },
      { status: 403 }
    );
  }

  // Don't allow removing admins
  if (targetMember.role === "admin") {
    return NextResponse.json(
      { error: "Cannot remove admin members" },
      { status: 400 }
    );
  }

  // Soft delete: set status to inactive
  const { error: updateError } = await admin
    .from("cohort_members")
    .update({ status: "inactive" })
    .eq("id", memberId);

  if (updateError) {
    console.error("Failed to remove member:", updateError);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
