
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  permalink?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramApiError = {
  error?: { message?: string };
};

type InstagramMediaResponse = InstagramApiError & {
  data?: InstagramMedia[];
  paging?: { next?: string };
};

type InstagramInsight = {
  name: string;
  values?: Array<{ value?: number | null }>;
};

type InstagramInsightsResponse = InstagramApiError & {
  data?: InstagramInsight[];
};

type MetricValue = number | null;

function getMetric(
  metrics: Record<string, MetricValue>,
  name: string,
  fallback?: number
): MetricValue {
  if (typeof metrics[name] === "number") {
    return metrics[name];
  }

  return typeof fallback === "number" ? fallback : null;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the current application user.
    const authClient = await createClient();

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Please log in to sync Instagram." },
        { status: 401 }
      );
    }

    // 2. Load the user's Instagram connection.
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
          error: "Connect or reconnect Instagram before syncing.",
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
          error: "Instagram access token has expired. Please reconnect.",
        },
        { status: 401 }
      );
    }

    // 3. Validate the requested sync limit.
    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body.limit ?? 10);

    const limit = Number.isFinite(requestedLimit)
      ? Math.min(25, Math.max(1, Math.floor(requestedLimit)))
      : 10;

    // 4. Fetch recent Instagram media.
    const mediaUrl = new URL(
      `https://graph.instagram.com/${encodeURIComponent(
        connection.instagram_user_id
      )}/media`
    );

    mediaUrl.searchParams.set(
      "fields",
      "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count"
    );
    mediaUrl.searchParams.set("limit", String(limit));
    mediaUrl.searchParams.set("access_token", connection.access_token);

    const mediaResponse = await fetch(mediaUrl, { cache: "no-store" });
    const mediaResult = (await mediaResponse.json()) as InstagramMediaResponse;

    if (!mediaResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "fetch_media",
          error:
            mediaResult.error?.message ?? "Could not fetch Instagram media.",
        },
        { status: 502 }
      );
    }

    const mediaItems = Array.isArray(mediaResult.data)
      ? mediaResult.data
      : [];

    const results: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];

    // Use UTC day boundaries for daily snapshots.
    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const nextDayStart = new Date(dayStart.getTime() + 86_400_000);

    // Keep concurrency limited to avoid sending too many API requests at once.
    const BATCH_SIZE = 3;

    for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
      const batch = mediaItems.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (media) => {
          try {
            if (!media.id) {
              errors.push({
                step: "validate_media",
                error: "Instagram returned a media item without an ID.",
              });
              return;
            }

            // 5. Match content owned by the logged-in user.
            const { data: content, error: contentError } =
              await supabaseAdmin
                .from("content")
                .select("id, title, instagram_media_id, user_id")
                .eq("instagram_media_id", media.id)
                .eq("user_id", user.id)
                .maybeSingle();

            if (contentError) {
              errors.push({
                mediaId: media.id,
                step: "match_content",
                error: contentError.message,
              });
              return;
            }

            if (!content) {
              results.push({
                mediaId: media.id,
                permalink: media.permalink ?? null,
                synced: false,
                reason: "No matching content record for this user.",
              });
              return;
            }

            // 6. Fetch insights. Instagram may not support every metric
            // for every media type or API configuration.
            const insightsUrl = new URL(
              `https://graph.instagram.com/${encodeURIComponent(
                media.id
              )}/insights`
            );

            insightsUrl.searchParams.set(
              "metric",
              "views,reach,likes,comments,saved,shares"
            );
            insightsUrl.searchParams.set(
              "access_token",
              connection.access_token
            );

            const insightsResponse = await fetch(insightsUrl, {
              cache: "no-store",
            });

            const insightsResult =
              (await insightsResponse.json()) as InstagramInsightsResponse;

            if (!insightsResponse.ok) {
              errors.push({
                mediaId: media.id,
                contentId: content.id,
                step: "fetch_insights",
                error:
                  insightsResult.error?.message ??
                  "Could not fetch Instagram insights.",
              });
              return;
            }

            const rawMetrics: Record<string, MetricValue> = {};

            for (const insight of insightsResult.data ?? []) {
              const value = insight.values?.[0]?.value;

              rawMetrics[insight.name] =
                typeof value === "number" ? value : null;
            }

            // Use media-level counts only when the insight metric is absent.
            // Unknown values remain null rather than being falsely reported as 0.
            const views = getMetric(rawMetrics, "views");
            const reach = getMetric(rawMetrics, "reach");
            const likes = getMetric(
              rawMetrics,
              "likes",
              media.like_count
            );
            const comments = getMetric(
              rawMetrics,
              "comments",
              media.comments_count
            );
            const shares = getMetric(rawMetrics, "shares");
            const saves = getMetric(rawMetrics, "saved");

            const engagementParts = [likes, comments, shares, saves];
            const availableEngagementParts = engagementParts.filter(
              (value): value is number => typeof value === "number"
            );

            const engagementRate =
              typeof reach === "number" &&
              reach > 0 &&
              availableEngagementParts.length > 0
                ? Number(
                    (
                      (availableEngagementParts.reduce(
                        (total, value) => total + value,
                        0
                      ) /
                        reach) *
                      100
                    ).toFixed(2)
                  )
                : null;

            const performancePayload = {
              content_id: content.id,
              platform: "Instagram",
              views,
              reach,
              likes,
              comments,
              shares,
              saves,
              engagement_rate: engagementRate,
            };

            // 7. Find today's snapshot for this content/platform.
            const { data: todaySnapshot, error: snapshotError } =
              await supabaseAdmin
                .from("content_performance")
                .select("id")
                .eq("content_id", content.id)
                .eq("platform", "Instagram")
                .gte("recorded_at", dayStart.toISOString())
                .lt("recorded_at", nextDayStart.toISOString())
                .order("recorded_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (snapshotError) {
              errors.push({
                mediaId: media.id,
                contentId: content.id,
                step: "find_daily_snapshot",
                error: snapshotError.message,
              });
              return;
            }

            const recordedAt = new Date().toISOString();
            let action: "inserted" | "updated";
            let saveError: { message: string } | null = null;

            if (todaySnapshot) {
              const { error } = await supabaseAdmin
                .from("content_performance")
                .update({
                  ...performancePayload,
                  recorded_at: recordedAt,
                })
                .eq("id", todaySnapshot.id)
                .eq("content_id", content.id);

              saveError = error;
              action = "updated";
            } else {
              const { error } = await supabaseAdmin
                .from("content_performance")
                .insert({
                  ...performancePayload,
                  recorded_at: recordedAt,
                });

              saveError = error;
              action = "inserted";
            }

            if (saveError) {
              errors.push({
                mediaId: media.id,
                contentId: content.id,
                step: "save_performance",
                error: saveError.message,
              });
              return;
            }

            results.push({
              mediaId: media.id,
              contentId: content.id,
              title: content.title,
              synced: true,
              action,
              metrics: performancePayload,
            });
          } catch (mediaError) {
            errors.push({
              mediaId: media.id,
              step: "process_media",
              error:
                mediaError instanceof Error
                  ? mediaError.message
                  : "Unexpected media processing error.",
            });
          }
        })
      );
    }

    const syncedResults = results.filter((item) => item.synced === true);

    return NextResponse.json({
      success: true,
      instagramUsername: connection.username ?? null,
      fetched: mediaItems.length,
      synced: syncedResults.length,
      inserted: syncedResults.filter((item) => item.action === "inserted")
        .length,
      updated: syncedResults.filter((item) => item.action === "updated")
        .length,
      unmatched: results.filter((item) => item.synced === false).length,
      results,
      errors,
      nextPageAvailable: Boolean(mediaResult.paging?.next),
    });
  } catch (error) {
    console.error(
      "Instagram sync failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        success: false,
        error: "Instagram sync failed. Please check the server logs.",
      },
      { status: 500 }
    );
  }
}
