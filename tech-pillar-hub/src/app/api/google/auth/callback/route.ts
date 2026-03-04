import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  SCOPES,
} from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    const redirectUrl = new URL("/app", request.url);
    redirectUrl.searchParams.set("gc_error", error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user.id !== state) {
    return NextResponse.json({ error: "State mismatch" }, { status: 403 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      const redirectUrl = new URL("/app", request.url);
      redirectUrl.searchParams.set("gc_error", "no_refresh_token");
      return NextResponse.redirect(redirectUrl);
    }

    const googleUser = await getGoogleUserInfo(tokens.access_token!);

    const admin = supabaseAdmin();
    const { error: upsertError } = await admin
      .from("gc_connections")
      .upsert(
        {
          user_id: user.id,
          google_email: googleUser.email!,
          refresh_token_ref: tokens.refresh_token,
          scopes: SCOPES,
          is_valid: true,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Failed to store gc_connection:", upsertError);
      const redirectUrl = new URL("/app", request.url);
      redirectUrl.searchParams.set("gc_error", "db_error");
      return NextResponse.redirect(redirectUrl);
    }

    const redirectUrl = new URL("/app", request.url);
    redirectUrl.searchParams.set("gc_connected", "true");
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    const redirectUrl = new URL("/app", request.url);
    redirectUrl.searchParams.set("gc_error", "token_exchange_failed");
    return NextResponse.redirect(redirectUrl);
  }
}
