
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Please log in first." },
                { status: 401 }
            );
        }


        const { searchParams } = new URL(request.url);
        const contentId = searchParams.get("contentId");

        let query = supabaseAdmin
            .from("platform_publications")
            .select(
                "content_id, platform, status, error_message, published_at, platform_media_id, platform_video_id"
            )
            .eq("user_id", user.id);

        if (contentId) {
            query = query.eq("content_id", contentId);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Publication status query failed:", error.message);
            return NextResponse.json(
                { error: "Could not load publication status." },
                { status: 500 }
            );
        }

        return NextResponse.json({ publications: data ?? [] });

    } catch (error) {
        console.error("Publication status API failed:", error);
        return NextResponse.json(
            { error: "Unexpected server error." },
            { status: 500 }
        );
    }
}
