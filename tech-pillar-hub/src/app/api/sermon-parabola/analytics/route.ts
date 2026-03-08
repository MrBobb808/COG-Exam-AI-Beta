import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// POST /api/sermon-parabola/analytics — record step_clicked or prompt_copied
export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { event, stepNumber, promptIndex } = body as {
      event: "step_clicked" | "prompt_copied";
      stepNumber: number;
      promptIndex?: number;
    };

    if (!event || !stepNumber) {
      return NextResponse.json(
        { error: "Missing event or stepNumber" },
        { status: 400 }
      );
    }

    if (event === "step_clicked") {
      await supabase.from("sermon_parabola_clicks").insert({
        user_id: user.id,
        step_number: stepNumber,
      });
    } else if (event === "prompt_copied" && promptIndex != null) {
      await supabase.from("sermon_parabola_prompt_copies").insert({
        user_id: user.id,
        step_number: stepNumber,
        prompt_index: promptIndex,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid event type" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to record analytics" },
      { status: 500 }
    );
  }
}
