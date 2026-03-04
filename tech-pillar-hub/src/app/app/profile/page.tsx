import { supabaseServer } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch or create profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("display_name, bio, ministry, cohort_year, avatar_url")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({
      user_id: user!.id,
      display_name: user!.email?.split("@")[0] ?? "User",
    });

    profile = {
      display_name: user!.email?.split("@")[0] ?? "User",
      bio: null,
      ministry: null,
      cohort_year: null,
      avatar_url: null,
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">My Profile</h1>
      <ProfileForm profile={profile} userId={user!.id} />
    </div>
  );
}
