import { supabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/VideoPlayer";

type Props = {
  params: Promise<{ cohortId: string }>;
};

function extractYouTubeId(url: string): string | null {
  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/watch?v=ID
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (longMatch) return longMatch[1];
  // youtube.com/embed/ID
  const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

export default async function VideosPage({ params }: Props) {
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

  // Fetch cohort + modules
  const [{ data: cohort }, { data: modules }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("name")
      .eq("id", cohortId)
      .single(),
    supabase
      .from("modules")
      .select("id, title, position")
      .eq("cohort_id", cohortId)
      .order("position"),
  ]);

  if (!cohort) notFound();

  const moduleIds = (modules ?? []).map((m) => m.id);

  // Fetch video resources (metadata type = video)
  const { data: resources } =
    moduleIds.length > 0
      ? await supabase
          .from("resources")
          .select("id, module_id, title, description, url, metadata")
          .in("module_id", moduleIds)
          .order("position")
      : { data: [] as never[] };

  // Filter to videos — resources with metadata.type = 'video' OR YouTube URLs
  type VideoResource = {
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    url: string | null;
    metadata: Record<string, unknown>;
    videoId: string;
  };

  const videos: VideoResource[] = [];
  for (const r of (resources ?? []) as {
    id: string;
    module_id: string;
    title: string;
    description: string | null;
    url: string | null;
    metadata: Record<string, unknown>;
  }[]) {
    if (!r.url) continue;

    const isVideoMeta =
      r.metadata && (r.metadata as Record<string, unknown>).type === "video";
    const ytId = extractYouTubeId(r.url);

    if (isVideoMeta || ytId) {
      videos.push({ ...r, videoId: ytId ?? "" });
    }
  }

  // Group by module
  const moduleMap = new Map(
    (modules ?? []).map((m) => [m.id, m.title])
  );

  const videosByModule = new Map<string, VideoResource[]>();
  for (const v of videos) {
    const list = videosByModule.get(v.module_id) ?? [];
    list.push(v);
    videosByModule.set(v.module_id, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/app/courses/${cohortId}`} className="text-sm text-text-secondary hover:text-navy transition-colors inline-flex items-center gap-1 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to {cohort.name}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Video Library</h1>
        <p className="text-sm text-text-secondary mt-1">{cohort.name}</p>
      </div>

      {videos.length === 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm flex flex-col items-center py-16 text-center">
          <span className="text-5xl mb-4">🎬</span>
          <h3 className="text-base font-semibold text-text-primary mb-1">No videos yet</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Videos will appear here when a YouTube link is added to a module resource.
          </p>
        </div>
      )}

      {(modules ?? []).map((mod) => {
        const modVideos = videosByModule.get(mod.id);
        if (!modVideos || modVideos.length === 0) return null;

        return (
          <section key={mod.id} className="space-y-4">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <span className="w-1.5 h-4 bg-navy rounded-full inline-block" />
              {moduleMap.get(mod.id) ?? "Module"}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {modVideos.map((v) => (
                <div key={v.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {v.videoId ? (
                    <VideoPlayer videoId={v.videoId} title={v.title} />
                  ) : (
                    <a
                      href={v.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center aspect-video bg-background text-navy hover:bg-navy/5 transition-colors text-sm font-medium"
                    >
                      Open video →
                    </a>
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-text-primary">{v.title}</h3>
                    {v.description && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
