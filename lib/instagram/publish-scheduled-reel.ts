
import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const GRAPH_API = "https://graph.instagram.com/v25.0";

type ScheduledContent = {
  id: string;
  user_id: string;
  title: string | null;
  description?: string | null;
  storage_key: string | null;
  instagram_container_id: string | null;
};

type PublishResult = {
  success: boolean;
  permalink?: string;
  mediaId?: string;
  error?: string;
  ambiguous?: boolean;
};

async function graphRequest(
  url: string,
  init?: RequestInit
): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body?.error === "object" &&
      body.error !== null &&
      "message" in body.error
        ? String(body.error.message)
        : `Instagram API returned HTTP ${response.status}`;

    throw new Error(message);
  }

  return body as Record<string, unknown>;
}

export async function publishScheduledReel(
  item: ScheduledContent
): Promise<PublishResult> {
  try {
    if (!item.storage_key) {
      throw new Error("This Reel has no video file.");
    }

    // Get this content owner's Instagram connection.
    const { data: connection, error: connectionError } =
      await supabaseAdmin
        .from("instagram_connections")
        .select(
          "instagram_user_id, access_token, token_expires_at"
        )
        .eq("user_id", item.user_id)
        .maybeSingle();

    if (connectionError) {
      throw new Error("Could not load the Instagram connection.");
    }

    if (
      !connection?.instagram_user_id ||
      !connection?.access_token
    ) {
      throw new Error("No Instagram connection is available for this user.");
    }

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at).getTime() <= Date.now()
    ) {
      throw new Error("The Instagram access token has expired. Reconnect Instagram.");
    }

    const instagramUserId = connection.instagram_user_id;
    const accessToken = connection.access_token;

    const { data: ai, error: aiError } = await supabaseAdmin
      .from("content_ai")
      .select("caption_1, hashtags, cta")
      .eq("content_id", item.id)
      .maybeSingle();

    if (aiError) {
      throw new Error("Could not load the saved caption.");
    }

    const captionParts = [
      ai?.caption_1 || item.description || item.title || "",
      ai?.hashtags || "",
      ai?.cta || "",
    ].filter(Boolean);

    const caption = captionParts
      .join("\n\n")
      .trim()
      .slice(0, 2200);

    const { data: signedVideo, error: signedUrlError } =
      await supabaseAdmin.storage
        .from("content-media")
        .createSignedUrl(item.storage_key, 60 * 60);

    if (signedUrlError || !signedVideo?.signedUrl) {
      throw new Error("Could not create a temporary video URL.");
    }

    // Reuse an existing container after an interrupted attempt.
    let containerId = item.instagram_container_id;

    if (!containerId) {
      const form = new URLSearchParams({
        media_type: "REELS",
        video_url: signedVideo.signedUrl,
        caption,
        access_token: accessToken,
      });

      const container = await graphRequest(
        `${GRAPH_API}/${instagramUserId}/media`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: AbortSignal.timeout(25_000),
        }
      );

      if (typeof container.id !== "string") {
        throw new Error("Instagram did not return a Reel container ID.");
      }

      containerId = container.id;

      // Persist the container immediately so the next attempt can reuse it.
      const { error: saveContainerError } = await supabaseAdmin
        .from("content")
        .update({
          instagram_container_id: containerId,
          publishing_error: null,
        })
        .eq("id", item.id);

      if (saveContainerError) {
        throw new Error(
          "The Instagram container was created, but its ID could not be saved. Check Instagram before retrying."
        );
      }
    }

    // Wait for Instagram to finish processing the video.
    let ready = false;

    for (let attempt = 0; attempt < 8; attempt++) {
      const status = await graphRequest(
        `${GRAPH_API}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(15_000) }
      );

      if (status.status_code === "FINISHED") {
        ready = true;
        break;
      }

      if (
        status.status_code === "ERROR" ||
        status.status_code === "EXPIRED"
      ) {
        throw new Error(
          `Instagram container status: ${String(status.status_code)}.`
        );
      }

      // Do not sleep in a serverless request; let the next scheduler check
      // continue processing instead.
      return {
        success: false,
        error: "Instagram is still processing the Reel. Retry the status check later.",
      };
    }

    if (!ready) {
      return {
        success: false,
        error: "Instagram is still processing the Reel. Retry the status check later.",
      };
    }

    // Do not automatically retry an ambiguous media_publish network failure.
    let published: Record<string, unknown>;

    try {
      const form = new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken,
      });

      published = await graphRequest(
        `${GRAPH_API}/${instagramUserId}/media_publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form,
          signal: AbortSignal.timeout(25_000),
        }
      );
    } catch (error) {
      return {
        success: false,
        ambiguous: true,
        error:
          "Instagram's publish result could not be confirmed. Check the Instagram account before retrying.",
      };
    }

    if (typeof published.id !== "string") {
      return {
        success: false,
        ambiguous: true,
        error:
          "Instagram returned no media ID. Check the Instagram account before retrying.",
      };
    }

    const mediaId = published.id;

    let permalink: string | undefined;

    try {
      const mediaDetails = await graphRequest(
        `${GRAPH_API}/${mediaId}?fields=id,permalink&access_token=${encodeURIComponent(accessToken)}`,
        { signal: AbortSignal.timeout(15_000) }
      );

      if (typeof mediaDetails.permalink === "string") {
        permalink = mediaDetails.permalink;
      }
    } catch {
      // The Reel may already be published. Save its ID even if permalink
      // retrieval fails, so the scheduler does not publish it again.
    }

    const { error: saveError } = await supabaseAdmin
      .from("content")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        instagram_media_id: mediaId,
        permalink: permalink ?? null,
        publishing_error: null,
      })
      .eq("id", item.id);

    if (saveError) {
      return {
        success: false,
        ambiguous: true,
        error:
          "Instagram may have published the Reel, but saving its status failed. Check Instagram before retrying.",
      };
    }

    return { success: true, mediaId, permalink };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected Instagram publishing error.",
    };
  }
}
