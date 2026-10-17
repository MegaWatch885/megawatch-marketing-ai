
import { NextResponse } from "next/server";
import { getAIProvider } from "@/services/ai";
import { createClient } from "@/lib/supabase/server";
import type { RepurposePlatform } from "@/services/ai/provider";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_PLATFORMS = [
  "instagram_reels",
  "youtube_shorts",
] as const;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

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

    const body = await request.json();
    const { contentId, platform } = body;

    if (
      typeof contentId !== "string" ||
      !UUID_REGEX.test(contentId) ||
      typeof platform !== "string" ||
      !ALLOWED_PLATFORMS.includes(
        platform as (typeof ALLOWED_PLATFORMS)[number]
      )
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid content ID or platform." },
        { status: 400 }
      );
    }

    // RLS restricts this query to the authenticated user's content.
    const { data: item, error: fetchError } = await supabase
      .from("content")
      .select("id, title, description")
      .eq("id", contentId)
      .maybeSingle();

    if (fetchError) {
      console.error("Original content fetch failed:", fetchError.message);

      return NextResponse.json(
        { success: false, error: "Could not verify original content." },
        { status: 500 }
      );
    }

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Original content not found." },
        { status: 404 }
      );
    }

    // Generate platform-specific content using the configured AI provider.
    const provider = getAIProvider();

    const generated = await provider.repurposeContent({
      contentId: item.id,
      title: item.title || "Untitled content",
      description: item.description,
      platform: platform as RepurposePlatform,
    });

    // Save using the authenticated client so RLS applies.
    const { data: saved, error: saveError } = await supabase
      .from("content_repurposes")
      .insert({
        content_id: item.id,
        platform: generated.platform,
        title: generated.title,
        hook: generated.hook,
        caption: generated.caption,
        hashtags: generated.hashtags,
        cta: generated.cta,
        reason: generated.reason,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Repurpose save failed:", saveError.message);

      return NextResponse.json(
        { success: false, error: "Could not save repurposed content." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content: saved,
    });
  } catch (error) {
    console.error("Repurposing API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Repurposing failed.",
      },
      { status: 500 }
    );
  }
}

