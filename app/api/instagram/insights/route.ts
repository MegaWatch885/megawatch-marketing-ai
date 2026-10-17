
import { NextResponse } from "next/server";
import { getAuthenticatedInstagramConnection } from "@/lib/instagram/get-authenticated-connection";

export async function GET() {
  const { connection, error, status } =
    await getAuthenticatedInstagramConnection();

  if (!connection) {
    return NextResponse.json(
      { success: false, error },
      { status }
    );
  }

  try {
    const url = new URL(
      `https://graph.instagram.com/${connection.instagram_user_id}/insights`
    );

    url.searchParams.set("metric", "reach,views");
    url.searchParams.set("period", "day");
    url.searchParams.set("access_token", connection.access_token);

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Instagram Insights API error:", {
        status: response.status,
        error: data.error?.message,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            data.error?.message ?? "Insights request failed",
          details: data.error?.code ?? null,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      username: connection.username,
      insights: data.data ?? [],
    });
  } catch (error) {
    console.error("Insights connection request failed:", error);

    return NextResponse.json(
      { success: false, error: "Could not fetch Instagram insights" },
      { status: 500 }
    );
  }
}

