
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RepurposeRow = {
  id: string;
  content_id: string;
  platform: "instagram_reels" | "youtube_shorts";
  title: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string | null;
  cta: string | null;
  reason: string | null;
  created_at: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ contentId: string }>;
  }
) {
  try {
    const { contentId } = await context.params;

    if (!UUID_REGEX.test(contentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid content ID." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Require an authenticated user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    // Verify that this content belongs to the current user.
    const { data: content, error: contentError } = await supabase.from("content").select("id").eq("id", contentId).eq("user_id", user.id).maybeSingle();

    if (contentError) {
      console.error("Content ownership check failed:", contentError.message);

      return NextResponse.json(
        { success: false, error: "Could not verify content access." },
        { status: 500 }
      );
    }

    // RLS also limits this lookup to the user's own content.
    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("content_repurposes")
      .select(
        [
          "id",
          "content_id",
          "platform",
          "title",
          "hook",
          "caption",
          "hashtags",
          "cta",
          "reason",
          "created_at",
        ].join(", ")
      )
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("Repurposes fetch failed:", error.message);

      return NextResponse.json(
        { success: false, error: "Could not load saved content." },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown as RepurposeRow[];
    const latestByPlatform = new Map<string, RepurposeRow>();

    for (const row of rows) {
      if (!latestByPlatform.has(row.platform)) {
        latestByPlatform.set(row.platform, row);
      }
    }

    return NextResponse.json({
      success: true,
      content: Array.from(latestByPlatform.values()),
    });
  } catch (error) {
    console.error("Repurposes API error:", error);

    return NextResponse.json(
      { success: false, error: "Could not load saved content." },
      { status: 500 }
    );
  }
}

