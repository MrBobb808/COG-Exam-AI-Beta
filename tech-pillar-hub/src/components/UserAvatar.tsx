type Props = {
  displayName: string | null;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-12 h-12 text-base",
};

export default function UserAvatar({
  displayName,
  avatarUrl,
  size = "md",
}: Props) {
  const initials = (displayName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const cls = sizeClasses[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={displayName ?? "User"}
        className={`${cls} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-full bg-blue-100 text-blue-700 font-medium flex items-center justify-center shrink-0`}
    >
      {initials}
    </div>
  );
}
