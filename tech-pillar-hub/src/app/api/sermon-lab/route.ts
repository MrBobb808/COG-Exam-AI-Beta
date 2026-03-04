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

  let body: { cohortId: string; title: string; sermonText: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { cohortId, title, sermonText } = body;

  if (!cohortId || !title?.trim() || !sermonText?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: cohortId, title, sermonText" },
      { status: 400 }
    );
  }

  const admin = supabaseAdmin();

  // Verify membership
  const { data: membership } = await admin
    .from("cohort_members")
    .select("id")
    .eq("cohort_id", cohortId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this course" },
      { status: 403 }
    );
  }

  // Create submission with analyzing status
  const { data: submission, error: insertError } = await admin
    .from("sermon_submissions")
    .insert({
      user_id: user.id,
      cohort_id: cohortId,
      title: title.trim(),
      sermon_text: sermonText.trim(),
      status: "analyzing",
    })
    .select("id, title, status, created_at")
    .single();

  if (insertError) {
    console.error("Failed to create sermon submission:", insertError);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }

  // Call Claude for analysis
  try {
    const anthropic = getAnthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `You are an expert homiletics instructor analyzing a sermon. Provide structured feedback in the following JSON format (respond with ONLY the JSON, no markdown code blocks or additional text):
{
  "structure": "detailed analysis of sermon structure including introduction, body, conclusion, and transitions",
  "theology": "analysis of theological accuracy, biblical interpretation, and doctrinal soundness",
  "delivery": "suggestions for vocal delivery, pacing, emphasis, and presentation",
  "engagement": "suggestions for audience engagement techniques and practical application",
  "engagement_rating": 7,
  "summary": "a brief 2-3 sentence overall assessment"
}

The engagement_rating must be a number from 1 to 10 rating overall engagement potential.
Be constructive, specific, and encouraging. Reference specific parts of the sermon in your feedback.`,
      messages: [
        {
          role: "user",
          content: `Please analyze this sermon titled "${title.trim()}":\n\n${sermonText.trim()}`,
        },
      ],
    });

    // Extract text content
    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock ? textBlock.text : "";

    // Parse JSON feedback
    let feedback;
    try {
      // Try to extract JSON if wrapped in code blocks
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      feedback = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      // If parsing fails, create structured feedback from raw text
      feedback = {
        structure: "Analysis could not be fully structured.",
        theology: "",
        delivery: "",
        engagement: "",
        engagement_rating: 5,
        summary: responseText.slice(0, 500),
      };
    }

    // Update submission with feedback
    await admin
      .from("sermon_submissions")
      .update({
        feedback,
        status: "completed",
      })
      .eq("id", submission.id);

    return NextResponse.json(
      {
        submission: {
          ...submission,
          feedback,
          status: "completed",
          sermon_text: sermonText.trim(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Sermon analysis failed:", err);

    // Mark as error
    await admin
      .from("sermon_submissions")
      .update({ status: "error" })
      .eq("id", submission.id);

    return NextResponse.json(
      { error: "AI analysis failed. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cohortId = request.nextUrl.searchParams.get("cohortId");

  if (!cohortId) {
    return NextResponse.json(
      { error: "Missing cohortId parameter" },
      { status: 400 }
    );
  }

  // RLS enforces access
  const { data: submissions, error } = await supabase
    .from("sermon_submissions")
    .select("id, title, status, feedback, created_at")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch sermon submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ submissions: submissions ?? [] });
}
