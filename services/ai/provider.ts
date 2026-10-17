
export type AIAnalysisResult = {
  category: string;
  tone: string;
  topic: string;
  audience_cues: string;
  caption_1: string;
  caption_2: string;
  caption_3: string;
  hashtags: string;
  cta: string;
  platform_fit: string;
  confidence: number;
};

export interface AIProvider extends ReelIdeaProvider {
  analyzeContent(input: {
    title: string;
    description?: string | null;
    manualText?: string;
  }): Promise<AIAnalysisResult>;
}

export type ReelIdea = {
  sourceTitle: string;
  title: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  reason: string;
};

export interface ReelIdeaProvider {
  generateReelIdeas(input: {
    topPerformingTopics: string[];
    topPerformingCategories: string[];
    topPerformingTitles: string[];
  }): Promise<ReelIdea[]>;
}

export type RepurposePlatform =
  | "instagram_reels"
  | "youtube_shorts";

export type RepurposedContent = {
  contentId: string;
  platform: RepurposePlatform;
  title: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  reason: string;
};

export interface ContentRepurposingProvider {
  repurposeContent(input: {
    contentId: string;
    title: string;
    description?: string | null;
    platform: RepurposePlatform;
  }): Promise<RepurposedContent>;
}

