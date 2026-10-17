
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { connected: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("instagram_connections")
    .select("instagram_user_id, username, token_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Instagram status lookup failed:", error.message);

    return NextResponse.json(
      { connected: false, error: "Could not check Instagram status." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    connected: Boolean(data),
    username: data?.username ?? null,
    instagramUserId: data?.instagram_user_id ?? null,
    tokenExpiresAt: data?.token_expires_at ?? null,
  });
}
