
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedInstagramConnection } from "@/lib/instagram/get-authenticated-connection";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

type InstagramApiResponse = {
  id?: string;
  status_code?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function apiError(
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json(
    { success: false, error: message, ...extra },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError("Please log in first.", 401);
    }

    // 2. Validate request data.
    const body = await request.json().catch(() => null);

    const contentId =
      typeof body?.contentId === "string" ? body.contentId : "";

    const caption =
      typeof body?.caption === "string" ? body.caption.trim() : "";

    if (!contentId) {
      return apiError("contentId is required.", 400);
    }


    // 3. Load content belonging to the signed-in user.
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select(
        "id, user_id, title, description, storage_key, status, instagram_container_id"
      )
      .eq("id", contentId)
      .eq("user_id", user.id)
      .single();

    if (contentError || !content) {
      return apiError("Content not found.", 404);
    }

    if (!content.storage_key) {
      return apiError("This content has no uploaded video.", 400);
    }

    if (content.status === "published") {
      return apiError(
        "This content is already marked as published. Check Instagram before taking further action.",
        409
      );
    }


    // 4. Fetch the primary AI caption, hashtags, and CTA.
    const { data: aiContent, error: aiError } = await supabaseAdmin
      .from("content_ai")
      .select("caption_1, hashtags, cta")
      .eq("content_id", content.id)
      .maybeSingle();

    if (aiError) {
      console.error("Could not load AI caption:", aiError.message);
      return apiError(
        "Could not load AI-generated caption and hashtags.",
        500
      );
    }

    const aiCaption =
      typeof aiContent?.caption_1 === "string"
        ? aiContent.caption_1.trim()
        : "";

    // Support hashtags stored as either an array or a string.
    const rawHashtags = aiContent?.hashtags;

    const hashtagText = Array.isArray(rawHashtags)
      ? rawHashtags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => {
          const cleanTag = tag.replace(/^#+/, "").replace(/\s+/g, "");
          return cleanTag ? `#${cleanTag}` : "";
        })
        .filter(Boolean)
        .join(" ")
      : typeof rawHashtags === "string"
        ? rawHashtags
          .split(/\s+/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((tag) => {
            const cleanTag = tag.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
            return cleanTag ? `#${cleanTag}` : "";
          })
          .filter(Boolean)
          .join(" ")
        : "";

    const aiCta =
      typeof aiContent?.cta === "string"
        ? aiContent.cta.trim()
        : "";

    // A manually supplied caption takes priority.
    // Otherwise publish the primary AI caption (caption_1).
    const baseCaption =
      caption || aiCaption || content.description?.trim() || content.title || "";

    // Avoid appending the same hashtags twice if already included in the caption.
    const captionWithoutExistingHashtags = hashtagText
      ? baseCaption
        .split(/\s+/)
        .filter(
          (part: string) => !/^#[\p{L}\p{N}_]+$/u.test(part)
        )
        .join(" ")
        .trim()
      : baseCaption;

    const finalCaption = [
      captionWithoutExistingHashtags,
      hashtagText,
      aiCta,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();



    console.log("INSTAGRAM FINAL CAPTION:", finalCaption);
    console.log("AI CAPTION LENGTH:", aiCaption.length);
    console.log("MANUAL CAPTION RECEIVED:", Boolean(caption));



    if (!finalCaption) {
      return apiError(
        "No caption is available. Generate an AI caption before publishing.",
        400
      );
    }



    // 4. Get the authenticated Instagram connection.
    const {
      connection,
      error: connectionError,
      status: connectionStatus,
    } = await getAuthenticatedInstagramConnection();

    if (!connection) {
      return apiError(
        connectionError || "Instagram account is not connected.",
        connectionStatus
      );
    }

    const graphBase = "https://graph.instagram.com/v25.0";
    const token = connection.access_token;
    const instagramUserId = connection.instagram_user_id;


    // 5. Reuse a saved container if one already exists.
    // Otherwise, create and save a new Instagram Reel container.
    let containerId = content.instagram_container_id;

    if (containerId) {
      console.log("Reusing Instagram container:", containerId);
    } else {
      const { data: signedUrlData, error: signedUrlError } =
        await supabaseAdmin.storage
          .from("content-media")
          .createSignedUrl(content.storage_key, 60 * 60);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error("Could not create Instagram video URL.");
        return apiError(
          "Could not prepare the video for publishing.",
          500
        );
      }

      const containerResponse = await fetch(
        `${graphBase}/${encodeURIComponent(instagramUserId)}/media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            media_type: "REELS",
            video_url: signedUrlData.signedUrl,
            caption: finalCaption,
          }),
          cache: "no-store",
        }
      );

      const container =
        (await containerResponse.json()) as InstagramApiResponse;

      if (!containerResponse.ok || !container.id) {
        console.error("Instagram container creation failed:", {
          status: containerResponse.status,
          message: container.error?.message,
        });

        return apiError(
          container.error?.message ||
          "Instagram could not create the Reel container.",
          502
        );
      }

      containerId = container.id;

      const { error: containerSaveError } = await supabase
        .from("content")
        .update({ instagram_container_id: containerId })
        .eq("id", content.id)
        .eq("user_id", user.id);

      if (containerSaveError) {
        console.error(
          "Could not save Instagram container ID:",
          containerSaveError.message
        );

        return apiError(
          "Could not save the Instagram processing ID. Check the content record before retrying.",
          500
        );
      }
    }




    // Keep and save the Instagram container ID for status checks.


    const { error: containerSaveError } = await supabase
      .from("content")
      .update({
        instagram_container_id: containerId,
      })
      .eq("id", content.id)
      .eq("user_id", user.id);

    if (containerSaveError) {
      console.error(
        "Could not save Instagram container ID:",
        containerSaveError.message
      );

      return apiError(
        "Could not save the Instagram processing ID. Please check the content record before retrying.",
        500
      );
    }



    // 7. Wait for Instagram to process the video.
    // 15 checks × 4 seconds = approximately 60 seconds.
    let statusCode = "";

    for (let attempt = 0; attempt < 15; attempt++) {
      if (attempt > 0) {
        await wait(4000);
      }

      const statusUrl = new URL(
        `${graphBase}/${encodeURIComponent(containerId)}`
      );

      statusUrl.searchParams.set("fields", "status_code");

      const statusResponse = await fetch(statusUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const statusData =
        (await statusResponse.json()) as InstagramApiResponse;

      if (!statusResponse.ok) {
        console.error("Instagram status check failed:", {
          status: statusResponse.status,
          message: statusData.error?.message,
          containerId,
        });

        return apiError(
          statusData.error?.message ||
          "Could not check Instagram Reel processing status.",
          502,
          { containerId }
        );
      }

      statusCode = statusData.status_code || "";


      console.log("Instagram container status:", {
        containerId,
        statusCode,
      });

      if (statusCode === "FINISHED") {
        break;
      }

      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        return apiError(
          `Instagram Reel processing status: ${statusCode}`,
          422,
          { containerId, statusCode }
        );
      }
    }

    // Do not publish until Instagram reports FINISHED.
    if (statusCode !== "FINISHED") {
      return NextResponse.json(
        {
          success: false,
          processing: true,
          containerId,
          statusCode: statusCode || "IN_PROGRESS",
          error:
            "Instagram is still processing this Reel. Do not submit another publish request yet.",
        },
        { status: 202 }
      );
    }

    // 8. Publish the processed Reel.
    const publishResponse = await fetch(
      `${graphBase}/${encodeURIComponent(instagramUserId)}/media_publish`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          creation_id: containerId,
        }),
        cache: "no-store",
      }
    );

    const published =
      (await publishResponse.json()) as InstagramApiResponse;

    if (!publishResponse.ok || !published.id) {
      console.error("Instagram Reel publish request failed:", {
        status: publishResponse.status,
        message: published.error?.message,
        containerId,
      });

      return apiError(
        published.error?.message ||
        "Instagram did not confirm publication. Check Instagram before retrying.",
        502,
        { containerId }
      );
    }



    // 9. Fetch the published Reel's permalin
    let permalink: string | null = null;

    try {
      const mediaUrl = new URL(
        `${graphBase}/${encodeURIComponent(published.id)}`
      );

      mediaUrl.searchParams.set("fields", "id,permalink");

      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const mediaData =
        (await mediaResponse.json()) as InstagramApiResponse & {
          permalink?: string;
        };

      if (mediaResponse.ok && mediaData.permalink) {
        permalink = mediaData.permalink;
      } else {
        console.warn("Reel published, but permalink was unavailable.", {
          status: mediaResponse.status,
        });
      }
    } catch {
      console.warn("Could not retrieve the Instagram permalink.");
    }

    // 10. Save confirmed publication details.
    const { error: updateError } = await supabase
      .from("content")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        instagram_media_id: published.id,
        permalink,
      })
      .eq("id", content.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Published Reel database update failed:", {
        message: updateError.message,
        instagramMediaId: published.id,
      });

      return NextResponse.json({
        success: true,
        warning:
          "Instagram published the Reel, but saving its details failed. Do not publish it again.",
        instagramMediaId: published.id,
        permalink,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Instagram confirmed that the Reel was published.",
      instagramMediaId: published.id,
      permalink,
    });

  } catch (error) {
    console.error(
      "Instagram publishing request failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return apiError("Unexpected publishing error.", 500);
  }
}

