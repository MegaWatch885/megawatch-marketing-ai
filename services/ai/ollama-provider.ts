import {
  AIAnalysisResult,
  AIProvider,
  ReelIdea,
  ReelIdeaProvider,
} from "./provider";

import type {
  RepurposePlatform,
  RepurposedContent,
  ContentRepurposingProvider,
} from "./provider";


// ======================================================
// AI FIELD CLEANING
// ======================================================

function cleanAIField(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim();

  if (
    !cleaned ||
    cleaned.toLowerCase() === "string" ||
    cleaned.toLowerCase() === "null" ||
    cleaned.toLowerCase() === "undefined"
  ) {
    return fallback;
  }

  return cleaned;
}


// ======================================================
// UNSAFE / PROMPT LEAK DETECTION
// ======================================================

function isUnsafeGeneratedText(
  value: string
): boolean {
  const text = value.toLowerCase();

  const blockedPhrases = [
    "strict transcript-grounded ai content analyzer",
    "my only source of information",
    "transcript provided below",
    "return only valid json",
    "return exactly these",
    "category rule",
    "tone rule",
    "topic rule",
    "audience rule",
    "caption rule",
    "hashtag rule",
    "cta rule",
    "platform rule",
    "confidence rule",
    "strict grounding rules",
    "factual accuracy rules",
    "megawatch social handle",
    "you are an ai",
    "you are a strict",
    "visual observations",
    "json structure",
  ];

  return blockedPhrases.some((phrase) =>
    text.includes(phrase)
  );
}


// ======================================================
// FINAL AI RESULT VALIDATION
// ======================================================

function validateResult(
  result: Partial<AIAnalysisResult>
): AIAnalysisResult {

  const requiredFields: Array<
    keyof AIAnalysisResult
  > = [
      "category",
      "tone",
      "topic",
      "audience_cues",
      "caption_1",
      "caption_2",
      "caption_3",
      "hashtags",
      "cta",
      "platform_fit",
    ];


  // ----------------------------------------------------
  // 1. Required fields
  // ----------------------------------------------------

  for (const field of requiredFields) {
    if (
      typeof result[field] !== "string" ||
      !result[field]?.trim()
    ) {
      console.warn(
        `⚠️ AI response missing/invalid field: ${field}`
      );
    }
  }


  // ----------------------------------------------------
  // 2. Normalize core fields
  // ----------------------------------------------------

  const category = cleanAIField(
    result.category,
    "General"
  );

  const tone = cleanAIField(
    result.tone,
    "Neutral"
  );

  const topic = cleanAIField(
    result.topic,
    "General"
  );

  const audience_cues = cleanAIField(
    result.audience_cues,
    "General audience"
  );


  // ----------------------------------------------------
  // 3. Normalize captions
  // ----------------------------------------------------

  const rawCaption1 = cleanAIField(
    result.caption_1,
    ""
  );

  const rawCaption2 = cleanAIField(
    result.caption_2,
    ""
  );

  const rawCaption3 = cleanAIField(
    result.caption_3,
    ""
  );


  const caption_1 =
    rawCaption1 &&
      !isUnsafeGeneratedText(rawCaption1)
      ? rawCaption1
      : "Watch this moment.";


  const caption_2 =
    rawCaption2 &&
      !isUnsafeGeneratedText(rawCaption2)
      ? rawCaption2
      : "A moment worth watching.";


  const caption_3 =
    rawCaption3 &&
      !isUnsafeGeneratedText(rawCaption3)
      ? rawCaption3
      : "Stay tuned for more.";


  // ----------------------------------------------------
  // 4. Normalize hashtags
  // ----------------------------------------------------

  const hashtagsFallback = cleanAIField(
    result.hashtags,
    "#content #reels"
  );

  let hashtags = hashtagsFallback
    .replace(/\n/g, " ")
    .trim();

  hashtags = hashtags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(" ");


  if (
    !hashtags ||
    isUnsafeGeneratedText(hashtags)
  ) {
    hashtags = "#content #reels";
  }


  // ----------------------------------------------------
  // 5. Normalize CTA
  // ----------------------------------------------------

  const ctaFallback = cleanAIField(
    result.cta,
    "Follow for more"
  );

  let cta = ctaFallback.trim();


  if (isUnsafeGeneratedText(cta)) {
    cta = "Follow for more";
  }


  // Avoid unsupported movie/watch claims.
  cta = cta
    .replace(
      /\bwatch the (full )?movie\b/gi,
      "Learn more"
    )
    .replace(
      /\bwatch now\b/gi,
      "Learn more"
    );



  // ----------------------------------------------------
  // 6. Confidence normalization
  // ----------------------------------------------------
  const rawConfidence = Number(result.confidence);

  let confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(100, rawConfidence))
    : 0;

  // Keep confidence conservative when the analysis is generic.
  const hasUsefulCaption =
    typeof result.caption_1 === "string" &&
    result.caption_1.trim().length >= 100 &&
    result.caption_1 !== "Watch this moment.";

  const hasUsefulTopic =
    typeof result.topic === "string" &&
    result.topic.trim().length > 0 &&
    result.topic.trim() !== "General";

  if (!hasUsefulCaption || !hasUsefulTopic) {
    confidence = Math.min(confidence, 40);
  } else {
    confidence = Math.min(confidence, 85);
  }


  // ----------------------------------------------------
  // 7. Conservative confidence
  // ----------------------------------------------------

  if (confidence > 85) {
    confidence = 85;
  }


  // ----------------------------------------------------
  // 8. Platform normalization
  // ----------------------------------------------------

  // We intentionally keep this conservative.
  // The AI does not have reliable platform evidence
  // from title/video/transcript alone.

  const platform_fit = "General";


  // ----------------------------------------------------
  // 9. Return validated result
  // ----------------------------------------------------

  return {
    category,
    tone,
    topic,
    audience_cues,

    caption_1,
    caption_2,
    caption_3,

    hashtags,
    cta,

    platform_fit,

    confidence,
  };
}


