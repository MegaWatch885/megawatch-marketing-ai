
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedInstagramConnection } from "@/lib/instagram/get-authenticated-connection";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please log in first." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const contentId =
      typeof body?.contentId === "string" ? body.contentId : "";

    if (!contentId) {
      return NextResponse.json(
        { success: false, error: "contentId is required." },
        { status: 400 }
      );
    }

    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id, instagram_media_id, permalink")
      .eq("id", contentId)
      .eq("user_id", user.id)
      .single();

    if (contentError || !content) {
      return NextResponse.json(
        { success: false, error: "Content not found." },
        { status: 404 }
      );
    }

    if (!content.instagram_media_id) {
      return NextResponse.json(
        {
          success: false,
          error: "No Instagram media ID is saved for this content.",
        },
        { status: 400 }
      );
    }

    if (content.permalink) {
      return NextResponse.json({
        success: true,
        permalink: content.permalink,
      });
    }

    const {
      connection,
      error: connectionError,
      status: connectionStatus,
    } = await getAuthenticatedInstagramConnection();

    if (!connection) {
      return NextResponse.json(
        {
          success: false,
          error: connectionError || "Instagram account is not connected.",
        },
        { status: connectionStatus }
      );
    }

    const url = new URL(
      `https://graph.instagram.com/v25.0/${encodeURIComponent(
        content.instagram_media_id
      )}`
    );

    url.searchParams.set("fields", "id,permalink");

    const mediaResponse = await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
      cache: "no-store",
    });

    const mediaData = await mediaResponse.json();

    if (!mediaResponse.ok || !mediaData.permalink) {
      return NextResponse.json(
        {
          success: false,
          error:
            mediaData.error?.message ||
            "Instagram did not return a permalink for this Reel.",
        },
        { status: 502 }
      );
    }

    const { error: updateError } = await supabase
      .from("content")
      .update({ permalink: mediaData.permalink })
      .eq("id", content.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Permalink save failed:", updateError.message);

      return NextResponse.json(
        {
          success: false,
          error: "Retrieved the link, but could not save it to the database.",
          permalink: mediaData.permalink,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      permalink: mediaData.permalink,
    });
  } catch (error) {
    console.error(
      "Permalink retrieval failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { success: false, error: "Unexpected permalink retrieval error." },
      { status: 500 }
    );
  }
}

