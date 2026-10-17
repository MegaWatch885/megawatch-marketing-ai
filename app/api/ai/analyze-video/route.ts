
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OllamaAIProvider } from "@/services/ai/ollama-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    // 2. Read request
    let body: {
      contentId?: string;
      manualText?: string;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const contentId =
      typeof body.contentId === "string"
        ? body.contentId.trim()
        : "";

    const manualText =
      typeof body.manualText === "string"
        ? body.manualText.trim()
        : "";

    if (!contentId) {
      return NextResponse.json(
        {
          success: false,
          error: "contentId is required.",
        },
        { status: 400 }
      );
    }

    if (manualText.length > 20000) {
      return NextResponse.json(
        {
          success: false,
          error: "Manual text must be 20,000 characters or fewer.",
        },
        { status: 400 }
      );
    }

    // 3. Load only this user's content
    const {
      data: content,
      error: contentError,
    } = await supabase
      .from("content")
      .select("id, title, description")
      .eq("id", contentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (contentError) {
      console.error(
        "Content lookup failed:",
        contentError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "Could not load content.",
        },
        { status: 500 }
      );
    }

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: "Content not found.",
        },
        { status: 404 }
      );
    }

    const title = content.title || "";
    const description =
      typeof content.description === "string"
        ? content.description
        : "";

    if (
      !title.trim() &&
      !description.trim() &&
      !manualText
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a content title, description, or manual text.",
        },
        { status: 400 }
      );
    }

    console.log("TEXT-BASED AI ANALYSIS STARTED");
    console.log("Content ID:", contentId);

    // 4. Analyze text using local Ollama
    const provider = new OllamaAIProvider();

    const analysis = await provider.analyzeContent({
      title,
      description,
      manualText,
    });

    console.log("TEXT-BASED AI ANALYSIS COMPLETED");

    // 5. Save analysis to existing table
    const {
      data,
      error: saveError,
    } = await supabase
      .from("content_ai")
      .upsert(
        {
          content_id: contentId,
          category: analysis.category,
          tone: analysis.tone,
          topic: analysis.topic,
          audience_cues: analysis.audience_cues,
          caption_1: analysis.caption_1,
          caption_2: analysis.caption_2,
          caption_3: analysis.caption_3,
          hashtags: analysis.hashtags,
          cta: analysis.cta,
          platform_fit: analysis.platform_fit,
          confidence: analysis.confidence,
        },
        {
          onConflict: "content_id",
        }
      )
      .select()
      .single();

    if (saveError) {
      console.error(
        "Saving AI analysis failed:",
        saveError.message
      );

      return NextResponse.json(
        {
          success: false,
          error: "AI analysis was generated but could not be saved.",
        },
        { status: 500 }
      );
    }

    // 6. Return result
    return NextResponse.json({
      success: true,
      contentId,
      title,
      analysis: data,
    });
  } catch (error) {
    console.error("TEXT-BASED AI ANALYSIS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Text-based AI analysis failed.",
      },
      { status: 500 }
    );
  }
}

