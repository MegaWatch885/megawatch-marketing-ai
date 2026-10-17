
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publishScheduledReel } from "@/lib/instagram/publish-scheduled-reel";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.LOCAL_SCHEDULER_SECRET;

    if (!secret) {
      return NextResponse.json(
        { success: false, error: "Scheduler is not configured." },
        { status: 500 }
      );
    }

    if (
      request.headers.get("authorization") !== `Bearer ${secret}`
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const staleBefore = new Date(
      now.getTime() - CLAIM_TIMEOUT_MS
    ).toISOString();

    const { data: dueItems, error: queryError } = await supabaseAdmin
      .from("content")
      .select(
        "id, user_id, title, description, status, scheduled_for, storage_key, instagram_container_id, publishing_started_at"
      )
      .eq("status", "scheduled")
      .not("scheduled_for", "is", null)
      .lte("scheduled_for", nowIso)
      .or(
        `publishing_started_at.is.null,publishing_started_at.lt.${staleBefore}`
      )
      .order("scheduled_for", { ascending: true })
      .limit(10);

    if (queryError) {
      console.error("Due-content query failed:", queryError.message);

      return NextResponse.json(
        { success: false, error: "Could not load scheduled content." },
        { status: 500 }
      );
    }

    if (!dueItems?.length) {
      return NextResponse.json({
        success: true,
        checkedAt: nowIso,
        dueCount: 0,
        message: "No eligible scheduled Reels are due.",
      });
    }

    // Process one Reel per invocation.
    const item = dueItems[0];

    // Conditional update acts as a claim: only one request can claim
    // the same item while its publishing_started_at is fresh.
    let claimQuery = supabaseAdmin
      .from("content")
      .update({
        publishing_started_at: nowIso,
        publishing_error: null,
      })
      .eq("id", item.id)
      .eq("status", "scheduled");

    if (item.publishing_started_at) {
      claimQuery = claimQuery.lt(
        "publishing_started_at",
        staleBefore
      );
    } else {
      claimQuery = claimQuery.is("publishing_started_at", null);
    }

    const { data: claimed, error: claimError } = await claimQuery
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("Could not claim scheduled Reel:", claimError.message);

      return NextResponse.json(
        { success: false, error: "Could not claim scheduled Reel." },
        { status: 500 }
      );
    }

    if (!claimed) {
      return NextResponse.json({
        success: true,
        skipped: true,
        contentId: item.id,
        message: "Another scheduler request may already be processing this Reel.",
      });
    }

    const result = await publishScheduledReel(item);

    if (result.success) {
      return NextResponse.json({
        success: true,
        contentId: item.id,
        title: item.title,
        published: true,
        mediaId: result.mediaId,
        permalink: result.permalink ?? null,
      });
    }

    const errorMessage = result.error ?? "Publishing failed.";

    const { error: saveError } = await supabaseAdmin
      .from("content")
      .update({
        publishing_error: errorMessage,
        // Keep the claim fresh if the publish result is ambiguous.
        // This delays a retry while the result is investigated.
        publishing_started_at: result.ambiguous
          ? new Date().toISOString()
          : item.publishing_started_at,
      })
      .eq("id", item.id);

    if (saveError) {
      console.error("Could not save publishing error:", saveError.message);
    }

    return NextResponse.json({
      success: false,
      contentId: item.id,
      title: item.title,
      published: false,
      ambiguous: result.ambiguous ?? false,
      error: errorMessage,
    });
  } catch (error) {
    console.error("Scheduler route failed:", error);

    return NextResponse.json(
      { success: false, error: "Unexpected scheduler error." },
      { status: 500 }
    );
  }
}
