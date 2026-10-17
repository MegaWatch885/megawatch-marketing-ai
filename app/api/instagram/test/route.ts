
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
      `https://graph.instagram.com/${connection.instagram_user_id}`
    );

    url.searchParams.set(
      "fields",
      "id,user_id,username,account_type"
    );
    url.searchParams.set("access_token", connection.access_token);

    const response = await fetch(url.toString(), {
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Instagram API error:", {
        status: response.status,
        error: data.error?.message,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            data.error?.message ??
            "Instagram API request failed",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      account: data,
    });
  } catch (error) {
    console.error("Instagram connection request failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not connect to Instagram API",
      },
      { status: 500 }
    );
  }
}

