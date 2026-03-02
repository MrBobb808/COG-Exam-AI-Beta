import { supabaseServer } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function AppDashboard() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <SignOutButton />
      </div>

      <p className="text-sm">
        Signed in as: <span className="font-mono">{data.user?.email}</span>
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border rounded p-4">
          <h2 className="font-semibold">Modules</h2>
          <p className="text-sm text-muted-foreground">Coming next.</p>
        </div>
        <div className="border rounded p-4">
          <h2 className="font-semibold">Cohort Feed</h2>
          <p className="text-sm text-muted-foreground">Coming next.</p>
        </div>
      </div>
    </main>
  );
}
