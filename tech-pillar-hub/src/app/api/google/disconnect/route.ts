import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revokeToken } from "@/lib/google/oauth";

export async function POST() {
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
    .select("id, refresh_token_ref")
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "No Google connection found" }, { status: 404 });
  }

  try {
    await revokeToken(connection.refresh_token_ref);
  } catch (err) {
    console.warn("Token revocation failed (continuing with disconnect):", err);
  }

  const { error: deleteError } = await admin
    .from("gc_connections")
    .delete()
    .eq("id", connection.id);

  if (deleteError) {
    console.error("Failed to delete gc_connection:", deleteError);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
