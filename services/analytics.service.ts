import { supabase } from "@/lib/supabase/client";

export async function getContentAnalytics() {
  const { data, error } = await supabase
    .from("content")
    .select(`
      id,
      title,
      status,
      created_at,
      scheduled_for,
      published_at,
      content_ai (
        category,
        tone,
        confidence
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const items = data || [];




  return {
    total: items.length,

    uploaded: items.filter(
      (item) => item.status === "uploaded"
    ).length,

    processing: items.filter(
      (item) => item.status === "processing"
    ).length,

    ready: items.filter(
      (item) => item.status === "ready"
    ).length,

    scheduled: items.filter(
      (item) => item.status === "scheduled"
    ).length,

    published: items.filter(
      (item) => item.status === "published"
    ).length,

    recent: items.slice(0, 10),
  };
}

export async function getPublishingActivity() {
  const { data, error } = await supabase
    .from("content")
    .select(`
    id,
    title,
    published_at,
    content_ai (
      content_id,
      category,
      tone,
      confidence
    )
  `)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) throw error;

  return data || [];
}


export async function getDashboardData() {
  const { data, error } = await supabase
    .from("content")
    .select(`
id,
  title,
  status,
  created_at,
  scheduled_for,
  published_at,
  content_ai(
    id,
    category,
    tone,
    topic,
    audience_cues,
    hashtags,
    platform_fit,
    confidence
  )
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const items = data || [];

  // Latest real Instagram performance snapshot per content
  const { data: performanceRows, error: performanceError } =
    await supabase
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

  if (performanceError) throw performanceError;

  // Keep only the latest snapshot for each content item.
  // This prevents historical snapshots from being counted repeatedly.
  const latestByContent = new Map<
    string,
    NonNullable<typeof performanceRows>[number]
  >();

  for (const row of performanceRows ?? []) {
    if (!latestByContent.has(row.content_id)) {
      latestByContent.set(row.content_id, row);
    }
  }

  const latestPerformance = Array.from(latestByContent.values());

  const instagramPerformance = {
    reelsTracked: latestPerformance.length,
    views: latestPerformance.reduce(
      (sum, row) => sum + Number(row.views ?? 0),
      0
    ),
    reach: latestPerformance.reduce(
      (sum, row) => sum + Number(row.reach ?? 0),
      0
    ),
    likes: latestPerformance.reduce(
      (sum, row) => sum + Number(row.likes ?? 0),
      0
    ),
    comments: latestPerformance.reduce(
      (sum, row) => sum + Number(row.comments ?? 0),
      0
    ),
    shares: latestPerformance.reduce(
      (sum, row) => sum + Number(row.shares ?? 0),
      0
    ),
    saves: latestPerformance.reduce(
      (sum, row) => sum + Number(row.saves ?? 0),
      0
    ),
    engagementRate:
      latestPerformance.length > 0
        ? Number(
          (
            latestPerformance.reduce(
              (sum, row) =>
                sum + Number(row.engagement_rate ?? 0),
              0
            ) / latestPerformance.length
          ).toFixed(2)
        )
        : 0,
  };



  const aiReady = items.filter((item) => {
    const aiData = Array.isArray(item.content_ai)
      ? item.content_ai[0] ?? null
      : item.content_ai ?? null;

    return Boolean(aiData);
  });

  const aiAnalyses = items
    .map((item) =>
      Array.isArray(item.content_ai)
        ? item.content_ai[0] ?? null
        : item.content_ai ?? null
    )
    .filter(Boolean);

  const categoryCounts: Record<string, number> = {};

  const toneCounts: Record<string, number> = {};

  let confidenceTotal = 0;
  let confidenceCount = 0;

  for (const analysis of aiAnalyses) {
    if (analysis.category) {
      categoryCounts[analysis.category] =
        (categoryCounts[analysis.category] || 0) + 1;
    }

    if (analysis.tone) {
      toneCounts[analysis.tone] =
        (toneCounts[analysis.tone] || 0) + 1;
    }

    if (
      typeof analysis.confidence === "number"
    ) {
      confidenceTotal += analysis.confidence;
      confidenceCount++;
    }
  }

  const topCategory =
    Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || null;

  const topTone =
    Object.entries(toneCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || null;

  const averageConfidence =
    confidenceCount > 0
      ? Math.round(
        confidenceTotal / confidenceCount
      )
      : 0;

  const upcoming = items
    .filter(
      (item) =>
        item.status === "scheduled" &&
        item.scheduled_for
    )
    .filter(
      (item) =>
        new Date(item.scheduled_for!).getTime() >=
        Date.now()
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_for!).getTime() -
        new Date(b.scheduled_for!).getTime()
    );

  const published = items
    .filter(
      (item) =>
        item.status === "published" &&
        item.published_at
    )
    .sort(
      (a, b) =>
        new Date(b.published_at!).getTime() -
        new Date(a.published_at!).getTime()
    );

  const actionNeeded = items.filter(
    (item) =>
      item.status === "uploaded" ||
      item.status === "ready"
  );

  return {
    total: items.length,
    instagramPerformance,

    uploaded: items.filter(
      (item) => item.status === "uploaded"
    ).length,

    processing: items.filter(
      (item) => item.status === "processing"
    ).length,

    ready: items.filter(
      (item) => item.status === "ready"
    ).length,

    scheduled: items.filter(
      (item) => item.status === "scheduled"
    ).length,

    published: items.filter(
      (item) => item.status === "published"
    ).length,

    aiReady: aiReady.length,

    aiPending:
      items.length - aiReady.length,

    topCategory,

    topTone,

    averageConfidence,

    upcoming: upcoming.slice(0, 5),

    nextScheduled:
      upcoming.length > 0
        ? upcoming[0]
        : null,

    publishingActivity:
      published.slice(0, 5),

    actionNeeded:
      actionNeeded.slice(0, 5),

    recent:
      items.slice(0, 10),
  };
}

