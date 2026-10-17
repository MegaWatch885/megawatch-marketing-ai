import {
  AIAnalysisResult,
  AIProvider,
  ReelIdea,
  ReelIdeaProvider,
} from "./provider";

export class MockAIProvider
  implements AIProvider, ReelIdeaProvider {
  async analyzeContent(input: {
    title: string;
  }): Promise<AIAnalysisResult> {
    return {
      category: "Entertainment",
      tone: "Emotional",
      topic: "Movie Scene",
      audience_cues:
        "Fans of emotional movie clips",

      caption_1:
        "Some stories stay forever ❤️",

      caption_2:
        "This scene hits different 🎬",

      caption_3:
        "A moment worth watching again.",

      hashtags:
        "#viral #reels #movies",

      cta:
        "Follow for more",

      platform_fit:
        "Instagram Reels",

      confidence: 92,
    };
  }


async generateReelIdeas(input: {
  topPerformingTopics: string[];
  topPerformingCategories: string[];
  topPerformingTitles: string[];
}): Promise<ReelIdea[]> {
  const topic =
    input.topPerformingTopics[0] || "Entertainment";

  const category =
    input.topPerformingCategories[0] || "General";

  const sourceTitles = input.topPerformingTitles
    .map((title) => title.trim())
    .filter(Boolean);

  const titles =
    sourceTitles.length > 0
      ? sourceTitles.slice(0, 3)
      : ["General Entertainment"];

  return titles.map((sourceTitle, index) => {
    const formats = [
      {
        title: `A fresh take on ${sourceTitle}`,
        hook: `What makes "${sourceTitle}" worth discussing?`,
        caption: `Share your perspective on ${sourceTitle}.`,
        cta: "Share your thoughts",
        reason: "A discussion-based format is a testable way to encourage audience responses.",
      },
      {
        title: `${sourceTitle}: A closer look`,
        hook: `Let's take a closer look at ${sourceTitle}.`,
        caption: `What stands out to you about ${sourceTitle}?`,
        cta: "Comment below",
        reason: "An open-ended question gives viewers a clear way to join the discussion.",
      },
      {
        title: `Your take on ${sourceTitle}`,
        hook: `What's your take on ${sourceTitle}?`,
        caption: `Join the conversation about ${sourceTitle}.`,
        cta: "Follow for more",
        reason: "A simple discussion format provides another angle to test.",
      },
    ];

    const format = formats[index % formats.length];

    return {
      sourceTitle,
      ...format,
      hashtags: `#${category.replace(/[^a-z0-9]/gi, "")} #Reels #ContentIdeas`,
    };
  });
}



}