import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { OllamaAIProvider } from "@/services/ai/ollama-provider";

import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const transcript = body.transcript;

    if (!transcript) {
      return NextResponse.json(
        {
          success: false,
          error: "transcript is required",
        },
        { status: 400 }
      );
    }

    console.log(
      "🧠 TRANSCRIPT ANALYSIS REQUEST:"
    );

    console.log(transcript);

    const provider = new OllamaAIProvider();

    const result =
      await provider.analyzeTranscript(
        transcript
      );

    console.log(
      "🧠 AI ANALYSIS RESULT:",
      result
    );

    return NextResponse.json({
      success: true,
      analysis: result,
    });
  } catch (error) {
    console.error(
      "❌ TRANSCRIPT ANALYSIS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Transcript analysis failed",
      },
      { status: 500 }
    );
  }
}