
import { supabase } from "@/lib/supabase/client";

export async function getRepurposedContent(contentId: string) {
    console.log("[Repurpose] Loading content ID:", contentId);

    console.log("[Repurpose] Querying table for:", contentId);

    const { data, error } = await supabase
        .from("content_repurposes")
        .select("*")
        .eq("content_id", contentId)
        .order("created_at", { ascending: false });

    console.log("[Repurpose] HTTP status:", status);
    console.log("[Repurpose] Query error:", error);
    console.log("[Repurpose] Result:", data);

    if (error) {
        console.error("[Repurpose] Supabase fetch failed:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });

        throw error;
    }

    console.log("[Repurpose] Rows fetched:", data?.length ?? 0);

    return data ?? [];
}



