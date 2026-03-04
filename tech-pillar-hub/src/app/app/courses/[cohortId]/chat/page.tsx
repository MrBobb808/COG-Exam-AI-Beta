import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ChatPanel from "@/components/ChatPanel";

type Props = {
  params: Promise<{ cohortId: string }>;
};

export default async function ChatPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id, role")
    .eq("cohort_id", cohortId)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  // Fetch cohort name
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("name")
    .eq("id", cohortId)
    .single();

  if (!cohort) {
    notFound();
  }

  // Fetch chat history
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, context, created_at")
    .eq("user_id", user!.id)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: true })
    .limit(50);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/app/courses/${cohortId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to {cohort.name}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-semibold">Tech Mentor</h1>
            <p className="text-sm text-gray-500">
              AI learning assistant for {cohort.name}
            </p>
          </div>
        </div>
      </div>

      <ChatPanel
        cohortId={cohortId}
        cohortName={cohort.name}
        initialMessages={
          (messages ?? []).map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            created_at: m.created_at,
          }))
        }
      />
    </div>
  );
}
