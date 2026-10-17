
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
        `https://graph.instagram.com/${connection.instagram_user_id}/media`
      );

      url.searchParams.set(
        "fields",
        "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count"
      );
      url.searchParams.set("limit", "10");
      url.searchParams.set("access_token", connection.access_token);

      const response = await fetch(url.toString(), {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Instagram media API error:", {
          status: response.status,
          error: result.error?.message,
        });

        return NextResponse.json(
          {
            success: false,
            error:
              result.error?.message ??
              "Could not fetch Instagram media",
          },
          { status: response.status }
        );
      }

      return NextResponse.json({
        success: true,
        username: connection.username,
        media: result.data ?? [],
        nextPageAvailable: Boolean(result.paging?.next),
      });
    } catch (error) {
      console.error("Instagram media request failed:", error);

      return NextResponse.json(
        { success: false, error: "Instagram request failed" },
        { status: 500 }
      );
    }
  }