// ======================================================
// OLLAMA PROVIDER
// ======================================================

export class OllamaAIProvider
  implements AIProvider, ReelIdeaProvider, ContentRepurposingProvider {



  // ====================================================
  // REEL ideas
  // ====================================================


  async generateReelIdeas(input: {
    topPerformingTopics: string[];
    topPerformingCategories: string[];
    topPerformingTitles: string[];
  }): Promise<ReelIdea[]> {
    const response = await fetch(
      "http://localhost:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2:1b",
          format: "json",
          stream: false,

          prompt: `
    You are a careful social-media content strategist.

    Use ONLY the topics and categories supplied below.
    They describe patterns in the creator's existing content.
    They do NOT prove anything about movie plots, characters,
    behind-the-scenes production, fan reactions, popularity,
    or audience demand.


    TOP PERFORMING REEL TITLES:
                ${input.topPerformingTitles.join(", ")}

    TOP PERFORMING TOPICS:
              ${input.topPerformingTopics.join(", ")}

    TOP PERFORMING CATEGORIES:
              ${input.topPerformingCategories.join(", ")}
              


    Generate exactly 3 distinct, practical Reel ideas.

    STRICT RULES:
    1. Use the supplied Reel titles as content references, not as proof
      of any specific plot, character, scene, or event.
    2. Never invent movie plot details, character descriptions,
      actors, dialogue, or scene events.
    3. If a title matches a known movie, do not rely on memory to
      describe its plot. Use a title-based idea that avoids
      unverified details.
    4. Keep each idea clearly connected to one supplied title.
    5. Avoid generic ideas unrelated to the supplied titles.
    6. Do not use placeholders or unsupported claims.
    7. Hooks and captions must not state unverified movie facts.
    8. Use relevant, concise hashtags and a natural CTA.
    9. The reason must explain why the idea is worth testing,
      without claiming audience demand or guaranteed performance.
    10. Return exactly 3 distinct ideas in the required JSON format.



    TITLE MATCHING RULES:
    - Treat each supplied Reel title as a separate content item.
    - Never transfer a plot, character, setting, or event from one
      title to another.
    - For example, never combine details from "Migration" with
      "Yodha" just because both titles appear in the input.
    - If a title alone does not establish a verified scene or plot,
      generate an idea about how to present or discuss that title,
      without inventing story details.
    - Keep every generated idea clearly tied to its own source title.
    - Do not claim the generated idea describes the uploaded video
      unless that information is explicitly provided.



    SOURCE ISOLATION:
    - Generate each idea for exactly ONE supplied Reel title.
    - Every idea must include a "sourceTitle" field matching one
      supplied title exactly.
    - Never combine characters, locations, plots, or hashtags from
      different titles.
    - Do not invent scene descriptions or character names.
    - Do not suggest "behind the scenes" unless the supplied data
      confirms that behind-the-scenes footage exists.
    - When plot details are unavailable, use a title-based discussion
      idea rather than describing a scene.
    - If you cannot create a grounded idea, use a general discussion
      format about the source title.
    - Never claim that an idea describes the uploaded footage unless
      that fact is supplied.


      FACTUAL ACCURACY CHECK — MANDATORY:

  Before returning an idea, verify every field against the supplied input.

  * The input contains content-performance patterns, not verified movie descriptions.
  * Never invent or assume a movie's plot, genre, characters, setting, events, or real-life inspiration.
  * Do not call an idea a documentary, true story, behind-the-scenes feature, or interview unless the input explicitly confirms it.
  * Do not introduce themes such as community identity, small-town life, friendship, courage, or sacrifice unless the supplied input supports them.
  * Keep the idea focused on discussing, presenting, or editing the supplied title when plot information is unavailable.
  * Use hashtags based only on the supplied title and explicitly supplied topics or categories.
  * Use a neutral, generic CTA such as "Follow for more" when a specific action is unsupported.
  * The reason must describe the idea's testable creative angle, not invent audience interest or expected results.
  * If a detail cannot be verified from the input, remove it rather than guessing.


    Return ONLY valid JSON in this exact structure:
    {
      "ideas": [
        {
          "sourceTitle": "Exact supplied Reel title",
          "title": "Idea title",
          "hook": "Opening hook",
          "caption": "Caption text",
          "hashtags": "#tag1 #tag2 #tag3",
          "cta": "Call to action",
          "reason": "Why this idea is worth testing"
        }
      ]
    }
    `,
        }),
      }
    );

    console.log("Ollama Reel ideas: request sent");

    console.log("Ollama Reel ideas: response status", response.status);



    if (!response.ok) {
      throw new Error(
        `Ollama Reel ideas failed: ${response.status}`
      );
    }



    const data: unknown = await response.json();

    console.log("Ollama Reel ideas: raw response", data);

    if (
      !data ||
      typeof data !== "object" ||
      !("response" in data) ||
      typeof data.response !== "string"
    ) {
      throw new Error("Invalid Ollama response format");
    }

    const parsed: { ideas?: unknown } = JSON.parse(data.response);
    console.log("Parsed Ollama ideas:", parsed.ideas);


    if (!Array.isArray(parsed.ideas)) {
      throw new Error("Invalid Reel ideas response");
    }


    const normalizeTitle = (title: string) =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .trim();


    const getShortTitle = (title: string) => {
      return title
        .split(/\s[–—]\s|\s\|\s/)[0]
        .trim()
        .split(/\s+is\s+/i)[0]
        .trim()
        .replace(/\s*\(\d{4}\)\s*$/, "")
        .replace(/\s*:\s*\d{4}\b.*$/, "")
        .trim();
    };



    const suppliedTitles = input.topPerformingTitles
      .map((title) => ({
        fullTitle: title.trim(),
        shortTitle: getShortTitle(title),
      }))
      .filter((item) => item.fullTitle.length > 0);

    console.log("Supplied Reel titles:", suppliedTitles);
    console.log(
      "AI source titles:",
      parsed.ideas.map((idea: { sourceTitle?: string }) => idea.sourceTitle)
    );


    const normalizeText = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const containsUnrelatedDuckTerms = (value: string) =>
      /\b(duck|duckling|pond|jamaica|flock|migrantoons)\b/i.test(value);

    const hasPlaceholderLink = (value: string) =>
      /\[(?:link|url|website)\]|example\.com/i.test(value);


    const validIdeas: ReelIdea[] = [];
    const usedTitles = new Set<string>();

    for (const idea of parsed.ideas as unknown[]) {
      if (!idea || typeof idea !== "object") continue;

      const item = idea as Partial<ReelIdea>;

      if (
        typeof item.sourceTitle !== "string" ||
        typeof item.title !== "string" ||
        typeof item.hook !== "string" ||
        typeof item.caption !== "string" ||
        typeof item.hashtags !== "string" ||
        typeof item.cta !== "string" ||
        typeof item.reason !== "string"
      ) {
        continue;
      }

      const aiTitle = normalizeTitle(item.sourceTitle);


      const match = suppliedTitles.find(({ fullTitle, shortTitle }) => {
        const normalizedFull = normalizeTitle(fullTitle);
        const normalizedShort = normalizeTitle(shortTitle);

        // Exact match first
        if (
          aiTitle === normalizedFull ||
          aiTitle === normalizedShort
        ) {
          return true;
        }

        // Ollama may return multiple titles in one sourceTitle.
        // Match if the AI title begins with a supplied title.
        return (
          aiTitle.startsWith(normalizedShort) &&
          normalizedShort.length >= 4
        );
      });



      if (!match) {
        console.warn("Rejected unknown source title:", item.sourceTitle);
        continue;
      }


      const combinedText = [
        item.title,
        item.hook,
        item.caption,
        item.hashtags,
        item.cta,
        item.reason,
      ].join(" ");

      const sourceText = normalizeText(match.fullTitle);
      const generatedText = normalizeText(combinedText);

      // Reject placeholder links.
      if (hasPlaceholderLink(combinedText)) {
        console.warn("Rejected placeholder link:", item.title);
        continue;
      }

      // Avoid ideas that repeat a source already used.
      const sourceKey = normalizeText(match.fullTitle);

      if (usedTitles.has(sourceKey)) {
        console.warn("Rejected duplicate source:", match.fullTitle);
        continue;
      }

      // If the source is not about ducks, reject Migration-related duck content.
      const isMigrationSource =
        /\bmigration\b/i.test(match.fullTitle);

      if (!isMigrationSource && containsUnrelatedDuckTerms(generatedText)) {
        console.warn("Rejected unrelated duck content:", match.fullTitle);
        continue;
      }


      const hasUnsafeClaim =
        /\b(lesser[- ]known|box office|watch the (full )?movie|watch the trailer|read more|latest updates|[[]link[]]|example\.com)\b/i.test(
          combinedText
        );

      if (hasUnsafeClaim) {
        console.warn("Rejected unsupported claim:", item.title);
        continue;
      }



      validIdeas.push({
        sourceTitle: match.fullTitle,
        title: item.title.trim(),
        hook: item.hook.trim(),
        caption: item.caption.trim(),
        hashtags: item.hashtags.trim(),
        cta: item.cta.trim(),
        reason: item.reason.trim(),
      });

      usedTitles.add(sourceKey);



      if (validIdeas.length === 3) break;
    }

    console.log("Valid Ollama ideas:", validIdeas);

    return validIdeas;


  }


  // ====================================================
  // TEXT-BASED ANALYSIS
  // ====================================================

  async analyzeText(
    input: {
      title?: string;
      description?: string | null;
      manualText?: string;
    }
  ): Promise<AIAnalysisResult> {
    const title = input.title?.trim() || "";
    const description = input.description?.trim() || "";
    const manualText = input.manualText?.trim() || "";

    if (!title && !description && !manualText) {
      throw new Error(
        "Please provide manual text, a title, or a description."
      );
    }

    const sourceText = [
      title ? `CONTENT TITLE:\n${title}` : "",
      description
        ? `CONTENT DESCRIPTION:\n${description}`
        : "",
      manualText
        ? `USER-PROVIDED TEXT:\n${manualText}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");


    const prompt = `
You are a movie reviewer and Instagram content writer.

MOVIE INFORMATION:
${sourceText}

Generate the following JSON fields:

{
  "category": "Movie category",
  "tone": "Review tone",
  "topic": "Movie title",
  "audience_cues": "Suitable audience",
  "caption_1": "Complete movie review with rating line",
  "caption_2": "Not used",
  "caption_3": "Not used",
  "hashtags": "#MovieName #MovieReview #Cinema",
  "cta": "Follow for more movie content",
  "platform_fit": "Instagram Reels",
  "confidence": 80
}

RULES:

1. Write caption_1 as a short, engaging movie review of approximately
   60-90 words, including the movie title and release year when known.

2. Include the movie's story, important plot details, actors,
   performances, strengths, weaknesses, and overall verdict where relevant.

3. Spoilers are allowed. Actor names and plot details may be revealed.

4. Do not invent an IMDb rating. Use an IMDb rating only when its
   value is provided in the input or verified information available
   to you. Otherwise use exactly:
   Rating: Not verified

5. End caption_1 with a blank line followed by the rating line.
   Example:
   Rating: ⭐⭐⭐☆☆ (3/5)

6. Convert a verified IMDb score out of 10 into a five-star rating
   by dividing by 2 and rounding to the nearest half-star.
   Show the stars and score out of 5.

7. Generate 3-5 relevant hashtags using the movie title and its content.

8. CTA RULES: 
- Generate a natural CTA relevant to the movie review. 
- Vary the CTA between generations. - Do not always use "Follow for more movie content". 
- Choose from suitable styles, such as: - "Would you watch this movie? Tell us below!" 
- "Have you seen it? Share your review!" - "Rate this movie out of 5 in the comments!" 
- "Which performance stood out to you?" - "Save this review for your next movie night." 
- "Follow for more honest movie reviews." - You may create other natural CTAs relevant to the movie. 
- Avoid claiming that the audience has already reacted.

9. CONFIDENCE RULES: 
- Return a number from 0 to 100. 
- Base confidence on the quality, completeness, and consistency of the information provided. 
- Higher confidence requires sufficient supporting information. 
- Lower confidence when the input contains only a title or very few verified details. 
- Do not assign 80 by default. - Do not treat a fluent or detailed review as proof that its facts are correct. 
- Do not claim external verification unless it actually occurred.

10. caption_2 and caption_3 are not needed. Return empty strings for both.

11. Keep the review readable, natural, and ready to publish on Instagram.

12. Return valid JSON only. Do not include Markdown fences or explanations.

TEXT INPUT:
"""
${sourceText}
"""
`.trim();

    const baseUrl = (
      process.env.OLLAMA_BASE_URL ||
      "http://127.0.0.1:11434"
    ).replace(/\/+$/, "");

    const response = await fetch(
      `${baseUrl}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2:1b",
          format: "json",
          stream: false,
          prompt,
          options: {
            temperature: 0.2,
          },
        }),
        signal: AbortSignal.timeout(120000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Ollama text analysis failed (${response.status}): ${errorText}`
      );
    }

    const data: {
      response?: string;
    } = await response.json();

    if (
      typeof data.response !== "string" ||
      !data.response.trim()
    ) {
      throw new Error(
        "Ollama returned an empty analysis response."
      );
    }

    let result: Partial<AIAnalysisResult>;

    try {
      result = JSON.parse(data.response);
    } catch {
      throw new Error(
        "Ollama returned invalid JSON for text analysis."
      );
    }

    console.log("Ollama text analysis completed.");

    return validateResult(result);
  }

  // ====================================================
  // LEGACY TRANSCRIPT METHOD
  // Temporary compatibility until the API route is updated.
  // ====================================================

  async analyzeTranscript(
    transcript: string
  ): Promise<AIAnalysisResult> {
    return this.analyzeText({
      manualText: transcript,
    });
  }

  // ====================================================
  // LEGACY MULTIMODAL METHOD
  // Temporary compatibility until existing callers are updated.
  // ====================================================

  async analyzeMultimodalContent(
    input: {
      title: string;
      transcript: string;
      visualSummary: string;
    }
  ): Promise<AIAnalysisResult> {
    return this.analyzeText({
      title: input.title,
      manualText: [
        input.visualSummary
          ? `Provided content context:\n${input.visualSummary}`
          : "",
        input.transcript
          ? `Additional supplied text:\n${input.transcript}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }

  // ====================================================
  // TITLE + DESCRIPTION + MANUAL TEXT ANALYSIS
  // ====================================================

  async analyzeContent(
    input: {
      title: string;
      description?: string | null;
      manualText?: string;
    }
  ): Promise<AIAnalysisResult> {
    return this.analyzeText({
      title: input.title,
      description: input.description,
      manualText: input.manualText,
    });
  }

  // ====================================================
  // CONTENT REPURPOSING
  // ====================================================

  async repurposeContent(
    input: {
      contentId: string;
      title: string;
      description?: string | null;
      platform: RepurposePlatform;
    }
  ): Promise<RepurposedContent> {
    const platformName =
      input.platform === "instagram_reels"
        ? "Instagram Reels"
        : "YouTube Shorts";

    const prompt = `
You are a professional short-form video content strategist.

Create one ${platformName} content package for the following existing video.

Original title: ${input.title}
Original description: ${input.description || "Not provided"}

Rules:
- Stay faithful to the original title and description.
- Never invent events, facts, people, quotes, or claims.
- Make the hook engaging and concise.
- Make the caption relevant to the source content.
- Provide relevant hashtags.
- Include a natural call to action.
- Return valid JSON only.
- Do not use Markdown fences.

Return exactly this JSON structure:
{
  "title": "Short platform-appropriate title",
  "hook": "Opening hook",
  "caption": "Platform-appropriate caption",
  "hashtags": "#relevant #hashtags",
  "cta": "Call to action",
  "reason": "Brief explanation of the platform fit"
}

Platform-specific guidance:
${input.platform === "instagram_reels"
        ? "- Prioritize a short, engaging hook and conversational caption.\n- Use relevant Instagram Reels hashtags."
        : "- Prioritize a clear, searchable title and a strong opening hook.\n- Use relevant YouTube Shorts hashtags."
      }
`;

    const response = await fetch(
      "http://localhost:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2:1b",
          format: "json",
          stream: false,
          prompt,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ollama repurposing failed: ${response.status}`
      );
    }

    const data = await response.json();

    let result: {
      title?: string;
      hook?: string;
      caption?: string;
      hashtags?: string;
      cta?: string;
      reason?: string;
    };

    try {
      result = JSON.parse(data.response);
    } catch {
      throw new Error(
        "Ollama returned invalid JSON for repurposing."
      );
    }

    const requiredFields = [
      result.title,
      result.hook,
      result.caption,
      result.hashtags,
      result.cta,
      result.reason,
    ];

    if (
      requiredFields.some(
        (value) =>
          typeof value !== "string" ||
          value.trim().length === 0
      )
    ) {
      throw new Error(
        "Ollama returned incomplete repurposed content."
      );
    }

    return {
      contentId: input.contentId,
      platform: input.platform,
      title: result.title!.trim(),
      hook: result.hook!.trim(),
      caption: result.caption!.trim(),
      hashtags: result.hashtags!.trim(),
      cta: result.cta!.trim(),
      reason: result.reason!.trim(),
    };
  }
}

