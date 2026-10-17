"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getContentById,
  deleteContent,
  updateContentStatus,
  scheduleContent,
  publishContent,
} from "@/services/content.service";



import type {
  RepurposePlatform,
  RepurposedContent,
} from "@/services/ai/provider";
import { deleteVideo, getVideoUrl } from "@/services/storage.service";
import StatusBadge from "@/components/content/status-badge";
import Button from "@/components/ui/button";
import { getAIAnalysis } from "@/services/ai.service";

export default function ContentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [item, setItem] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [scheduledDate, setScheduledDate] = useState("");

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const [repurposeLoading, setRepurposeLoading] =
    useState<RepurposePlatform | null>(null);

  const [repurposedItems, setRepurposedItems] =
    useState<RepurposedContent[]>([]);

  const [repurposeError, setRepurposeError] =
    useState<string | null>(null);

  const [permalinkLoading, setPermalinkLoading] = useState(false);

  type RepurposingHistoryItem = RepurposedContent & {
    id: string;
    created_at: string;
  };

  const [repurposingHistory, setRepurposingHistory] =
    useState<RepurposingHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "instagram_reels" | "youtube_shorts"
  >("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // AI generation feedback
  const [aiLoading, setAiLoading] = useState(false);
  const [manualText, setManualText] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);


  async function loadData() {
    try {
      const data = await getContentById(id);
      setItem(data);

      const ai = await getAIAnalysis(id);
      setAnalysis(ai);

      // Load latest repurposed content
      const response = await fetch(
        `/api/content/${id}/repurposes`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Failed to load saved repurposed content."
        );
      }

      setRepurposedItems(result.content ?? []);

      // Load complete repurposing history
      await loadRepurposingHistory(id);
    } catch (error) {
      console.error("Detail page load error:", error);
    }
  }




  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  useEffect(() => {
    async function loadVideoUrl() {
      if (!item?.storage_key) return;

      try {
        setVideoLoading(true);
        const url = await getVideoUrl(item.storage_key);
        setVideoUrl(url);
      } catch (error) {
        console.error("Video URL error:", error);
        setVideoUrl(null);
      } finally {
        setVideoLoading(false);
      }
    }

    loadVideoUrl();
  }, [item?.storage_key]);


  async function handleStatusChange(status: string) {
    if (!item || statusLoading || deleteLoading || publishLoading) return;

    if (status === "published") {
      setActionFeedback({
        type: "error",
        message:
          "Use the Publish button to publish to Instagram. Do not set Published manually.",
      });
      return;
    }

    try {
      setStatusLoading(true);
      setActionFeedback(null);

      const updated = await updateContentStatus(item.id, status);
      setItem(updated);

      setActionFeedback({
        type: "success",
        message: `Status changed to ${status}.`,
      });
    } catch (error) {
      console.error("Status update error:", error);

      setActionFeedback({
        type: "error",
        message: "Status could not be updated. Please try again.",
      });
    } finally {
      setStatusLoading(false);
    }
  }


  async function handleDelete() {
    if (!item || deleteLoading || statusLoading || publishLoading) return;

    const confirmed = window.confirm("Delete this content?");

    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      setActionFeedback(null);

      await deleteVideo(item.storage_key);
      await deleteContent(item.id);
      router.push("/content-library");
    } catch (error) {
      console.error("Delete error:", error);

      setActionFeedback({
        type: "error",
        message: "Content could not be deleted. Please try again.",
      });
    } finally {
      setDeleteLoading(false);
    }
  }


  async function handleGenerateAI() {
    if (!item || aiLoading) return;

    try {
      setAiLoading(true);
      setAiFeedback(null);

      const response = await fetch("/api/ai/analyze-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentId: item.id, }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Text-based AI analysis failed."
        );
      }

      setAnalysis(result.analysis);

      const updated = await updateContentStatus(
        item.id,
        "ready"
      );

      setItem(updated);

      setAiFeedback({
        type: "success",
        message: "Text-based AI analysis generated successfully.",
      });
    } catch (error) {
      console.error("Text-based AI analysis error:", error);

      setAiFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "AI analysis could not be generated. Please try again.",
      });
    } finally {
      setAiLoading(false);
    }
  }



  async function handleRepurpose(platform: RepurposePlatform) {
    if (!item || repurposeLoading) return;

    try {
      setRepurposeLoading(platform);
      setRepurposeError(null);

      const response = await fetch("/api/ai/repurpose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentId: item.id,
          platform,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Content repurposing failed."
        );
      }

      setRepurposedItems((previous) => [
        result.content,
        ...previous,
      ]);
    } catch (error) {
      console.error("Repurposing error:", error);

      setRepurposeError(
        error instanceof Error
          ? error.message
          : "Could not repurpose content."
      );
    } finally {
      setRepurposeLoading(null);
    }
  }

  async function loadRepurposingHistory(contentId: string) {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch(
        `/api/content/${contentId}/repurposes/history`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Could not load repurposing history."
        );
      }

      setRepurposingHistory(result.content ?? []);
    } catch (error) {
      console.error("History loading failed:", error);
      setHistoryError("History load nahi hui. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }



  async function handleSchedule() {
    if (!item || !scheduledDate) return;

    const scheduledFor = new Date(scheduledDate).toISOString();

    console.log("Selected Local:", scheduledDate);
    console.log("UTC Saved:", scheduledFor);

    const updated = await scheduleContent(item.id, scheduledFor);
    setItem(updated);
  }


  async function handlePublish() {
    if (!item || publishLoading || statusLoading || deleteLoading) return;

    try {
      setPublishLoading(true);
      setActionFeedback(null);

      const response = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentId: item.id, }),
      });

      const result = await response.json();

      if (response.status === 202) {
        setActionFeedback({
          type: "success",
          message:
            "Instagram has accepted your Reel. It is still processing—please wait and check Instagram before trying again.",
        });
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Instagram could not publish this Reel."
        );
      }

      // Reload the saved content after Instagram confirms publication.
      const refreshedItem = await getContentById(item.id);
      setItem(refreshedItem);

      setActionFeedback({
        type: "success",
        message: result.warning
          ? result.warning
          : "Instagram confirmed that your Reel was published.",
      });
    } catch (error) {
      console.error("Instagram publish error:", error);

      setActionFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Publishing failed. Check Instagram before retrying.",
      });
    } finally {
      setPublishLoading(false);
    }
  }




  async function handleGetInstagramPermalink() {
    if (!item?.instagram_media_id || permalinkLoading) return;

    try {
      setPermalinkLoading(true);
      setActionFeedback(null);

      const response = await fetch("/api/instagram/permalink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.id,
          manualText,
        }),
        cache: "no-store",
      });

      const result = await response.json();

      console.log("Instagram permalink API result:", result);

      if (!response.ok || !result.success || !result.permalink) {
        throw new Error(
          result.error || "Instagram permalink was not returned."
        );
      }

      // Update the UI immediately using the API response.
      setItem((previous: any) =>
        previous
          ? { ...previous, permalink: result.permalink }
          : previous
      );

      setActionFeedback({
        type: "success",
        message: "Instagram Reel link retrieved successfully.",
      });
    } catch (error) {
      console.error("Permalink retrieval error:", error);

      setActionFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not retrieve the Instagram Reel link.",
      });
    } finally {
      setPermalinkLoading(false);
    }
  }


  if (!item) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Content Details</h1>

      {actionFeedback && (
        <div
          className={`flex items - start justify - between gap - 4 rounded - lg border p - 4 ${actionFeedback.type === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
            } `}
          role="alert"
        >
          <div>
            <p className="font-medium">
              {actionFeedback.type === "success" ? "Action successful" : "Action failed"}
            </p>
            <p className="text-sm mt-1">{actionFeedback.message}</p>
          </div>

          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="rounded-md px-2 py-1 text-sm hover:bg-black/5"
            aria-label="Dismiss action message"
          >
            ✕
          </button>
        </div>
      )}

      <div className="border rounded-xl overflow-hidden bg-black">
        {videoLoading ? (
          <div className="h-96 flex items-center justify-center text-white">
            Loading video...
          </div>
        ) : videoUrl ? (
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="w-full max-h-[600px] object-contain"
          />
        ) : (
          <div className="h-96 flex items-center justify-center text-white">
            Video unavailable
          </div>
        )}
      </div>

      <div className="border rounded-xl p-6 bg-white space-y-4">
        <div>
          <p className="text-gray-500">Title</p>
          <h2 className="text-xl font-semibold">{item.title}</h2>
        </div>

        <div>
          <p className="text-gray-500">Status</p>
          <StatusBadge status={item.status} />
        </div>

        <div>
          <p className="text-gray-500">Storage Path</p>
          <p>{item.storage_key}</p>
        </div>

        <div>
          <p className="text-gray-500">Created At</p>
          <p>{new Date(item.created_at).toLocaleString()}</p>
        </div>

        <div>
          <p className="text-gray-500">Scheduled For</p>
          <p>
            {item.scheduled_for
              ? new Date(item.scheduled_for).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })
              : "Not Scheduled"}
          </p>
        </div>

        <div>
          <p className="text-gray-500">Published At</p>
          <p>
            {item.published_at
              ? new Date(item.published_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })
              : "Not Published"}
          </p>


          {item.permalink ? (
            <a
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
            >
              View on Instagram ↗
            </a>
          ) : item.instagram_media_id ? (
            <button
              type="button"
              onClick={handleGetInstagramPermalink}
              disabled={permalinkLoading}
              className="mt-3 inline-flex rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {permalinkLoading ? "Retrieving link..." : "Retrieve Instagram link"}
            </button>
          ) : null}



        </div>

        <div>
          <strong>Raw:</strong>
          <pre>{item.scheduled_for}</pre>
        </div>
      </div>

      <div className="border rounded-xl p-6 bg-white">
        <h2 className="font-semibold mb-4">Status Management</h2>

        <select
          value={item.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="border rounded-lg p-2"
        >
          <option value="uploaded">Uploaded</option>
          <option value="processing">Processing</option>
          <option value="ready">Ready</option>
          <option value="scheduled">Scheduled</option>
        </select>

        {item.status !== "published" && (
          <div className="mt-4">
            <Button
              type="button"
              onClick={handlePublish}
              loading={publishLoading}
              disabled={statusLoading || deleteLoading}
            >
              Publish
            </Button>
          </div>
        )}
      </div>

      <div className="border rounded-xl p-6 bg-white">
        <h2 className="font-semibold mb-4">AI Analysis</h2>

        {aiFeedback && (
          <div
            className={`mb - 4 flex items - start justify - between gap - 4 rounded - lg border p - 4 ${aiFeedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
              } `}
            role="alert"
          >
            <div>
              <p className="font-medium">
                {aiFeedback.type === "success"
                  ? "AI analysis ready"
                  : "AI generation failed"}
              </p>
              <p className="text-sm mt-1">{aiFeedback.message}</p>
            </div>

            <button
              type="button"
              onClick={() => setAiFeedback(null)}
              className="rounded-md px-2 py-1 text-sm hover:bg-black/5"
              aria-label="Dismiss AI message"
            >
              ✕
            </button>
          </div>
        )}


        <div className="space-y-4">
          <div>
            <label
              htmlFor="manual-analysis-text"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Additional text for AI analysis (optional)
            </label>

            <textarea
              id="manual-analysis-text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste a transcript, describe the scene, or enter context for your social media content..."
              rows={5}
              maxLength={20000}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm text-black"
            />

            <p className="mt-1 text-xs text-gray-500">
              AI will analyze this text together with the saved content title
              and description. Maximum 20,000 characters.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleGenerateAI}
            loading={aiLoading}
          >
            {aiLoading
              ? "Analyzing Text..."
              : analysis
                ? "Re-analyze Text with AI"
                : "Analyze Text with AI"}
          </Button>

          {analysis ? (
            <div className="space-y-3 border-t pt-4">
              <div>
                <strong>Category:</strong> {analysis?.category}
              </div>

              <div>
                <strong>Tone:</strong> {analysis?.tone}
              </div>

              <div>
                <strong>Topic:</strong> {analysis?.topic}
              </div>

              <div>
                <strong>Audience:</strong> {analysis?.audience_cues}
              </div>

              <div>
                <strong>Caption 1:</strong> {analysis?.caption_1}
              </div>

              <div>
                <strong>Caption 2:</strong> {analysis?.caption_2}
              </div>

              <div>
                <strong>Caption 3:</strong> {analysis?.caption_3}
              </div>

              <div>
                <strong>Hashtags:</strong> {analysis?.hashtags}
              </div>

              <div>
                <strong>CTA:</strong> {analysis?.cta}
              </div>

              <div>
                <strong>Platform:</strong> {analysis?.platform_fit}
              </div>

              <div>
                <strong>Confidence:</strong> {analysis?.confidence}%
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No AI analysis available yet.
            </p>
          )}
        </div>


      </div>

      <div className="border rounded-xl p-6 bg-white">
        <h2 className="font-semibold mb-4">Schedule Content</h2>

        <div className="space-y-3">
          <input
            type="datetime-local"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 bg-white text-black"
          />

          <Button
            type="button"
            onClick={handleSchedule}
            disabled={!scheduledDate}
          >
            Schedule
          </Button>
        </div>
      </div>


      {/* Saved Repurposing  */}
      <div className="border rounded-xl p-6 bg-white space-y-5">
        <div>
          <h2 className="text-xl font-semibold">
            Repurpose Content
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Generate platform-specific content from this video
            using your local AI model.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleRepurpose("instagram_reels")}
            disabled={repurposeLoading !== null}
            className="rounded-lg bg-pink-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {repurposeLoading === "instagram_reels"
              ? "Generating..."
              : "Repurpose for Instagram Reels"}
          </button>

          <button
            onClick={() => handleRepurpose("youtube_shorts")}
            disabled={repurposeLoading !== null}
            className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {repurposeLoading === "youtube_shorts"
              ? "Generating..."
              : "Repurpose for YouTube Shorts"}
          </button>
        </div>

        {repurposeError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {repurposeError}
          </p>
        )}

        {repurposedItems.map((content, index) => (
          <div
            key={`${content.contentId} -${content.platform} -${index} `}
            className="rounded-lg border p-4 space-y-3"
          >
            <p className="text-xs font-semibold uppercase text-gray-500">
              {content.platform === "instagram_reels"
                ? "Instagram Reels"
                : "YouTube Shorts"}
            </p>

            <div>
              <h3 className="font-semibold">Title</h3>
              <p>{content.title}</p>
            </div>

            <div>
              <h3 className="font-semibold">Hook</h3>
              <p>{content.hook}</p>
            </div>

            <div>
              <h3 className="font-semibold">Caption</h3>
              <p className="whitespace-pre-wrap">{content.caption}</p>
            </div>

            <div>
              <h3 className="font-semibold">Hashtags</h3>
              <p className="whitespace-pre-wrap">{content.hashtags}</p>
            </div>

            <div>
              <h3 className="font-semibold">Call to action</h3>
              <p>{content.cta}</p>
            </div>

            <div>
              <h3 className="font-semibold">Why this fits</h3>
              <p>{content.reason}</p>
            </div>

            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `${content.title} \n\n${content.hook} \n\n${content.caption} \n\n${content.hashtags} \n\n${content.cta} `
                )
              }
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Copy All Content
            </button>
          </div>
        ))}
      </div>



      {/* Saved Repurposing History */}
      <div className="mt-8 rounded-xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">
            Saved Repurposing History
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            View and copy previously generated versions.
          </p>
        </div>

        {/* Platform filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setHistoryFilter("all")}
            className={`rounded - lg border px - 3 py - 2 text - sm ${historyFilter === "all"
              ? "bg-gray-900 text-white"
              : "hover:bg-gray-50"
              } `}
          >
            All
          </button>

          <button
            onClick={() => setHistoryFilter("instagram_reels")}
            className={`rounded - lg border px - 3 py - 2 text - sm ${historyFilter === "instagram_reels"
              ? "bg-pink-600 text-white"
              : "hover:bg-gray-50"
              } `}
          >
            Instagram Reels
          </button>

          <button
            onClick={() => setHistoryFilter("youtube_shorts")}
            className={`rounded - lg border px - 3 py - 2 text - sm ${historyFilter === "youtube_shorts"
              ? "bg-red-600 text-white"
              : "hover:bg-gray-50"
              } `}
          >
            YouTube Shorts
          </button>
        </div>

        {historyLoading && (
          <p className="text-sm text-gray-500">
            Loading saved history...
          </p>
        )}

        {historyError && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {historyError}
          </p>
        )}

        {!historyLoading &&
          !historyError &&
          repurposingHistory.filter(
            (entry) =>
              historyFilter === "all" ||
              entry.platform === historyFilter
          ).length === 0 && (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              No saved versions found for this filter.
            </p>
          )}

        {!historyLoading &&
          repurposingHistory
            .filter(
              (entry) =>
                historyFilter === "all" ||
                entry.platform === historyFilter
            )
            .map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`rounded - full px - 3 py - 1 text - xs font - semibold ${entry.platform === "instagram_reels"
                      ? "bg-pink-100 text-pink-700"
                      : "bg-red-100 text-red-700"
                      } `}
                  >
                    {entry.platform === "instagram_reels"
                      ? "Instagram Reels"
                      : "YouTube Shorts"}
                  </span>

                  <span className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold">Title</h3>
                  <p>{entry.title || "—"}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Hook</h3>
                  <p className="whitespace-pre-wrap">
                    {entry.hook || "—"}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Caption</h3>
                  <p className="whitespace-pre-wrap">
                    {entry.caption || "—"}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Hashtags</h3>
                  <p className="whitespace-pre-wrap">
                    {entry.hashtags || "—"}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold">Call to action</h3>
                  <p>{entry.cta || "—"}</p>
                </div>

                <div>
                  <h3 className="font-semibold">Why this fits</h3>
                  <p>{entry.reason || "—"}</p>
                </div>

                <button
                  onClick={async () => {
                    const text = [
                      entry.title,
                      entry.hook,
                      entry.caption,
                      entry.hashtags,
                      entry.cta,
                    ]
                      .filter(Boolean)
                      .join("\n\n");

                    try {
                      await navigator.clipboard.writeText(text);
                    } catch (error) {
                      console.error("Copy failed:", error);
                      setHistoryError(
                        "Copy failed. Please try again."
                      );
                    }
                  }}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Copy This Version
                </button>
              </div>
            ))}
      </div>





      <div className="border rounded-xl p-6 bg-white">
        <h2 className="font-semibold mb-3">Danger Zone</h2>

        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          loading={deleteLoading}
          disabled={statusLoading || publishLoading}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
