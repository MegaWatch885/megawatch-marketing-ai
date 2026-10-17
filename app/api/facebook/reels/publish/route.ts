
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const GRAPH_VERSION = "v26.0";
const PAGE_ID = "1347260108473147";
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

type GraphError = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
};

async function readGraphError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as GraphError;

  return {
    message: body.error?.message ?? "Facebook API request failed.",
    code: body.error?.code,
    subcode: body.error?.error_subcode,
  };
}

export async function POST(request: Request) {
  let publicationId: string | null = null;
  let videoId: string | null = null;
  let userId: string | null = null;
  let contentId: string | null = null;

  // If a network failure happens after Facebook accepts the upload,
  // do not automatically mark it failed or retry it.
  let facebookSessionStarted = false;

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

    userId = user.id;

    const body = await request.json().catch(() => null);
    contentId = body?.contentId;

    const description =
      typeof body?.description === "string"
        ? body.description.trim()
        : "";

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

    if (description.length > 5000) {
      return NextResponse.json(
        { error: "Description must be 5000 characters or fewer." },
        { status: 400 }
      );
    }

    const { data: content, error: contentError } = await supabaseAdmin
      .from("content")
      .select("id, title, storage_key, user_id")
      .eq("id", contentId)
      .eq("user_id", user.id)
      .single();

    if (contentError || !content?.storage_key) {
      return NextResponse.json(
        { error: "Content not found, or its video file is missing." },
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

    if (connectionError || !connection?.access_token) {
      return NextResponse.json(
        { error: "Connect the MW Premium Facebook Page first." },
        { status: 400 }
      );
    }

    // Do not start another publish while this content has an active
    // Facebook publication record.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("platform_publications")
      .select("id, status, platform_media_id, platform_video_id")
      .eq("user_id", user.id)
      .eq("content_id", contentId)
      .eq("platform", "facebook")
      .maybeSingle();

    if (existingError) {
      console.error("Facebook publication lookup failed:", existingError.message);

      return NextResponse.json(
        { error: "Could not check Facebook publication history." },
        { status: 500 }
      );
    }

    if (
      existing &&
      ["uploading", "processing", "published"].includes(existing.status)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A Facebook publication already exists or may still be processing. Check its status before retrying.",
          status: existing.status,
          videoId: existing.platform_video_id,
        },
        { status: 409 }
      );
    }

    const { data: videoBlob, error: downloadError } =
      await supabaseAdmin.storage
        .from("content-media")
        .download(content.storage_key);

    if (downloadError || !videoBlob) {
      return NextResponse.json(
        { error: "Could not read the stored video." },
        { status: 500 }
      );
    }

    if (videoBlob.size === 0 || videoBlob.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: "Video must be non-empty and no larger than 1 GB." },
        { status: 400 }
      );
    }


    const { data: claimRows, error: claimError } = await supabaseAdmin.rpc(
      "claim_platform_publication",
      {
        p_user_id: user.id,
        p_content_id: contentId,
        p_platform: "facebook",
        p_account_id: PAGE_ID,
        p_account_name: connection.page_name,
        p_caption: description || content.title || "",
      }
    );

    if (claimError) {
      console.error("Facebook publication claim failed:", claimError.message);

      return NextResponse.json(
        { error: "Could not safely claim this Facebook publication." },
        { status: 500 }
      );
    }

    const claim = Array.isArray(claimRows) ? claimRows[0] : null;

    if (!claim?.claimed) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A Facebook publication already exists or may still be processing. Check its status before retrying.",
          status: claim?.current_status ?? "unknown",
        },
        { status: 409 }
      );
    }

    publicationId = claim.publication_id;



    const accessToken = connection.access_token;
    const graphBase = `https://graph.facebook.com/${GRAPH_VERSION}`;

    // Phase 1: Start the Facebook Reel upload session.
    const startUrl = new URL(`${graphBase}/${PAGE_ID}/video_reels`);
    startUrl.searchParams.set("upload_phase", "start");

    const startResponse = await fetch(startUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!startResponse.ok) {
      const error = await readGraphError(startResponse);
      console.error("Facebook Reel start failed:", error);

      await supabaseAdmin
        .from("platform_publications")
        .update({
          status: "failed",
          error_message: error.message.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", publicationId);

      return NextResponse.json(
        { error: error.message },
        { status: 502 }
      );
    }


    const startData = (await startResponse.json().catch(() => null)) as
      | {
        video_id?: string;
        upload_url?: string;
      }
      | null;

    if (!startData?.video_id || !startData.upload_url) {
      // Facebook may have created a session even though the response
      // is incomplete. Keep the publication blocked from automatic retry.
      await supabaseAdmin
        .from("platform_publications")
        .update({
          status: "processing",
          platform_media_id: startData?.video_id ?? null,
          platform_video_id: startData?.video_id ?? null,
          error_message:
            "Facebook returned an incomplete upload session. Verify the Facebook publication before retrying.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", publicationId)
        .eq("user_id", user.id)
        .eq("platform", "facebook");

      return NextResponse.json(
        {
          success: false,
          status: "processing",
          error:
            "Facebook returned an incomplete upload session. Verify status before retrying.",
          ...(startData?.video_id ? { videoId: startData.video_id } : {}),
        },
        { status: 502 }
      );
    }

    videoId = startData.video_id;
    facebookSessionStarted = true;


    // Phase 2: Upload the binary to the URL returned by Facebook.
    const uploadResponse = await fetch(startData.upload_url, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        "Content-Type": "application/octet-stream",
        offset: "0",
        file_size: String(videoBlob.size),
      },
      body: videoBlob,
      cache: "no-store",
    });

    if (!uploadResponse.ok) {
      const error = await readGraphError(uploadResponse);
      console.error("Facebook Reel upload failed:", error);

      await supabaseAdmin
        .from("platform_publications")
        .update({
          status: "processing",
          platform_media_id: videoId,
          error_message:
            "Upload result needs checking before retrying. " +
            error.message.slice(0, 800),
          updated_at: new Date().toISOString(),
        })
        .eq("id", publicationId);

      return NextResponse.json(
        {
          error: "Facebook upload did not complete clearly. Check status before retrying.",
          videoId,
        },
        { status: 502 }
      );
    }

    // Phase 3: Request publication.
    const finishUrl = new URL(`${graphBase}/${PAGE_ID}/video_reels`);
    finishUrl.searchParams.set("upload_phase", "finish");
    finishUrl.searchParams.set("video_id", videoId);
    finishUrl.searchParams.set("video_state", "PUBLISHED");
    finishUrl.searchParams.set(
      "description",
      description || content.title || ""
    );

    const finishResponse = await fetch(finishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!finishResponse.ok) {
      const error = await readGraphError(finishResponse);
      console.error("Facebook Reel finish failed:", error);

      await supabaseAdmin
        .from("platform_publications")
        .update({
          status: "processing",
          platform_media_id: videoId,
          error_message:
            "Finish request needs verification before retrying. " +
            error.message.slice(0, 800),
          updated_at: new Date().toISOString(),
        })
        .eq("id", publicationId);

      return NextResponse.json(
        {
          error: "Facebook's final publish result is uncertain. Check Facebook before retrying.",
          videoId,
        },
        { status: 502 }
      );
    }

    const finishData = (await finishResponse.json().catch(() => ({}))) as {
      success?: boolean;
      post_id?: string;
    };

    if (finishData.success !== true) {
      await supabaseAdmin
        .from("platform_publications")
        .update({
          status: "processing",
          platform_media_id: videoId,
          error_message: "Facebook did not confirm publication.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", publicationId);

      return NextResponse.json(
        {
          error: "Facebook did not confirm publication. Verify status before retrying.",
          videoId,
        },
        { status: 502 }
      );
    }

    // Facebook accepted the publish request. Processing can continue
    // asynchronously, so don't mark it published yet.

    const { error: updateError } = await supabaseAdmin
      .from("platform_publications")
      .update({
        status: "processing",
        platform_media_id: finishData.post_id || videoId,
        platform_video_id: videoId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", publicationId);


    if (updateError) {
      console.error("Facebook history update failed:", updateError.message);

      return NextResponse.json(
        {
          success: true,
          status: "processing",
          videoId,
          warning: "Facebook accepted the request, but publication history needs reconciliation.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      status: "processing",
      pageName: connection.page_name,
      videoId,
      postId: finishData.post_id ?? null,
      message:
        "Facebook accepted the publish request. Verify processing status before marking it published.",
    });
  } catch (error) {
    const safeMessage =
      error instanceof Error
        ? error.message.slice(0, 800)
        : "Unknown error";

    console.error("Facebook Reel route error:", safeMessage);

    if (publicationId) {
      await supabaseAdmin
        .from("platform_publications")
        .update({
          status: facebookSessionStarted ? "processing" : "failed",
          platform_media_id: videoId,
          error_message: facebookSessionStarted
            ? "Request interrupted after the Facebook upload session started. Verify before retrying."
            : "Request failed before a Facebook upload session was confirmed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", publicationId)
        .eq("user_id", userId)
        .eq("platform", "facebook");
    }

    return NextResponse.json(
      {
        error: "An unexpected error occurred while publishing the Reel.",
        ...(videoId ? { videoId } : {}),
      },
      { status: 500 }
    );
  }
}
