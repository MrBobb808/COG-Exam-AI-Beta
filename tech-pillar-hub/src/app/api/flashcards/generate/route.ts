import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAnthropic } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { moduleId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { moduleId } = body;

  if (!moduleId) {
    return NextResponse.json(
      { error: "Missing required field: moduleId" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify module exists and get details
  const { data: module } = await admin
    .from("modules")
    .select("id, cohort_id, title, description")
    .eq("id", moduleId)
    .single();

  if (!module) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  // Verify staff role
  const { data: membership } = await admin
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", module.cohort_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership || (membership.role !== "admin" && membership.role !== "instructor")) {
    return NextResponse.json(
      { error: "Only staff can generate flashcards" },
      { status: 403 }
    );
  }

  // Load module content for context
  const [{ data: resources }, { data: assignments }] = await Promise.all([
    admin
      .from("resources")
      .select("title, description")
      .eq("module_id", moduleId)
      .order("position"),
    admin
      .from("assignments")
      .select("title, description")
      .eq("module_id", moduleId)
      .order("position"),
  ]);

  // Build content context
  let contentContext = `Module: "${module.title}"`;
  if (module.description) {
    contentContext += `\nDescription: ${module.description}`;
  }

  if (resources && resources.length > 0) {
    contentContext += "\n\nResources:";
    for (const r of resources) {
      contentContext += `\n- ${r.title}`;
      if (r.description) contentContext += `: ${r.description}`;
    }
  }

  if (assignments && assignments.length > 0) {
    contentContext += "\n\nAssignments:";
    for (const a of assignments) {
      contentContext += `\n- ${a.title}`;
      if (a.description) contentContext += `: ${a.description}`;
    }
  }

  try {
    const anthropic = getAnthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are generating flashcards for a course module in a ministry/church training program. Based on the module content provided, create 10-15 flashcards in JSON array format. Respond with ONLY the JSON array, no markdown code blocks or additional text.

Format: [{"front": "question or concept", "back": "answer or explanation"}]

Focus on key concepts, definitions, theological terms, and important facts from the module content. Keep answers concise but complete. Make questions clear and unambiguous.`,
      messages: [
        {
          role: "user",
          content: `Generate flashcards for this module:\n\n${contentContext}`,
        },
      ],
    });

    // Extract text content
    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock ? textBlock.text : "";

    // Parse JSON array
    let cards: { front: string; back: string }[];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      cards = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI-generated flashcards" },
        { status: 500 }
      );
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json(
        { error: "No flashcards generated" },
        { status: 500 }
      );
    }

    // Bulk insert
    const rows = cards
      .filter((c) => c.front?.trim() && c.back?.trim())
      .map((c) => ({
        module_id: moduleId,
        front: c.front.trim(),
        back: c.back.trim(),
        source: "ai_generated" as const,
        created_by: user.id,
      }));

    const { data: flashcards, error: insertError } = await admin
      .from("flashcards")
      .insert(rows)
      .select("id, front, back, source, created_at");

    if (insertError) {
      console.error("Failed to insert generated flashcards:", insertError);
      return NextResponse.json(
        { error: "Failed to save flashcards" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { flashcards: flashcards ?? [], count: (flashcards ?? []).length },
      { status: 201 }
    );
  } catch (err) {
    console.error("Flashcard generation failed:", err);
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 500 }
    );
  }
}
