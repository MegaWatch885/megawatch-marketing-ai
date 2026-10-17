
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const GRAPH_VERSION = "v26.0";
const EXPECTED_PAGE_ID = "1347260108473147";

type FacebookPageResponse = {
  id?: string;
  name?: string;
  error?: {
    message?: string;
    code?: number;
  };
};

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { connected: false, error: "Please log in first." },
        { status: 401 }
      );
    }

    const { data: connection, error: connectionError } =
      await supabaseAdmin
        .from("facebook_connections")
        .select("page_id, page_name, access_token")
        .eq("user_id", user.id)
        .eq("page_id", EXPECTED_PAGE_ID)
        .maybeSingle();

    if (connectionError) {
      console.error(
        "Facebook connection lookup failed:",
        connectionError.message
      );

      return NextResponse.json(
        { connected: false, error: "Could not read Facebook connection." },
        { status: 500 }
      );
    }

    if (!connection?.access_token) {
      return NextResponse.json({
        connected: false,
        pageName: null,
        message: "Facebook Page is not connected.",
      });
    }

    const url = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/${EXPECTED_PAGE_ID}`
    );

    url.searchParams.set("fields", "id,name");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
      cache: "no-store",
    });

    const pageData =
      (await response.json().catch(() => ({}))) as FacebookPageResponse;

    if (
      !response.ok ||
      pageData.id !== EXPECTED_PAGE_ID ||
      !pageData.name
    ) {
      console.error(
        "Facebook live connection check failed:",
        pageData.error?.message ?? "Unexpected Page response"
      );

      return NextResponse.json({
        connected: false,
        pageName: connection.page_name,
        message:
          "Saved connection exists, but Facebook could not verify it. Reconnect may be needed.",
      });
    }

    return NextResponse.json({
      connected: true,
      pageId: pageData.id,
      pageName: pageData.name,
      message: "Facebook Page connection verified.",
    });
  } catch (error) {
    console.error(
      "Facebook connection status error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      {
        connected: false,
        error: "Unexpected error while checking Facebook connection.",
      },
      { status: 500 }
    );
  }
}
