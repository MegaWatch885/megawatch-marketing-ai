"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/button";

import ContentCard from "@/components/content/content-card";
import UploadModal from "@/components/content/upload-modal";

import {
  createContent,
  getContent,
} from "@/services/content.service";

import { uploadVideo } from "@/services/storage.service";


type Platform = "instagram" | "facebook" | "snapchat" | "pinterest";
type PlatformTab = "all" | Platform;

type Publication = {
  content_id: string;
  platform: Platform;
  status: string;
  error_message?: string | null;
  published_at?: string | null;
};


export default function ContentLibraryPage() {
  const [items, setItems] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [aiFilter, setAiFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] =
    useState("all");

  const [isUploadOpen, setIsUploadOpen] =
    useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);



  type Platform = "instagram" | "facebook" | "snapchat" | "pinterest";
  type PlatformTab = "all" | Platform;

  const [activePlatform, setActivePlatform] =
    useState<PlatformTab>("all");

  const platforms: {
    id: PlatformTab;
    label: string;
    available: boolean;
  }[] = [
      { id: "all", label: "All", available: true },
      { id: "instagram", label: "Instagram", available: true },
      { id: "facebook", label: "Facebook", available: true },
      { id: "snapchat", label: "Snapchat", available: false },
      { id: "pinterest", label: "Pinterest", available: false },
    ];

  const [publications, setPublications] = useState<Publication[]>([]);
  const [publicationError, setPublicationError] = useState("");


  // --------------------------------
  // LOAD CONTENT
  // --------------------------------


  async function loadData() {
    setLoading(true);
    setPublicationError("");

    try {
      const [contentData, publicationResponse] = await Promise.all([
        getContent(),
        fetch("/api/platform-publications/status", {
          cache: "no-store",
        }),
      ]);

      setItems(contentData || []);

      if (!publicationResponse.ok) {
        throw new Error("Could not load platform publication statuses.");
      }

      const result = await publicationResponse.json();
      setPublications(result.publications || []);
    } catch (error) {
      console.error("Load content error:", error);
      setPublicationError(
        "Some platform statuses could not be loaded. Please refresh the page."
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadData();
  }, []);

  // --------------------------------
  // UPLOAD
  // --------------------------------

  async function handleUpload(
    title: string,
    file: File
  ) {
    try {
      setFeedback(null);

      const uploadResult =
        await uploadVideo(file);

      await createContent({
        title,
        storage_key: uploadResult.path,
      });

      await loadData();

      setFeedback({
        type: "success",
        message: `"${title}" uploaded successfully.`,
      });
    } catch (error) {
      console.error(
        "Upload error:",
        error
      );

      setFeedback({
        type: "error",
        message: "Upload failed. Please try again.",
      });

      throw error;
    }
  }

  // --------------------------------
  // FILTER
  // --------------------------------

  const publicationFor = (contentId: string, platform: Platform) =>
    publications.find(
      (p) =>
        p.content_id === contentId &&
        p.platform === platform
    );

  const isPublishedOn = (contentId: string, platform: Platform) =>
    publicationFor(contentId, platform)?.status === "published" ||
    (
      platform === "instagram" &&
      items.some(
        (item) =>
          item.id === contentId &&
          item.status === "published" &&
          Boolean(item.instagram_media_id)
      )
    );

  const platformItems =
    activePlatform === "all"
      ? items
      : items.filter((item) =>
        isPublishedOn(item.id, activePlatform)
      );

  const filteredItems = platformItems.filter((item) => {
    const matchesSearch = item.title
      ?.toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    const hasAI =
      Array.isArray(item.content_ai) && item.content_ai.length > 0;

    const matchesAI =
      aiFilter === "all" ||
      (aiFilter === "ready" && hasAI) ||
      (aiFilter === "not-ready" && !hasAI);

    const matchesSchedule =
      scheduleFilter === "all" ||
      (scheduleFilter === "scheduled" && Boolean(item.scheduled_for)) ||
      (scheduleFilter === "unscheduled" && !item.scheduled_for);

    return matchesSearch && matchesStatus && matchesAI && matchesSchedule;
  });

  // --------------------------------
  // COUNTS
  // --------------------------------

  const totalCount = platformItems.length;

  const uploadedCount = platformItems.filter(
    (item) => item.status === "uploaded"
  ).length;

  const readyCount = platformItems.filter(
    (item) => item.status === "ready"
  ).length;

  const scheduledCount = platformItems.filter(
    (item) => item.status === "scheduled"
  ).length;

  const publishedCount =
    activePlatform === "all"
      ? platformItems.filter((item) => item.status === "published").length
      : platformItems.filter((item) =>
        isPublishedOn(item.id, activePlatform)
      ).length;

  const aiReadyCount = platformItems.filter(
    (item) => Array.isArray(item.content_ai) && item.content_ai.length > 0
  ).length;

  // --------------------------------
  // CLEAR FILTERS
  // --------------------------------

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAiFilter("all");
    setScheduleFilter("all");
  }

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    aiFilter !== "all" ||
    scheduleFilter !== "all";

  // --------------------------------
  // UI
  // --------------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-3xl font-bold">
            Content Library
          </h1>

          <p className="text-gray-500 mt-1">
            Manage your uploaded reels,
            AI analysis and publishing.
          </p>
        </div>


        <Button
          type="button"
          size="lg"
          disabled={
            activePlatform === "snapchat" ||
            activePlatform === "pinterest"
          }
          onClick={() => {
            setFeedback(null);

            if (
              activePlatform === "snapchat" ||
              activePlatform === "pinterest"
            ) {
              setFeedback({
                type: "error",
                message: `${activePlatform} publishing is coming soon.`,
              });
              return;
            }

            setIsUploadOpen(true);
          }}
        >
          + Upload Reel
        </Button>


      </div>


      {/* PLATFORM TABS */}
      <div className="border-b border-gray-200">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {platforms.map((platform) => {
            const isActive = activePlatform === platform.id;

            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => {
                  setActivePlatform(platform.id);
                  setFeedback(null);
                }}
                className={`whitespace-nowrap rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition ${isActive
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
              >
                {platform.label}

                {!platform.available && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>


      {feedback && (
        <div
          className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${feedback.type === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-red-200 bg-red-50 text-red-800"
            }`}
          role="alert"
        >
          <div>
            <p className="font-medium">
              {feedback.type === "success" ? "Upload successful" : "Upload failed"}
            </p>
            <p className="text-sm mt-1">{feedback.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded-md px-2 py-1 text-sm hover:bg-black/5"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}

      {publicationError && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {publicationError}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Total
          </p>

          <p className="text-2xl font-bold mt-1">
            {totalCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Uploaded
          </p>

          <p className="text-2xl font-bold mt-1">
            {uploadedCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Ready
          </p>

          <p className="text-2xl font-bold mt-1">
            {readyCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Scheduled
          </p>

          <p className="text-2xl font-bold mt-1">
            {scheduledCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Published
          </p>

          <p className="text-2xl font-bold mt-1">
            {publishedCount}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            AI Ready
          </p>

          <p className="text-2xl font-bold mt-1">
            {aiReadyCount}
          </p>
        </div>

      </div>

      {/* FILTER PANEL */}

      <div className="bg-white border rounded-xl p-4">

        <div className="flex flex-col gap-4">

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* SEARCH */}

            <input
              type="text"
              placeholder="Search by title..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            />

            {/* STATUS */}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="border rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">
                All Status
              </option>

              <option value="uploaded">
                Uploaded
              </option>

              <option value="processing">
                Processing
              </option>

              <option value="ready">
                Ready
              </option>

              <option value="scheduled">
                Scheduled
              </option>

              <option value="published">
                Published
              </option>
            </select>

            {/* AI */}

            <select
              value={aiFilter}
              onChange={(e) =>
                setAiFilter(
                  e.target.value
                )
              }
              className="border rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">
                All AI
              </option>

              <option value="ready">
                AI Ready
              </option>

              <option value="not-ready">
                AI Not Generated
              </option>
            </select>

            {/* SCHEDULE */}

            <select
              value={scheduleFilter}
              onChange={(e) =>
                setScheduleFilter(
                  e.target.value
                )
              }
              className="border rounded-lg px-3 py-2 bg-white"
            >
              <option value="all">
                All Schedule
              </option>

              <option value="scheduled">
                Scheduled
              </option>

              <option value="unscheduled">
                Not Scheduled
              </option>
            </select>

          </div>

          {/* FILTER FOOTER */}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-700">
                {filteredItems.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-700">
                {items.length}
              </span>{" "}
              reels
            </p>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            )}

          </div>

        </div>

      </div>

      {/* CONTENT */}

      {loading ? (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="bg-white border rounded-xl overflow-hidden"
            >
              <div className="aspect-video bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-1/2 rounded bg-gray-100" />
                <div className="flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-gray-100" />
                  <div className="h-6 w-16 rounded-full bg-gray-100" />
                </div>
                <div className="h-9 w-full rounded-lg bg-gray-100" />
              </div>
            </div>
          ))}
        </div>

      ) : filteredItems.length === 0 ? (

        <div className="bg-white border rounded-xl p-10 text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            🎬
          </div>

          <h2 className="text-xl font-semibold">
            {hasActiveFilters
              ? "No Reels Found"
              : "No Content Yet"}
          </h2>

          <p className="text-gray-500 mt-2">

            {hasActiveFilters
              ? "No reels match your current filters."
              : "Upload your first Reel to get started."}

          </p>

          {hasActiveFilters ? (

            <div className="mt-5">
              <Button
                type="button"
                variant="secondary"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>

          ) : (

            <div className="mt-5">
              <Button
                type="button"
                onClick={() => setIsUploadOpen(true)}
              >
                + Upload Reel
              </Button>
            </div>

          )}

        </div>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">


       
          {filteredItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              activePlatform={
                activePlatform === "all" ? "instagram" : activePlatform
              }
            />
          ))}
       


        </div>

      )}

      {/* UPLOAD MODAL */}

      <UploadModal
        open={isUploadOpen}
        onClose={() =>
          setIsUploadOpen(false)
        }
        onUpload={handleUpload}
      />

    </div>
  );
}