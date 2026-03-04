import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

type Props = {
  params: Promise<{ cohortId: string; moduleId: string }>;
};

export default async function ModuleDetailPage({ params }: Props) {
  const { cohortId, moduleId } = await params;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS enforces membership
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

  // Fetch module (verify it belongs to this cohort)
  const { data: mod } = await supabase
    .from("modules")
    .select("id, title, description, cohort_id")
    .eq("id", moduleId)
    .eq("cohort_id", cohortId)
    .single();

  if (!mod) {
    notFound();
  }

  // Fetch cohort name for breadcrumb
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("name")
    .eq("id", cohortId)
    .single();

  // Fetch resources + assignments in parallel
  const [{ data: resources }, { data: assignments }] = await Promise.all([
    supabase
      .from("resources")
      .select("id, title, description, url, position")
      .eq("module_id", moduleId)
      .order("position"),
    supabase
      .from("assignments")
      .select("id, title, description, due_at, max_points, position")
      .eq("module_id", moduleId)
      .order("position"),
  ]);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Link href="/app/courses" className="hover:text-blue-600">
            Courses
          </Link>
          <span>/</span>
          <Link
            href={`/app/courses/${cohortId}`}
            className="hover:text-blue-600"
          >
            {cohort?.name ?? "Course"}
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">{mod.title}</span>
        </div>
        <h1 className="text-xl font-semibold mt-2">{mod.title}</h1>
        {mod.description && (
          <p className="text-sm text-gray-500 mt-1">{mod.description}</p>
        )}
      </div>

      {/* Resources */}
      {resources && resources.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-600">Resources</h2>
          <div className="space-y-2">
            {resources.map((r) => (
              <div key={r.id} className="border rounded-lg p-4">
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {r.title}
                  </a>
                ) : (
                  <p className="font-medium">{r.title}</p>
                )}
                {r.description && (
                  <p className="text-sm text-gray-500 mt-1">{r.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assignments */}
      {assignments && assignments.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-600">Assignments</h2>
          <div className="space-y-2">
            {assignments.map((a) => (
              <Link
                key={a.id}
                href={`/app/courses/${cohortId}/assignments/${a.id}`}
                className="border rounded-lg p-4 flex items-start justify-between gap-4 hover:border-blue-300 transition-colors block"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  {a.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {a.description}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500 shrink-0">
                  {a.max_points != null && <p>{a.max_points} pts</p>}
                  {a.due_at && (
                    <p>
                      Due{" "}
                      {new Date(a.due_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(!resources || resources.length === 0) &&
        (!assignments || assignments.length === 0) && (
          <p className="text-sm text-gray-500">No content in this module yet.</p>
        )}
    </div>
  );
}
