
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  timestamp?: string;
  permalink?: string;
};

type InstagramApiResponse = {
  data?: InstagramMedia[];
  paging?: { next?: string };
  error?: { message?: string };
};

async function saveInstagramVideo(
  media: InstagramMedia,
  userId: string
): Promise<string | null> {
  if (
    media.media_type !== "VIDEO" ||
    !media.media_url
  ) {
    return null;
  }

  const videoResponse = await fetch(media.media_url, {
    cache: "no-store",
  });

  if (!videoResponse.ok) {
    throw new Error(
      `Could not download Instagram video (${videoResponse.status}).`
    );
  }

  const contentType =
    videoResponse.headers.get("content-type") || "";

  if (!contentType.startsWith("video/")) {
    throw new Error(
      `Instagram URL did not return a video file (${contentType || "unknown type"}).`
    );
  }

  const videoBuffer = await videoResponse.arrayBuffer();

  if (videoBuffer.byteLength === 0) {
    throw new Error("Instagram returned an empty video file.");
  }

  const path =
    `${userId}/instagram-${media.id}-${Date.now()}.mp4`;

  const { error } = await supabaseAdmin.storage
    .from("content-media")
    .upload(path, videoBuffer, {
      contentType: "video/mp4",
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  return path;
}

export async function POST() {
  try {
    const authClient = await createClient();

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: connection, error: connectionError } =
      await supabaseAdmin
        .from("instagram_connections")
        .select(
          "instagram_user_id, username, access_token, token_expires_at"
        )
        .eq("user_id", user.id)
        .maybeSingle();

    if (connectionError) {
      console.error("Instagram connection lookup failed:", connectionError.message);
      return NextResponse.json(
        { success: false, error: "Could not load your Instagram connection." },
        { status: 500 }
      );
    }

    if (!connection?.access_token || !connection.instagram_user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Connect or reconnect your Instagram account before importing posts.",
        },
        { status: 400 }
      );
    }

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Instagram access token has expired. Please reconnect Instagram.",
        },
        { status: 401 }
      );
    }

    const url = new URL(
      `https://graph.instagram.com/${encodeURIComponent(
        connection.instagram_user_id
      )}/media`
    );

    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_product_type,media_url,timestamp,permalink"
    );
    url.searchParams.set("limit", "25");
    url.searchParams.set("access_token", connection.access_token);

    const response = await fetch(url, { cache: "no-store" });
    const result = (await response.json()) as InstagramApiResponse;

    if (!response.ok) {
      console.error("Instagram media fetch failed:", result.error?.message);
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message ?? "Instagram media fetch failed.",
        },
        { status: 502 }
      );
    }

    const mediaItems = Array.isArray(result.data) ? result.data : [];
    const imported: Array<Record<string, unknown>> = [];
    const skipped: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];

    for (const media of mediaItems) {
      if (!media.id) {
        errors.push({
          mediaId: "unknown",
          error: "Instagram returned an invalid media ID.",
        });
        continue;
      }

      const title =
        media.caption?.split("\n")[0]?.trim() ||
        `Instagram ${media.media_type === "VIDEO" ? "Reel" : "Post"} ${media.id}`;

      const { data: existing, error: lookupError } = await supabaseAdmin
        .from("content")
        .select("id, title, storage_key")
        .eq("user_id", user.id)
        .eq("instagram_media_id", media.id)
        .maybeSingle();

      if (lookupError) {
        errors.push({
          mediaId: media.id,
          error: "Could not check existing content.",
        });
        continue;
      }

      try {
        let storageKey = existing?.storage_key ?? null;

        // Also backfill a video file for previously imported items
        // whose storage_key is still empty.
        if (media.media_type === "VIDEO" && !storageKey) {
          storageKey = await saveInstagramVideo(media, user.id);
        }

        if (existing) {
          const { error: updateError } = await supabaseAdmin
            .from("content")
            .update({
              permalink: media.permalink ?? null,
              ...(storageKey ? { storage_key: storageKey } : {}),
            })
            .eq("id", existing.id)
            .eq("user_id", user.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          skipped.push({
            mediaId: media.id,
            contentId: existing.id,
            title: existing.title,
            storageKey,
            reason: "Already imported; details refreshed.",
          });

          continue;
        }

        const { data: created, error: insertError } = await supabaseAdmin
          .from("content")
          .insert({
            user_id: user.id,
            title,
            instagram_media_id: media.id,
            permalink: media.permalink ?? null,
            storage_key: storageKey,
            status: "published",
          })
          .select("id, title, instagram_media_id, permalink, storage_key")
          .single();

        if (insertError) {
          throw new Error(insertError.message);
        }

        imported.push(created);
      } catch (error) {
        console.error(`Import failed for Instagram media ${media.id}:`, error);

        errors.push({
          mediaId: media.id,
          title,
          error:
            error instanceof Error
              ? error.message
              : "Could not import this media item.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      instagramUsername: connection.username ?? null,
      fetched: mediaItems.length,
      importedCount: imported.length,
      alreadyImportedCount: skipped.length,
      errorCount: errors.length,
      imported,
      skipped,
      errors,
      nextPageAvailable: Boolean(result.paging?.next),
    });
  } catch (error) {
    console.error(
      "Instagram import failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { success: false, error: "Instagram import failed." },
      { status: 500 }
    );
  }
}
