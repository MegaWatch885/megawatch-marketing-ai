
import { NextResponse } from "next/server";
import { getAuthenticatedInstagramConnection } from "@/lib/instagram/get-authenticated-connection";

type InstagramMedia = {
  id: string;
};

type InstagramMediaResponse = {
  data?: InstagramMedia[];
  paging?: {
    cursors?: {
      after?: string;
    };
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

export async function GET(request: Request) {
  const { connection, error, status } =
    await getAuthenticatedInstagramConnection();

  if (!connection) {
    return NextResponse.json(
      { success: false, error },
      { status }
    );
  }

  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get("mediaId")?.trim();

  if (!mediaId || !/^\d+$/.test(mediaId)) {
    return NextResponse.json(
      { success: false, error: "Please provide a valid mediaId" },
      { status: 400 }
    );
  }

  try {
    // Verify the media against the connected account's own media list.
    // Limit pagination to avoid unbounded requests.
    let after: string | undefined;
    let belongsToAccount = false;

    for (let page = 0; page < 10; page++) {
      const mediaUrl = new URL(
        `https://graph.instagram.com/${connection.instagram_user_id}/media`
      );

      mediaUrl.searchParams.set("fields", "id");
      mediaUrl.searchParams.set("limit", "100");
      mediaUrl.searchParams.set(
        "access_token",
        connection.access_token
      );

      if (after) {
        mediaUrl.searchParams.set("after", after);
      }

      const mediaResponse = await fetch(mediaUrl.toString(), {
        cache: "no-store",
      });

      const mediaResult =
        (await mediaResponse.json()) as InstagramMediaResponse;

      if (!mediaResponse.ok) {
        console.error("Instagram media verification failed:", {
          status: mediaResponse.status,
          error: mediaResult.error?.message,
        });

        return NextResponse.json(
          {
            success: false,
            error:
              mediaResult.error?.message ??
              "Could not verify Instagram media ownership",
          },
          { status: mediaResponse.status }
        );
      }

      if (
        (mediaResult.data ?? []).some(
          (media) => media.id === mediaId
        )
      ) {
        belongsToAccount = true;
        break;
      }

      after = mediaResult.paging?.cursors?.after;

      if (!after || (mediaResult.data ?? []).length === 0) {
        break;
      }
    }

    if (!belongsToAccount) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Media was not found in your connected Instagram account.",
        },
        { status: 403 }
      );
    }

    // Fetch insights only after ownership has been verified.
    const insightsUrl = new URL(
      `https://graph.instagram.com/${mediaId}/insights`
    );

    insightsUrl.searchParams.set(
      "metric",
      "views,reach,likes,comments,saved,shares"
    );
    insightsUrl.searchParams.set(
      "access_token",
      connection.access_token
    );

    const response = await fetch(insightsUrl.toString(), {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Instagram media insights error:", {
        status: response.status,
        error: result.error?.message,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            result.error?.message ??
            "Could not fetch Reel insights",
          details: result.error?.type
            ? {
                type: result.error.type,
                code: result.error.code,
              }
            : undefined,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      mediaId,
      insights: result.data ?? [],
    });
  } catch (error) {
    console.error("Instagram insights request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Instagram request failed",
      },
      { status: 500 }
    );
  }
}

