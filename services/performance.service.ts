import { supabase } from "@/lib/supabase/client";

import { getAllAIAnalysis } from "./ai.service";

export interface ContentPerformance {
  id: string;
  content_id: string;
  platform: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
  recorded_at: string;
  created_at: string;
}

export async function getPerformanceByContentId(
  contentId: string
): Promise<ContentPerformance[]> {
  const { data, error } = await supabase
    .from("content_performance")
    .select("*")
    .eq("content_id", contentId)
    .order("recorded_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as ContentPerformance[];
}

export async function getPerformanceHistory(
  contentId: string
): Promise<ContentPerformance[]> {
  const { data, error } = await supabase
    .from("content_performance")
    .select("*")
    .eq("content_id", contentId)
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as ContentPerformance[];
}


export async function getInstagramPerformanceHistory(
  days?: number
) {
  let query = supabase
    .from("content_performance")
    .select(
      "recorded_at, views, reach, likes, comments, shares, saves"
    )
    .eq("platform", "Instagram")
    .order("recorded_at", { ascending: true });

  // Apply date filter when days is provided.
  if (days !== undefined) {

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    console.log("Filtering history for days:", days);
    console.log("Start date:", startDate.toISOString());

    query = query.gte("recorded_at", startDate.toISOString());
  }

  const { data, error } = await query;


  console.log("Days argument:", days);
  console.log("Raw snapshot count:", data?.length);
  console.log(
    "Raw snapshot dates:",
    data?.map((row) => row.recorded_at)
  );

  if (error) throw error;

  // Combine snapshots recorded on the same day.
  const dailyTotals = new Map<
    string,
    {
      date: string;
      views: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    }
  >();

  for (const row of data ?? []) {
    const date = new Date(row.recorded_at)
      .toISOString()
      .slice(0, 10);

    const existing = dailyTotals.get(date) ?? {
      date,
      views: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    };

    existing.views += Number(row.views ?? 0);
    existing.reach += Number(row.reach ?? 0);
    existing.likes += Number(row.likes ?? 0);
    existing.comments += Number(row.comments ?? 0);
    existing.shares += Number(row.shares ?? 0);
    existing.saves += Number(row.saves ?? 0);

    dailyTotals.set(date, existing);
  }

  return Array.from(dailyTotals.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}



export async function getTopPerformingReels() {
  const { data, error } = await supabase
    .from("content_performance")
    .select(`
      content_id,
      platform,
      views,
      reach,
      likes,
      comments,
      shares,
      saves,
      engagement_rate,
      recorded_at
    `)
    .eq("platform", "Instagram")
    .order("recorded_at", { ascending: false });

  if (error) {
    console.error("Top Reels performance query error:", error);
    throw error;
  }

  // Keep only the latest snapshot for each Reel.
  const latestByContent = new Map<
    string,
    (typeof data)[number]
  >();

  for (const row of data ?? []) {
    if (!latestByContent.has(row.content_id)) {
      latestByContent.set(row.content_id, row);
    }
  }

  const latestRows = Array.from(latestByContent.values());
  const contentIds = latestRows.map((row) => row.content_id);

  // Fetch Reel titles separately.
  const { data: contentRows, error: contentError } =
    contentIds.length > 0
      ? await supabase
        .from("content")
        .select("id, title")
        .in("id", contentIds)
      : { data: [], error: null };

  if (contentError) {
    console.error("Top Reels content query error:", contentError);
    throw contentError;
  }

  const titleById = new Map(
    (contentRows ?? []).map((item) => [item.id, item.title])
  );

  const reels = latestRows.map((row) => ({
    content_id: row.content_id,
    title: titleById.get(row.content_id) ?? "Untitled Reel",
    views: Number(row.views ?? 0),
    reach: Number(row.reach ?? 0),
    likes: Number(row.likes ?? 0),
    comments: Number(row.comments ?? 0),
    shares: Number(row.shares ?? 0),
    saves: Number(row.saves ?? 0),
    engagement_rate: Number(row.engagement_rate ?? 0),
  }));

    return {
      topByViews: [...reels]
        .sort((a, b) => b.views - a.views)
        .slice(0, 5),

      topByEngagement: [...reels]
        .sort((a, b) => b.engagement_rate - a.engagement_rate)
        .slice(0, 5),
    };
}



export async function getContentRecommendations() {
  const [
    { topByViews, topByEngagement },
    aiAnalyses,
  ] = await Promise.all([
    getTopPerformingReels(),
    getAllAIAnalysis(),
  ]);

  const recommendations: {
    title: string;
    reason: string;
    type: "success" | "suggestion" | "caution";
  }[] = [];

  if (topByViews.length === 0) {
    return [
      {
        title: "Collect more performance data",
        reason:
          "Sync Instagram Reels to generate performance-based recommendations.",
        type: "caution" as const,
      },
    ];
  }

  const bestViewsReel = topByViews[0];
  const bestEngagementReel = topByEngagement[0];

  recommendations.push({
    title: "Repeat successful content patterns",
    reason: `"${bestViewsReel.title}" has the highest recorded views (${bestViewsReel.views.toLocaleString()}). Review its AI-analyzed topic and category before creating similar content.`,
    type: "success",
  });

  if (bestEngagementReel) {
    recommendations.push({
      title: "Learn from high-engagement content",
      reason: `"${bestEngagementReel.title}" has the highest recorded engagement rate (${bestEngagementReel.engagement_rate}%). Review its topic, tone and call to action.`,
      type: "suggestion",
    });
  }

  const mostSharedReel = [...topByViews].sort(
    (a, b) => b.shares - a.shares
  )[0];

  if (mostSharedReel && mostSharedReel.shares > 0) {
    recommendations.push({
      title: "Explore shareable content",
      reason: `"${mostSharedReel.title}" has ${mostSharedReel.shares} recorded shares. Review its AI analysis for ideas to test in future Reels.`,
      type: "suggestion",
    });
  }

  const analysisRows = (aiAnalyses ?? []) as Array<{
    content_id?: string;
    category?: string | null;
    topic?: string | null;
    tone?: string | null;
  }>;

  const analysisByContent = new Map(
    analysisRows.map((analysis) => [
      analysis.content_id,
      analysis,
    ])
  );

  const bestViewsAnalysis = analysisByContent.get(
    bestViewsReel.content_id
  );

  if (bestViewsAnalysis?.topic || bestViewsAnalysis?.category) {
    recommendations.push({
      title: "Build on your analyzed content themes",
      reason: `Your top-viewed Reel is associated with ${
        bestViewsAnalysis.topic
          ? `the topic "${bestViewsAnalysis.topic}"`
          : `the category "${bestViewsAnalysis.category}"`
      }${
        bestViewsAnalysis.category
          ? ` (${bestViewsAnalysis.category})`
          : ""
      }${
        bestViewsAnalysis.tone
          ? ` and a ${bestViewsAnalysis.tone.toLowerCase()} tone`
          : ""
      }. Test another Reel using a related theme and compare its results.`,
      type: "suggestion",
    });
  }

  return recommendations;
}




export async function getLatestPerformanceByContentId(
  contentId: string
): Promise<ContentPerformance | null> {
  const { data, error } = await supabase
    .from("content_performance")
    .select("*")
    .eq("content_id", contentId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data as ContentPerformance | null;
}

export type CreatePerformancePayload = {
  content_id: string;
  platform: string;
  views: number;
  reach?: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate?: number;
  recorded_at?: string;
};

export async function createPerformance(
  payload: CreatePerformancePayload
): Promise<ContentPerformance> {
  const engagementRate =
    payload.engagement_rate ??
    (payload.reach && payload.reach > 0
      ? ((payload.likes +
        payload.comments +
        payload.shares +
        payload.saves) /
        payload.reach) *
      100
      : 0);

  const { data, error } = await supabase
    .from("content_performance")
    .insert([
      {
        content_id: payload.content_id,
        platform: payload.platform,
        views: payload.views,
        reach: payload.reach ?? 0,
        likes: payload.likes,
        comments: payload.comments,
        shares: payload.shares,
        saves: payload.saves,
        engagement_rate: Number(engagementRate.toFixed(2)),
        recorded_at:
          payload.recorded_at ?? new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;

  return data as ContentPerformance;
}

