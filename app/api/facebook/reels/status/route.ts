
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const GRAPH_VERSION = "v26.0";
const PAGE_ID = "1347260108473147";

type FacebookStatusResponse = {
  id?: string;
  status?: {
    video_status?: string;
    processing_progress?: number;
    uploading_phase?: { status?: string };
    processing_phase?: { status?: string };
    publishing_phase?: { status?: string };
  };
  error?: {
    message?: string;
  };
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const contentId = body?.contentId;

    if (
      typeof contentId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        contentId
      )
    ) {
      return NextResponse.json(
        { error: "A valid contentId is required." },
        { status: 400 }
      );
    }

    const { data: publication, error: publicationError } =
      await supabaseAdmin
        .from("platform_publications")
        .select(
          "id, platform_video_id, status, platform_account_id"
        )
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .eq("platform", "facebook")
        .maybeSingle();

    if (publicationError) {
      return NextResponse.json(
        { error: "Could not read publication history." },
        { status: 500 }
      );
    }

    if (!publication?.platform_video_id) {
      return NextResponse.json(
        { error: "No Facebook video ID is saved for this content." },
        { status: 404 }
      );
    }

    const { data: connection, error: connectionError } =
      await supabaseAdmin
        .from("facebook_connections")
        .select("page_id, page_name, access_token")
        .eq("user_id", user.id)
        .eq("page_id", PAGE_ID)
        .single();

    if (
      connectionError ||
      !connection?.access_token ||
      publication.platform_account_id !== PAGE_ID
    ) {
      return NextResponse.json(
        { error: "Facebook Page connection was not found." },
        { status: 400 }
      );
    }

    const statusUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(
        publication.platform_video_id
      )}`
    );

    statusUrl.searchParams.set("fields", "status");

    const facebookResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
      cache: "no-store",
    });

    const facebookData =
      (await facebookResponse.json().catch(() => ({}))) as FacebookStatusResponse;

    if (!facebookResponse.ok || !facebookData.status) {
      console.error(
        "Facebook status check failed:",
        facebookData.error?.message ?? "Missing status data"
      );

      return NextResponse.json(
        {
          error:
            "Facebook status could not be verified. The saved publication status was not changed.",
        },
        { status: 502 }
      );
    }


    const videoStatus = (
      facebookData.status.video_status ?? "unknown"
    ).toLowerCase();

    const processingPhase = (
      facebookData.status.processing_phase?.status ?? "unknown"
    ).toLowerCase();

    const publishingPhase = (
      facebookData.status.publishing_phase?.status ?? "unknown"
    ).toLowerCase();

    let nextStatus: "processing" | "published" | "failed" =
      "processing";

    if (
      ["error", "failed"].includes(videoStatus) ||
      ["error", "failed"].includes(processingPhase) ||
      ["error", "failed"].includes(publishingPhase)
    ) {
      nextStatus = "failed";
    } else if (
      ["complete", "completed"].includes(publishingPhase)
    ) {
      nextStatus = "published";
    }


    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      platform_video_id: publication.platform_video_id,
      error_message:
        nextStatus === "failed"
          ? `Facebook video status: ${videoStatus}`
          : null,
      updated_at: new Date().toISOString(),
    };

    if (nextStatus === "published") {
      updatePayload.published_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("platform_publications")
      .update(updatePayload)
      .eq("id", publication.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error(
        "Facebook publication status save failed:",
        updateError.message
      );

      return NextResponse.json(
        {
          error: "Facebook status was fetched but could not be saved.",
          facebookStatus: facebookData.status,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: nextStatus,
      pageName: connection.page_name,
      videoId: publication.platform_video_id,
      facebookStatus: facebookData.status,
    });
  } catch (error) {
    console.error(
      "Facebook status route error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Unexpected error while checking Facebook status." },
      { status: 500 }
    );
  }
}
