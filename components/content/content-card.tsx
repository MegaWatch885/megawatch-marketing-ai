"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import StatusBadge from "./status-badge";
import { getVideoUrl } from "@/services/storage.service";

type Platform =
  | "instagram"
  | "facebook"
  | "snapchat"
  | "pinterest";

type PublicationStatus = {
  status: string | null;
  error: string | null;
};

type PlatformStatuses = Record<Platform, PublicationStatus>;

interface Props {
  item: any;
  activePlatform: Platform;
}

const initialStatuses: PlatformStatuses = {
  instagram: { status: null, error: null },
  facebook: { status: null, error: null },
  snapchat: { status: null, error: null },
  pinterest: { status: null, error: null },
};

const platformLabels: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
};

const supportedPlatforms: Platform[] = ["instagram", "facebook"];

export default function ContentCard({ item }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  const [publishingPlatform, setPublishingPlatform] =
    useState<Platform | null>(null);

  const [publishMessage, setPublishMessage] = useState("");
  const [publishError, setPublishError] = useState("");

  const [platformStatuses, setPlatformStatuses] =
    useState<PlatformStatuses>(initialStatuses);

  const [loadingPlatformStatus, setLoadingPlatformStatus] =
    useState(true);

  const aiData = Array.isArray(item.content_ai)
    ? item.content_ai[0] ?? null
    : item.content_ai ?? null;

  const hasAI = Boolean(aiData);

  // Load video preview
  useEffect(() => {
    let cancelled = false;

    async function loadVideoUrl() {
      if (!item.storage_key) {
        setVideoUrl(null);
        return;
      }

      try {
        setVideoError(false);

        const url = await getVideoUrl(item.storage_key);

        if (!cancelled) {
          setVideoUrl(url);
        }
      } catch (error) {
        console.error("Video URL error:", error);

        if (!cancelled) {
          setVideoError(true);
        }
      }
    }

    loadVideoUrl();

    return () => {
      cancelled = true;
    };
  }, [item.storage_key]);

  // Load publication status for every platform
  const loadPlatformStatuses = useCallback(async () => {
    const response = await fetch(
      `/api/platform-publications/status?contentId=${encodeURIComponent(item.id)}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Could not load platform publication statuses.");
    }

    const result = await response.json();

    const nextStatuses: PlatformStatuses = {
      instagram: { status: null, error: null },
      facebook: { status: null, error: null },
      snapchat: { status: null, error: null },
      pinterest: { status: null, error: null },
    };

    for (const publication of result.publications ?? []) {
      const platform = publication.platform as Platform;

      if (platform in nextStatuses) {
        nextStatuses[platform] = {
          status: publication.status ?? null,
          error: publication.error_message ?? null,
        };
      }
    }

    // Legacy Instagram publication fallback
    if (
      item.status === "published" &&
      item.instagram_media_id &&
      !nextStatuses.instagram.status
    ) {
      nextStatuses.instagram.status = "published";
    }

    setPlatformStatuses(nextStatuses);
  }, [item.id, item.status, item.instagram_media_id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingPlatformStatus(true);

      try {
        await loadPlatformStatuses();
      } catch (error) {
        console.error("Platform status error:", error);

        if (!cancelled) {
          setPublishError(
            "Could not load publication statuses. Please refresh the page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPlatformStatus(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadPlatformStatuses]);

  // Publish to the explicitly selected platform
  async function handlePublish(platform: Platform) {
    if (!supportedPlatforms.includes(platform)) {
      setPublishError(
        `${platformLabels[platform]} publishing is not available yet.`
      );
      return;
    }

    const currentStatus = platformStatuses[platform].status;

    if (
      publishingPlatform ||
      currentStatus === "published" ||
      currentStatus === "uploading" ||
      currentStatus === "processing"
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Publish "${item.title}" to ${platformLabels[platform]}?`
    );

    if (!confirmed) return;

    setPublishingPlatform(platform);
    setPublishMessage("");
    setPublishError("");

    try {
      const endpoint =
        platform === "instagram"
          ? "/api/instagram/publish"
          : "/api/facebook/reels/publish";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: item.id }),
      });

      const result = await response.json().catch(() => null);

      // Facebook accepted the request but is still processing
      if (platform === "facebook" && response.status === 202) {
        setPublishMessage(
          "Facebook is processing this Reel. Please check its status before retrying."
        );

        await loadPlatformStatuses();
        return;
      }

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.error || "Publishing could not be confirmed."
        );
      }

      // Instagram accepted the request but is still processing
      if (platform === "instagram" && result?.processing === true) {
        setPublishMessage(
          "Instagram is processing this Reel. Please do not submit it again yet."
        );

        await loadPlatformStatuses();
        return;
      }

      setPublishMessage(
        `${platformLabels[platform]} accepted the publish request.`
      );

      // Refresh status from the database after publishing
      await loadPlatformStatuses();
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : "Publishing failed."
      );
    } finally {
      setPublishingPlatform(null);
    }
  }

  function renderPlatformAction(platform: Platform) {
    const publication = platformStatuses[platform];
    const status = publication.status;

    const isSupported = supportedPlatforms.includes(platform);
    const isPublished = status === "published";
    const isProcessing =
      status === "uploading" || status === "processing";
    const isPublishing = publishingPlatform === platform;

    let buttonLabel: string;

    if (isPublished) {
      buttonLabel = `Published on ${platformLabels[platform]} ✓`;
    } else if (isProcessing) {
      buttonLabel = `${platformLabels[platform]} processing...`;
    } else if (isPublishing) {
      buttonLabel = `Publishing to ${platformLabels[platform]}...`;
    } else if (loadingPlatformStatus) {
      buttonLabel = `Checking ${platformLabels[platform]}...`;
    } else if (!isSupported) {
      buttonLabel = `Publish on ${platformLabels[platform]} — Coming soon`;
    } else {
      buttonLabel = `Publish on ${platformLabels[platform]}`;
    }

    const disabled =
      !isSupported ||
      loadingPlatformStatus ||
      Boolean(publishingPlatform) ||
      isPublished ||
      isProcessing;

    return (
      <div key={platform} className="space-y-1">
        <button
          type="button"
          onClick={() => handlePublish(platform)}
          disabled={disabled}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed ${
            isPublished
              ? "bg-green-100 text-green-800"
              : disabled
                ? "bg-gray-200 text-gray-500"
                : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {buttonLabel}
        </button>

        {publication.error && status === "failed" && (
          <p className="text-xs text-red-600">
            Last attempt failed: {publication.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md">
      {/* Video Preview */}
      <div className="h-44 overflow-hidden bg-black">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : videoError ? (
          <div className="flex h-full items-center justify-center text-sm text-white">
            Video unavailable
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white">
            Loading video...
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-lg font-semibold">{item.title}</h3>

          <p className="mt-1 text-xs text-gray-500">
            Created{" "}
            {format(new Date(item.created_at), "dd MMM yyyy")}
          </p>
        </div>

        {/* Content Status + AI */}
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={item.status} />

          {hasAI ? (
            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
              🤖 AI Ready
            </span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
              AI Not Generated
            </span>
          )}
        </div>

        {/* AI Intelligence */}
        {aiData && (
          <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">
                AI Intelligence
              </p>

              <span className="text-xs font-semibold text-gray-700">
                {aiData.confidence ?? 0}% confidence
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-400">Category</p>
                <p className="truncate font-medium text-gray-700">
                  {aiData.category || "—"}
                </p>
              </div>

              <div>
                <p className="text-gray-400">Tone</p>
                <p className="truncate font-medium text-gray-700">
                  {aiData.tone || "—"}
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-gray-400">Topic</p>
                <p className="truncate font-medium text-gray-700">
                  {aiData.topic || "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Schedule */}
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Scheduled For</p>

          <p className="mt-1 text-sm font-medium">
            {item.scheduled_for
              ? new Date(item.scheduled_for).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Not Scheduled"}
          </p>
        </div>

        {/* Independent Platform Actions */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold text-gray-700">
            Platform Publishing
          </p>

          {renderPlatformAction("instagram")}
          {renderPlatformAction("facebook")}
          {renderPlatformAction("snapchat")}
          {renderPlatformAction("pinterest")}

          {publishMessage && (
            <p role="status" className="text-sm text-green-700">
              {publishMessage}
            </p>
          )}

          {publishError && (
            <p role="alert" className="text-sm text-red-600">
              {publishError}
            </p>
          )}

          <Link
            href={`/content-library/${item.id}`}
            className="block w-full rounded-lg bg-black px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-gray-800"
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}