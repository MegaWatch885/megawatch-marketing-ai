
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ contentId: string }>;
  }
) {
  try {
    const { contentId } = await context.params;

    if (!UUID_REGEX.test(contentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid content ID." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      );
    }

    // RLS ensures the user can access only their own content.
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id")
      .eq("id", contentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (contentError) {
      console.error(
        "Content ownership check failed:",
        contentError.message
      );

      return NextResponse.json(
        { success: false, error: "Could not verify content access." },
        { status: 500 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { success: false, error: "Content not found." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("content_repurposes")
      .select(
        "id, content_id, platform, title, hook, caption, hashtags, cta, reason, created_at"
      )
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("Repurposing history error:", error.message);

      return NextResponse.json(
        {
          success: false,
          error: "Could not load repurposing history.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content: data ?? [],
    });
  } catch (error) {
    console.error("Repurposing history API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not load repurposing history.",
      },
      { status: 500 }
    );
  }
}

