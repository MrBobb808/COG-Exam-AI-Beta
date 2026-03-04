import { NextRequest } from "next/server";
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    cohortId: string;
    message: string;
    context?: {
      moduleId?: string;
      assignmentId?: string;
      moduleTitle?: string;
      assignmentTitle?: string;
    };
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { cohortId, message, context } = body;

  if (!cohortId || !message?.trim()) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: cohortId, message" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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
    return new Response(
      JSON.stringify({ error: "You are not a member of this course" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Load cohort info
  const { data: cohort } = await admin
    .from("cohorts")
    .select("name")
    .eq("id", cohortId)
    .single();

  // Load last 20 messages for conversation context
  const { data: history } = await admin
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false })
    .limit(20);

  const conversationHistory = (history ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Build contextual system prompt
  let systemPrompt = `You are Tech Mentor, an AI learning assistant for the Tech Pillar Hub LMS. You are helping a student in the course "${cohort?.name ?? "this course"}".`;

  if (context?.moduleTitle) {
    systemPrompt += ` They are currently studying the module "${context.moduleTitle}".`;
  }
  if (context?.assignmentTitle) {
    systemPrompt += ` They are working on the assignment "${context.assignmentTitle}".`;
  }

  systemPrompt += ` Help them understand course concepts, guide them on assignments, and explain theological and technical topics. Be encouraging, supportive, and practical. Do NOT write their assignments for them — guide them to discover answers on their own. Keep responses concise but thorough.`;

  // Save user message to DB
  await admin.from("chat_messages").insert({
    user_id: user.id,
    cohort_id: cohortId,
    role: "user",
    content: message.trim(),
    context: context ?? {},
  });

  // Add the new user message to conversation history
  conversationHistory.push({ role: "user", content: message.trim() });

  // Stream Claude response
  const anthropic = getAnthropic();

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationHistory,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        stream.on("text", (text) => {
          fullResponse += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        });

        stream.on("end", async () => {
          // Save assistant message to DB
          await admin.from("chat_messages").insert({
            user_id: user.id,
            cohort_id: cohortId,
            role: "assistant",
            content: fullResponse,
            context: context ?? {},
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        });

        stream.on("error", (err) => {
          console.error("Chat stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream failed" })}\n\n`
            )
          );
          controller.close();
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Failed to start chat stream:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
