import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/sermon-parabola — fetch all 12 steps
export async function GET() {
  try {
    const admin = supabaseAdmin();
    const { data: steps, error } = await admin
      .from("sermon_parabola_steps")
      .select("*")
      .order("step_number");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ steps: steps ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch parabola steps" },
      { status: 500 }
    );
  }
}
