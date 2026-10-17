
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Verify the logged-in Supabase user
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    // 2. Read the Page connection details
    const body = await request.json();

    const pageId =
      typeof body.pageId === "string" ? body.pageId.trim() : "";

    const pageName =
      typeof body.pageName === "string" ? body.pageName.trim() : "";

    const accessToken =
      typeof body.accessToken === "string"
        ? body.accessToken.trim()
        : "";

    if (
      !pageId ||
      !pageName ||
      !accessToken ||
      pageId.length > 100 ||
      pageName.length > 200 ||
      accessToken.length > 10000
    ) {
      return NextResponse.json(
        { error: "Invalid Facebook Page details." },
        { status: 400 }
      );
    }

    // 3. Verify the token belongs to the supplied Page.
    // Never return or log the token.
    const graphResponse = await fetch(
      `https://graph.facebook.com/v26.0/${encodeURIComponent(pageId)}?fields=id,name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    );

    const graphData = await graphResponse.json();

    if (
      !graphResponse.ok ||
      graphData.id !== pageId ||
      graphData.name !== pageName
    ) {
      return NextResponse.json(
        { error: "Facebook Page token verification failed." },
        { status: 400 }
      );
    }

    // 4. Save the connection under the authenticated user.
    const { error: saveError } = await supabaseAdmin
      .from("facebook_connections")
      .upsert(
        {
          user_id: user.id,
          page_id: pageId,
          page_name: pageName,
          access_token: accessToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,page_id" }
      );

    if (saveError) {
      console.error(
        "Facebook connection save failed:",
        saveError.message
      );

      return NextResponse.json(
        { error: "Could not save Facebook connection." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Facebook connection request failed." },
      { status: 500 }
    );
  }
}
