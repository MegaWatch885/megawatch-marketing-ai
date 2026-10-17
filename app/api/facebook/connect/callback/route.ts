
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const GRAPH_VERSION = "v26.0";
const EXPECTED_PAGE_ID = "1347260108473147";

function dashboardRedirect(request: NextRequest, status: string) {
  const url = new URL(
    "/dashboard",
    process.env.FACEBOOK_REDIRECT_URI!
  );

  url.searchParams.set("facebook", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  const cookieState = request.cookies.get("facebook_oauth_state")?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set("facebook_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  if (authError || !user) {
    return clearStateCookie(
      NextResponse.redirect(new URL("/login", request.url))
    );
  }

  if (!cookieState || !returnedState || cookieState !== returnedState) {
    return clearStateCookie(dashboardRedirect(request, "state_error"));
  }

  if (oauthError || !code) {
    return clearStateCookie(dashboardRedirect(request, "cancelled"));
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    console.error("Facebook OAuth server configuration is missing.");
    return clearStateCookie(dashboardRedirect(request, "config_error"));
  }

  try {
    // Exchange the authorization code on the server.
    const tokenUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`
    );

    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });
    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Facebook authorization-code exchange failed.");
      return clearStateCookie(dashboardRedirect(request, "token_error"));
    }

    const userAccessToken = tokenData.access_token as string;

    // Retrieve Pages the authorizing user can access.
    const pagesUrl = new URL(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`
    );

    pagesUrl.searchParams.set(
      "fields",
      "id,name,access_token,tasks"
    );
    pagesUrl.searchParams.set("limit", "100");

    const pagesResponse = await fetch(pagesUrl, {
      headers: {
        Authorization: `Bearer ${userAccessToken}`,
      },
      cache: "no-store",
    });

    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok || !Array.isArray(pagesData.data)) {
      console.error("Facebook Page lookup failed.");
      return clearStateCookie(dashboardRedirect(request, "pages_error"));
    }

    const page = pagesData.data.find(
      (item: {
        id?: string;
        name?: string;
        access_token?: string;
        tasks?: string[];
      }) => item.id === EXPECTED_PAGE_ID
    );

    if (!page?.access_token || !page.name) {
      return clearStateCookie(
        dashboardRedirect(request, "page_not_found")
      );
    }

    const tasks: string[] = Array.isArray(page.tasks) ? page.tasks : [];
    const canPublish = tasks.includes("CREATE_CONTENT");

    if (!canPublish) {
      return clearStateCookie(
        dashboardRedirect(request, "missing_page_permission")
      );
    }

    // Store the Page token server-side. Never return it to the browser.
    const { error: saveError } = await supabaseAdmin
      .from("facebook_connections")
      .upsert(
        {
          user_id: user.id,
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
          token_expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,page_id" }
      );

    if (saveError) {
      console.error("Saving Facebook connection failed.");
      return clearStateCookie(dashboardRedirect(request, "save_error"));
    }

    return clearStateCookie(dashboardRedirect(request, "connected"));
  } catch {
    console.error("Facebook OAuth callback failed unexpectedly.");
    return clearStateCookie(dashboardRedirect(request, "unexpected_error"));
  }
}
