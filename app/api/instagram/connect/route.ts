
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(
            new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
        );
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!appId || !redirectUri) {
        return NextResponse.json(
            { error: "Instagram OAuth environment variables are missing." },
            { status: 500 }
        );
    }

    const state = randomUUID();


    const authorizeUrl = new URL(
        "https://www.instagram.com/oauth/authorize"
    );

    authorizeUrl.searchParams.set("force_reauth", "true");
    authorizeUrl.searchParams.set("client_id", appId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set(
        "scope",
        [
            "instagram_business_basic",
            "instagram_business_manage_messages",
            "instagram_business_manage_comments",
            "instagram_business_content_publish",
        ].join(",")
    );
    authorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authorizeUrl);

    response.cookies.set("instagram_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
    });

    return response;


}

