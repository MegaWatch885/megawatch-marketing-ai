
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type TokenResponse = {
    access_token?: string;
    user_id?: string | number;
    expires_in?: number;
    error_message?: string;
    error?: { message?: string };
};

type InstagramProfile = {
    user_id?: string | number;
    id?: string | number;
    username?: string;
};


function dashboardRedirect(request: NextRequest, status: string) {
    const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000";

    const url = new URL("/dashboard", appUrl);
    url.searchParams.set("instagram", status);

    return NextResponse.redirect(url);
}



export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const stateCookie = request.cookies.get("instagram_oauth_state")?.value;
    const params = request.nextUrl.searchParams;
    const returnedState = params.get("state");
    const code = params.get("code");

    const clearStateCookie = (response: NextResponse) => {
        response.cookies.set("instagram_oauth_state", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 0,
        });
        return response;
    };

    if (!user) {
        return clearStateCookie(
            NextResponse.redirect(new URL("/login", request.url))
        );
    }

    if (!stateCookie || !returnedState || stateCookie !== returnedState) {
        return clearStateCookie(dashboardRedirect(request, "state_error"));
    }

    if (params.get("error") || !code) {
        return clearStateCookie(dashboardRedirect(request, "cancelled"));
    }

    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

    if (!appId || !appSecret || !redirectUri) {
        console.error("Instagram OAuth configuration is incomplete.");
        return clearStateCookie(dashboardRedirect(request, "config_error"));
    }

    try {
        // 1. Exchange the authorization code for a short-lived token.
        const form = new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
        });

        const shortResponse = await fetch(
            "https://api.instagram.com/oauth/access_token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: form.toString(),
                cache: "no-store",
            }
        );

        const shortToken =
            (await shortResponse.json()) as TokenResponse;

        if (!shortResponse.ok || !shortToken.access_token) {
            console.error("Instagram short-lived token exchange failed.");
            return clearStateCookie(
                dashboardRedirect(request, "token_error")
            );
        }

        // 2. Exchange it for a long-lived token.
        const longUrl = new URL(
            "https://graph.instagram.com/access_token"
        );
        longUrl.searchParams.set("grant_type", "ig_exchange_token");
        longUrl.searchParams.set("client_secret", appSecret);
        longUrl.searchParams.set("access_token", shortToken.access_token);

        const longResponse = await fetch(longUrl, {
            cache: "no-store",
        });

        const longToken = (await longResponse.json()) as TokenResponse;

        if (!longResponse.ok || !longToken.access_token) {
            console.error("Instagram long-lived token exchange failed.");
            return clearStateCookie(
                dashboardRedirect(request, "token_error")
            );
        }

        // 3. Fetch the connected Instagram profile.
        const profileUrl = new URL("https://graph.instagram.com/me");
        profileUrl.searchParams.set("fields", "user_id,username");
        profileUrl.searchParams.set(
            "access_token",
            longToken.access_token
        );

        const profileResponse = await fetch(profileUrl, {
            cache: "no-store",
        });

        const profile =
            (await profileResponse.json()) as InstagramProfile;

        if (!profileResponse.ok) {
            console.error("Instagram profile lookup failed.");
            return clearStateCookie(
                dashboardRedirect(request, "profile_error")
            );
        }

        const instagramUserId =
            profile.user_id ?? profile.id ?? shortToken.user_id;

        if (!instagramUserId) {
            console.error("Instagram profile did not return a user ID.");
            return clearStateCookie(
                dashboardRedirect(request, "profile_error")
            );
        }

        // 4. Save the token only through the server-side admin client.
        const expiresIn = Number(longToken.expires_in ?? 0);
        const tokenExpiresAt =
            expiresIn > 0
                ? new Date(Date.now() + expiresIn * 1000).toISOString()
                : null;

        const { error: saveError } = await supabaseAdmin
            .from("instagram_connections")
            .upsert(
                {
                    user_id: user.id,
                    instagram_user_id: String(instagramUserId),
                    username: profile.username ?? null,
                    access_token: longToken.access_token,
                    token_expires_at: tokenExpiresAt,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
            );

        if (saveError) {
            console.error(
                "Instagram connection could not be saved:",
                saveError.message
            );
            return clearStateCookie(
                dashboardRedirect(request, "save_error")
            );
        }

        return clearStateCookie(
            dashboardRedirect(request, "connected")
        );
    } catch (error) {
        console.error(
            "Instagram OAuth callback failed:",
            error instanceof Error ? error.message : "Unknown error"
        );

        return clearStateCookie(
            dashboardRedirect(request, "connection_error")
        );
    }
}

