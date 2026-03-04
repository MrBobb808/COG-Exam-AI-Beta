import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateAuthUrl } from "@/lib/google/oauth";

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

  const authUrl = generateAuthUrl(user.id);
  return NextResponse.redirect(authUrl);
}
