"use client";

import Link from "next/link";
import ReactionBar from "./ReactionBar";

type Reaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

type Post = {
  id: string;
  cohort_id: string;
  user_id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  created_at: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  commentCount: number;
  reactions: Reaction[];
};

type Props = {
  post: Post;
  onReactionToggle: (postId: string, emoji: string) => Promise<void>;
};

function PostAvatar({
  profile,
}: {
  profile: { display_name: string | null; avatar_url: string | null } | null;
}) {
  const name = profile?.display_name ?? "?";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold ring-2 ring-white shadow-sm shrink-0">
      {initials}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function CommunityPostCard({ post, onReactionToggle }: Props) {
  const bodyPreview =
    post.body.length > 240 ? post.body.slice(0, 240) + "…" : post.body;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md hover:border-navy/20 transition-all duration-150">
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <PostAvatar profile={post.profile} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text-primary">
                {post.profile?.display_name ?? "Anonymous"}
              </span>
              <span className="text-xs text-text-secondary">{timeAgo(post.created_at)}</span>
              {post.pinned && (
                <span className="inline-flex items-center gap-1 text-xs bg-crimson/10 text-crimson border border-crimson/20 px-1.5 py-0.5 rounded-full font-medium">
                  📌 Pinned
                </span>
              )}
            </div>
          </div>
        </div>

        <Link href={`/app/courses/${post.cohort_id}/community/${post.id}`} className="block group">
          {post.title && (
            <h3 className="font-semibold text-text-primary text-sm mb-1 group-hover:text-navy transition-colors">
              {post.title}
            </h3>
          )}
          <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">{bodyPreview}</p>
        </Link>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <ReactionBar reactions={post.reactions} onToggle={(emoji) => onReactionToggle(post.id, emoji)} />
          <Link
            href={`/app/courses/${post.cohort_id}/community/${post.id}`}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-navy transition-colors font-medium"
          >
            💬 {post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}
          </Link>
        </div>
      </div>
    </div>
  );
}
