
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v26.0";
const PAGE_ID = "1347260108473147";

export async function POST(request: Request) {
  // Verify the signed-in MegaWatch user.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 }
    );
  }

  // Accept only a text message from the request.
  let body: { message?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  if (!message || message.length > 5000) {
    return NextResponse.json(
      { error: "Enter a message between 1 and 5000 characters." },
      { status: 400 }
    );
  }

  // Retrieve the Page token only on the server.
  const { data: connection, error: dbError } = await supabaseAdmin
    .from("facebook_connections")
    .select("page_id, page_name, access_token")
    .eq("user_id", user.id)
    .eq("page_id", PAGE_ID)
    .maybeSingle();

  if (dbError || !connection?.access_token) {
    return NextResponse.json(
      { error: "Facebook Page is not connected. Reconnect it first." },
      { status: 404 }
    );
  }

  const form = new URLSearchParams();
  form.set("message", message);
  form.set("access_token", connection.access_token);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/feed`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok || !result.id) {
      // Do not log or return the Page access token.
      console.error("Facebook text post failed:", {
        status: response.status,
        error: result.error
          ? {
              message: result.error.message,
              code: result.error.code,
              subcode: result.error.error_subcode,
            }
          : "Unknown Graph API error",
      });

      return NextResponse.json(
        {
          error:
            result.error?.message ??
            "Facebook could not publish the post.",
          code: result.error?.code ?? null,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      pageName: connection.page_name,
      postId: result.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Facebook. Try again." },
      { status: 502 }
    );
  }
}
