
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    if (!appId || !redirectUri) {
        return NextResponse.json(
            { error: "Facebook OAuth configuration is missing." },
            { status: 500 }
        );
    }

    const state = randomBytes(32).toString("hex");

    const url = new URL("https://www.facebook.com/v26.0/dialog/oauth");

    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("config_id", "1447694617300963");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("override_default_response_type", "true");
    url.searchParams.set("state", state);

    const response = NextResponse.redirect(url);

    response.cookies.set("facebook_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
    });

    return response;
}
