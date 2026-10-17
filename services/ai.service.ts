import { supabase } from "@/lib/supabase/client";
import { getAIProvider } from "./ai";
import type { ReelIdea } from "./ai/provider";

export async function generateAI(
  contentId: string,
  title: string
) {
  console.log("🔥 generateAI CALLED");
  console.log("🔥 CONTENT TITLE:", title);

  const provider = getAIProvider();

  console.log("🔥 PROVIDER CREATED:", provider.constructor.name);

  const result = await provider.analyzeContent({
    title,
  });

  console.log("🔥 OLLAMA/AI RESULT:", result);

  const { data, error } = await supabase
    .from("content_ai")
    .insert({
      content_id: contentId,
      ...result,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getAIAnalysis(
  contentId: string
) {
  const { data, error } =
    await supabase
      .from("content_ai")
      .select("*")
      .eq("content_id", contentId)
      .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getAllAIAnalysis() {
  const { data, error } = await supabase
    .from("content_ai")
    .select(`
      *,
      content (
        id,
        title,
        status,
        scheduled_for,
        published_at
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  return data || [];
}


export async function generateSuggestedReels() {
  const { getTopPerformingReels } = await import(
    "./performance.service"
  );

  const { topByViews, topByEngagement } =
    await getTopPerformingReels();

  const aiAnalyses = await getAllAIAnalysis();

  const analysisRows = (aiAnalyses ?? []) as Array<{
    content_id?: string;
    category?: string | null;
    topic?: string | null;
  }>;

  const analysisByContent = new Map(
    analysisRows.map((item) => [
      item.content_id,
      item,
    ])
  );

  const topReels = [
    ...topByViews,
    ...topByEngagement,
  ];

  const topPerformingTitles = [
    ...new Set(
      topReels
        .map((reel) => reel.title?.trim())
        .filter((title): title is string => Boolean(title))
    ),
  ].slice(0, 5);


  const topPerformingTopics: string[] = [];
  const topPerformingCategories: string[] = [];

  for (const reel of topReels) {
    const analysis = analysisByContent.get(
      reel.content_id
    );

    if (
      analysis?.topic &&
      !topPerformingTopics.includes(analysis.topic)
    ) {
      topPerformingTopics.push(analysis.topic);
    }

    if (
      analysis?.category &&
      !topPerformingCategories.includes(
        analysis.category
      )
    ) {
      topPerformingCategories.push(
        analysis.category
      );
    }
  }


  console.log("Reel idea input:", {
    topPerformingTopics,
    topPerformingCategories,
  });



  const provider = getAIProvider();


  return provider.generateReelIdeas({
    topPerformingTopics:
      topPerformingTopics.length > 0
        ? topPerformingTopics.slice(0, 5)
        : ["Entertainment"],

    topPerformingCategories:
      topPerformingCategories.length > 0
        ? topPerformingCategories.slice(0, 5)
        : ["General"],

    topPerformingTitles:
      topPerformingTitles.length > 0
        ? topPerformingTitles
        : ["No title available"],
  });



}

