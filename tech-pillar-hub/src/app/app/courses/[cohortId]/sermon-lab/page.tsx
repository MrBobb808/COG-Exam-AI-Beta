import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import SermonLabClient from "./SermonLabClient";

type Props = {
  params: Promise<{ cohortId: string }>;
};

export default async function SermonLabPage({ params }: Props) {
  const { cohortId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify membership
  const { data: membership } = await supabase
    .from("cohort_members")
    .select("id")
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

  // Fetch sermon history
  const { data: submissions } = await supabase
    .from("sermon_submissions")
    .select("id, title, status, feedback, created_at")
    .eq("user_id", user!.id)
    .eq("cohort_id", cohortId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/courses/${cohortId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to {cohort.name}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-2xl">📝</span>
          <div>
            <h1 className="text-xl font-semibold">Sermon Lab</h1>
            <p className="text-sm text-gray-500">
              Get AI-powered feedback on your sermon
            </p>
          </div>
        </div>
      </div>

      <SermonLabClient
        cohortId={cohortId}
        initialSubmissions={(submissions ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          feedback: s.feedback as {
            structure: string;
            theology: string;
            delivery: string;
            engagement: string;
            engagement_rating: number;
            summary: string;
          } | null,
          created_at: s.created_at,
        }))}
      />
    </div>
  );
}
