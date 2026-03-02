import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Tech Pillar Hub</h1>
      <p className="text-sm text-muted-foreground">
        Cohort learning, assignments, discussions, and AI prompt labs.
      </p>
      <div className="flex gap-3">
        <Link className="underline" href="/login">Login</Link>
        <Link className="underline" href="/signup">Sign up</Link>
        <Link className="underline" href="/app">Go to app</Link>
      </div>
    </main>
  );
}
