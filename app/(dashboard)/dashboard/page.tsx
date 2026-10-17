"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getInstagramPerformanceHistory, getTopPerformingReels, getContentRecommendations, } from "@/services/performance.service";
import { generateSuggestedReels } from "@/services/ai.service";

import UploadModal from "@/components/content/upload-modal";
import Button from "@/components/ui/button";
import InstagramPerformanceChart from "@/components/dashboard/instagram-performance-chart";


import {
  createContent,
  updateContentStatus,
} from "@/services/content.service";

import { getDashboardData } from "@/services/analytics.service";
import { uploadVideo } from "@/services/storage.service";

interface DashboardData {
  total: number;
  uploaded: number;
  processing: number;
  ready: number;
  scheduled: number;
  published: number;

  aiReady: number;
  aiPending: number;

  topCategory: string | null;
  topTone: string | null;
  averageConfidence: number;


  instagramPerformance: {
    reelsTracked: number;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    engagementRate: number;
  };

  nextScheduled: any | null;
  upcoming: any[];
  publishingActivity: any[];
  actionNeeded: any[];
  recent: any[];
}

export default function DashboardPage() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [isUploadOpen, setIsUploadOpen] =
    useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [syncingInstagram, setSyncingInstagram] = useState(false);
  const [instagramSyncMessage, setInstagramSyncMessage] = useState("");

  const [recommendations, setRecommendations] = useState<
    Awaited<ReturnType<typeof getContentRecommendations>>
  >([]);

  const [suggestedReels, setSuggestedReels] = useState<
    Awaited<ReturnType<typeof generateSuggestedReels>>
  >([]);

  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [ideasError, setIdeasError] = useState("");

  const [instagramHistory, setInstagramHistory] = useState<
    {
      date: string;
      views: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
    }[]
  >([]);


  const [importingInstagram, setImportingInstagram] = useState(false);
  const [instagramImportMessage, setInstagramImportMessage] = useState("");
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState<string | null>(null);
  const [checkingInstagram, setCheckingInstagram] = useState(true);

  const [performanceRange, setPerformanceRange] = useState<
    7 | 30 | "all"
  >(7);


  const [topReels, setTopReels] = useState<{
    topByViews: {
      content_id: string;
      title: string;
      views: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      engagement_rate: number;
    }[];
    topByEngagement: {
      content_id: string;
      title: string;
      views: number;
      reach: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      engagement_rate: number;
    }[];
  }>({
    topByViews: [],
    topByEngagement: [],
  });



  const handleInstagramSync = async () => {
    setSyncingInstagram(true);
    setInstagramSyncMessage("");

    try {
      const response = await fetch("/api/instagram/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 25 }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Instagram sync failed"
        );
      }

      // Refresh dashboard metrics after syncing.
      await loadDashboard(false);

      setInstagramSyncMessage(
        `Sync complete! ${result.synced} reels synced, ${result.inserted} inserted, ${result.updated} updated.`
      );

      if (result.errors?.length > 0) {
        setInstagramSyncMessage(
          (current) =>
            `${current} ${result.errors.length} item(s) had errors.`
        );
      }
    } catch (error) {
      setInstagramSyncMessage(
        error instanceof Error
          ? error.message
          : "Instagram sync failed."
      );
    } finally {
      setSyncingInstagram(false);
    }
  };



  const handleInstagramImport = async () => {
    if (importingInstagram) return;

    setImportingInstagram(true);
    setInstagramImportMessage("");

    try {
      const response = await fetch("/api/instagram/import", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Instagram posts import nahi ho sake."
        );
      }

      setInstagramImportMessage(
        `Import complete: ${result.importedCount ?? 0} new posts, ${result.alreadyImportedCount ?? 0
        } already imported.`
      );
    } catch (error) {
      setInstagramImportMessage(
        error instanceof Error
          ? error.message
          : "Instagram import failed."
      );
    } finally {
      setImportingInstagram(false);
    }
  };


  async function loadDashboard(showLoader = true) {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const result = await getDashboardData();
      setData(result);

      const topReelsResult = await getTopPerformingReels();
      setTopReels(topReelsResult);


      const recommendationsResult = await getContentRecommendations();
      setRecommendations(recommendationsResult);

    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      if (showLoader) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);


  useEffect(() => {
    async function loadPerformanceHistory() {
      try {
        const days =
          performanceRange === "all"
            ? undefined
            : performanceRange;

        console.log("Selected range:", performanceRange);
        console.log("Days passed to service:", days);

        const history = await getInstagramPerformanceHistory(days);

        console.log("Returned history:", history);
        console.log(
          "Returned dates:",
          history.map((item) => item.date)
        );

        console.table(
          history.map((item) => ({
            date: item.date,
            views: item.views,
            reach: item.reach,
          }))
        );

        setInstagramHistory(history);
      } catch (error) {
        console.error("Performance history load error:", error);
      }
    }

    loadPerformanceHistory();
  }, [performanceRange]);



  useEffect(() => {
    let cancelled = false;

    async function loadInstagramStatus() {
      try {
        const response = await fetch("/api/instagram/status", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to check Instagram connection.");
        }

        const result = await response.json();

        if (!cancelled) {
          setInstagramConnected(Boolean(result.connected));
          setInstagramUsername(result.username ?? null);
        }
      } catch (error) {
        console.error("Instagram status check failed:", error);
      } finally {
        if (!cancelled) {
          setCheckingInstagram(false);
        }
      }
    }

    loadInstagramStatus();

    return () => {
      cancelled = true;
    };
  }, []);






  // --------------------------------
  // UPLOAD
  // --------------------------------

  async function handleUpload(
    title: string,
    file: File
  ) {
    try {
      const uploadResult =
        await uploadVideo(file);

      await createContent({
        title,
        storage_key: uploadResult.path,
      });

      await loadDashboard(false);
    } catch (error) {
      console.error(
        "Dashboard upload error:",
        error
      );

      throw error;
    }
  }

  // --------------------------------
  // STATUS LABEL
  // --------------------------------

  function getStatusLabel(
    status: string
  ) {
    switch (status) {
      case "uploaded":
        return "Uploaded";

      case "processing":
        return "Processing";

      case "ready":
        return "Ready";

      case "scheduled":
        return "Scheduled";

      case "published":
        return "Published";

      default:
        return status;
    }
  }

  // --------------------------------
  // STATUS STYLE
  // --------------------------------

  function getStatusClass(
    status: string
  ) {
    switch (status) {
      case "uploaded":
        return "bg-gray-100 text-gray-700";

      case "processing":
        return "bg-yellow-100 text-yellow-700";

      case "ready":
        return "bg-blue-100 text-blue-700";

      case "scheduled":
        return "bg-purple-100 text-purple-700";

      case "published":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  // --------------------------------
  // Generate ideas
  // --------------------------------

  async function handleGenerateIdeas() {
    setIsGeneratingIdeas(true);
    setIdeasError("");

    try {
      const ideas = await generateSuggestedReels();
      setSuggestedReels(ideas);
    } catch (error) {
      console.error("Failed to generate Reel ideas:", error);
      setIdeasError(
        error instanceof Error
          ? error.message
          : "Could not generate Reel ideas."
      );
    } finally {
      setIsGeneratingIdeas(false);
    }
  }



  // --------------------------------
  // LOADING
  // --------------------------------

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col gap-2">
          <div className="h-9 w-40 rounded-lg bg-gray-200" />
          <div className="h-4 w-72 rounded bg-gray-100" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="bg-white border rounded-xl p-4">
              <div className="h-4 w-16 rounded bg-gray-200" />
              <div className="h-8 w-12 rounded bg-gray-200 mt-3" />
            </div>
          ))}
        </div>

        <div className="bg-white border rounded-xl p-5">
          <div className="h-6 w-40 rounded bg-gray-200" />
          <div className="h-4 w-72 rounded bg-gray-100 mt-2" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="h-4 w-20 rounded bg-gray-200" />
                <div className="h-8 w-12 rounded bg-gray-200 mt-3" />
                <div className="h-2 w-full rounded-full bg-gray-100 mt-4" />
              </div>
            ))}
          </div>
          <div className="border rounded-lg p-4 mt-4">
            <div className="h-5 w-24 rounded bg-gray-200" />
            <div className="h-4 w-64 rounded bg-gray-100 mt-2" />
            <div className="h-3 w-full rounded-full bg-gray-100 mt-4" />
          </div>
        </div>

        <div className="bg-white border rounded-xl p-5">
          <div className="h-6 w-48 rounded bg-gray-200" />
          <div className="h-4 w-64 rounded bg-gray-100 mt-2" />
          <div className="border rounded-xl p-5 mt-4">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="h-4 w-32 rounded bg-gray-100 mt-3" />
            <div className="h-6 w-56 rounded bg-gray-200 mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-white border rounded-xl p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
            !
          </div>
          <h2 className="text-xl font-semibold mt-4">
            Dashboard unavailable
          </h2>
          <p className="text-gray-500 mt-2">
            We couldn't load your dashboard data. Please try again.
          </p>
          <div className="mt-5">
            <Button type="button" onClick={() => loadDashboard()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* -------------------------------- */}
      {/* HEADER */}
      {/* -------------------------------- */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Dashboard
          </h1>

          <p className="text-gray-500 mt-1">
            Manage your social content from one place.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleInstagramSync}
            loading={syncingInstagram}
          >
            {syncingInstagram ? "Syncing Instagram..." : "Sync Instagram"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => loadDashboard(false)}
            loading={refreshing}
          >
            Refresh
          </Button>

          <Button
            type="button"
            size="lg"
            onClick={() => setIsUploadOpen(true)}
          >
            + Upload Reel
          </Button>
        </div>
      </div>

      {instagramSyncMessage && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700"
        >
          {instagramSyncMessage}
        </div>
      )}


      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPerformanceRange(7)}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${performanceRange === 7
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          Last 7 Days
        </button>

        <button
          onClick={() => setPerformanceRange(30)}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${performanceRange === 30
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          Last 30 Days
        </button>

        <button
          onClick={() => setPerformanceRange("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${performanceRange === "all"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
        >
          All Time
        </button>
      </div>


      {/* INSTAGRAM ACCOUNT & CONTENT ACTIONS */}
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            Instagram Integration
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect your account, import posts, and refresh Instagram data.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Connect Instagram */}

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Instagram Account</h3>

            <p className="mt-2 text-sm text-gray-500">
              {checkingInstagram
                ? "Checking Instagram connection..."
                : instagramConnected
                  ? `Connected${instagramUsername ? ` as @${instagramUsername}` : ""}`
                  : "No Instagram account connected."}
            </p>

            {instagramConnected ? (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/instagram/connect";
                }}
                className="mt-4 w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                disabled={checkingInstagram}
              >
                Reconnect Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/instagram/connect";
                }}
                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={checkingInstagram}
              >
                {checkingInstagram ? "Checking..." : "Connect Account"}
              </button>
            )}
          </div>


          {/* Import Posts */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Import Posts</h3>
            <p className="mt-2 text-sm text-gray-500">
              Bring Instagram posts into your Content Library.
            </p>


            <button
              type="button"
              onClick={handleInstagramImport}
              disabled={importingInstagram}
              className="mt-4 w-full rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importingInstagram ? "Importing Posts..." : "Import Posts"}
            </button>

            {instagramImportMessage && (
              <p
                role="status"
                className="mt-3 text-sm text-gray-700"
              >
                {instagramImportMessage}
              </p>
            )}

          </div>

          {/* Existing Sync */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Sync Instagram</h3>
            <p className="mt-2 text-sm text-gray-500">
              Refresh saved Instagram performance and content data.
            </p>

            <button
              type="button"
              onClick={handleInstagramSync}
              disabled={syncingInstagram}
              className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncingInstagram ? "Syncing..." : "Sync Instagram"}
            </button>
          </div>
        </div>
      </section>







      {/* INSTAGRAM PERFORMANCE */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Instagram Performance
          </h2>
          <p className="text-sm text-gray-500">
            Latest saved performance across tracked Instagram content
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Reels Tracked</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {data.instagramPerformance.reelsTracked}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Views</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat("en-IN").format(
                data.instagramPerformance.views
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Reach</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat("en-IN").format(
                data.instagramPerformance.reach
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Engagement Rate</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {data.instagramPerformance.engagementRate.toFixed(2)}%
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Likes</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat("en-IN").format(
                data.instagramPerformance.likes
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Comments</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat("en-IN").format(
                data.instagramPerformance.comments
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Shares</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat("en-IN").format(
                data.instagramPerformance.shares
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Saves</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {new Intl.NumberFormat("en-IN").format(
                data.instagramPerformance.saves
              )}
            </p>
          </div>
        </div>
      </section>


      {/* INSTAGRAM PERFORMANCE CHART */}
      <div className="mt-8">
        <InstagramPerformanceChart data={instagramHistory} />
      </div>


      {/* Suggested Next Reels */}
      <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Suggested Next Reels
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Generate new Reel ideas based on your best-performing topics.
            </p>
          </div>

          <button
            onClick={handleGenerateIdeas}
            disabled={isGeneratingIdeas}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingIdeas ? "Generating..." : "Generate Ideas"}
          </button>
        </div>

        {ideasError && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {ideasError}
          </p>
        )}

        {suggestedReels.length === 0 && !ideasError && (
          <p className="mt-4 text-sm text-gray-500">
            Click Generate Ideas to create your next Reel concepts.
          </p>
        )}

        {suggestedReels.length > 0 && (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {suggestedReels.map((idea, index) => (
              <article
                key={`${idea.title}-${index}`}
                className="rounded-lg border border-gray-200 p-4"
              >

                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Source Reel
                </p>

                <p className="mb-2 text-sm font-medium text-indigo-700">
                  {idea.sourceTitle}
                </p>

                <h3 className="font-semibold">{idea.title}</h3>


                <p className="mt-3 text-sm font-medium text-blue-700">
                  Hook
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {idea.hook}
                </p>

                <p className="mt-3 text-sm font-medium text-gray-700">
                  Caption
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {idea.caption}
                </p>

                <p className="mt-3 text-sm text-gray-600">
                  <span className="font-medium">Hashtags:</span>{" "}
                  {idea.hashtags}
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">CTA:</span>{" "}
                  {idea.cta}
                </p>

                <p className="mt-3 border-t pt-3 text-sm text-gray-500">
                  {idea.reason}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>





      {/* Content Recommendations */}
      <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            Content Recommendations
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Suggestions based on your recorded Instagram performance.
          </p>
        </div>

        {recommendations.length === 0 ? (
          <p className="text-sm text-gray-500">
            Sync your Instagram content to generate recommendations.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recommendations.map((item, index) => (
              <article
                key={`${item.title}-${index}`}
                className="rounded-lg border border-gray-200 p-4"
              >
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${item.type === "success"
                    ? "bg-green-100 text-green-700"
                    : item.type === "caution"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                    }`}
                >
                  {item.type === "success"
                    ? "Opportunity"
                    : item.type === "caution"
                      ? "Needs data"
                      : "Suggestion"}
                </span>

                <h3 className="mt-3 font-semibold">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {item.reason}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>




      {/* TOP PERFORMING REELS */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Top-Performing Reels
          </h2>
          <p className="text-sm text-gray-500">
            Your best Instagram content by views and engagement
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* TOP BY VIEWS */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Top 5 by Views
            </h3>

            {topReels.topByViews.length === 0 ? (
              <p className="text-sm text-gray-500">
                No Instagram performance data available yet.
              </p>
            ) : (
              <div className="space-y-4">
                {topReels.topByViews.map((reel, index) => (
                  <Link
                    key={reel.content_id}
                    href={`/content-library/${reel.content_id}`}
                    className="flex items-center justify-between gap-4 rounded-lg p-3 transition hover:bg-gray-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {reel.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          Reach:{" "}
                          {new Intl.NumberFormat("en-IN").format(reel.reach)}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-bold text-gray-900">
                        {new Intl.NumberFormat("en-IN").format(reel.views)}
                      </p>
                      <p className="text-xs text-gray-500">views</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* TOP BY ENGAGEMENT */}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Top 5 by Engagement
            </h3>

            {topReels.topByEngagement.length === 0 ? (
              <p className="text-sm text-gray-500">
                No Instagram performance data available yet.
              </p>
            ) : (
              <div className="space-y-4">
                {topReels.topByEngagement.map((reel, index) => (
                  <Link
                    key={reel.content_id}
                    href={`/content-library/${reel.content_id}`}
                    className="flex items-center justify-between gap-4 rounded-lg p-3 transition hover:bg-gray-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold">
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {reel.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Intl.NumberFormat("en-IN").format(reel.likes)} likes
                          {" · "}
                          {new Intl.NumberFormat("en-IN").format(reel.comments)} comments
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-bold text-gray-900">
                        {reel.engagement_rate.toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">engagement</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>





      {/* REEL PERFORMANCE COMPARISON */}
      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Reel Performance Comparison
          </h2>
          <p className="text-sm text-gray-500">
            Compare views, reach and engagement across your top reels.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[750px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Reel</th>
                <th className="px-4 py-3 font-semibold">Views</th>
                <th className="px-4 py-3 font-semibold">Reach</th>
                <th className="px-4 py-3 font-semibold">Likes</th>
                <th className="px-4 py-3 font-semibold">Comments</th>
                <th className="px-4 py-3 font-semibold">Shares</th>
                <th className="px-4 py-3 font-semibold">Saves</th>
                <th className="px-4 py-3 font-semibold">Engagement</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {topReels.topByViews.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No Instagram performance data available yet.
                  </td>
                </tr>
              ) : (
                topReels.topByViews.map((reel) => (
                  <tr
                    key={reel.content_id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="max-w-[220px] px-4 py-3">
                      <Link
                        href={`/content-library/${reel.content_id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        <span className="block truncate">
                          {reel.title}
                        </span>
                      </Link>
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {new Intl.NumberFormat("en-IN").format(reel.views)}
                    </td>
                    <td className="px-4 py-3">
                      {new Intl.NumberFormat("en-IN").format(reel.reach)}
                    </td>
                    <td className="px-4 py-3">
                      {new Intl.NumberFormat("en-IN").format(reel.likes)}
                    </td>
                    <td className="px-4 py-3">
                      {new Intl.NumberFormat("en-IN").format(reel.comments)}
                    </td>
                    <td className="px-4 py-3">
                      {new Intl.NumberFormat("en-IN").format(reel.shares)}
                    </td>
                    <td className="px-4 py-3">
                      {new Intl.NumberFormat("en-IN").format(reel.saves)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {reel.engagement_rate.toFixed(2)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>







      {/* -------------------------------- */}
      {/* STATS */}
      {/* -------------------------------- */}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Total
          </p>

          <p className="text-2xl font-bold mt-1">
            {data.total}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Uploaded
          </p>

          <p className="text-2xl font-bold mt-1">
            {data.uploaded}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Processing
          </p>

          <p className="text-2xl font-bold mt-1">
            {data.processing}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Ready
          </p>

          <p className="text-2xl font-bold mt-1">
            {data.ready}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Scheduled
          </p>

          <p className="text-2xl font-bold mt-1">
            {data.scheduled}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Published
          </p>

          <p className="text-2xl font-bold mt-1">
            {data.published}
          </p>
        </div>

      </div>

      {/* -------------------------------- */}
      {/* CONTENT PIPELINE */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

          <div>
            <h2 className="text-lg font-semibold">
              Content Pipeline
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Track your content from upload to publishing.
            </p>
          </div>

          <div className="text-sm text-gray-500">
            {data.total} total reels
          </div>

        </div>

        {/* Pipeline */}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5">

          {/* Uploaded */}

          <div className="border rounded-lg p-4">

            <div className="flex items-center justify-between">

              <p className="text-sm text-gray-500">
                Uploaded
              </p>

              <span className="text-lg">
                📥
              </span>

            </div>

            <p className="text-2xl font-bold mt-2">
              {data.uploaded}
            </p>

            <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">

              <div
                className="h-full bg-gray-400 rounded-full"
                style={{
                  width: `${data.total > 0
                    ? Math.min(
                      (data.uploaded / data.total) * 100,
                      100
                    )
                    : 0
                    }%`,
                }}
              />

            </div>

          </div>


          {/* Ready */}

          <div className="border rounded-lg p-4">

            <div className="flex items-center justify-between">

              <p className="text-sm text-gray-500">
                Ready
              </p>

              <span className="text-lg">
                ✅
              </span>

            </div>

            <p className="text-2xl font-bold mt-2">
              {data.ready}
            </p>

            <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">

              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${data.total > 0
                    ? Math.min(
                      (data.ready / data.total) * 100,
                      100
                    )
                    : 0
                    }%`,
                }}
              />

            </div>

          </div>


          {/* Scheduled */}

          <div className="border rounded-lg p-4">

            <div className="flex items-center justify-between">

              <p className="text-sm text-gray-500">
                Scheduled
              </p>

              <span className="text-lg">
                📅
              </span>

            </div>

            <p className="text-2xl font-bold mt-2">
              {data.scheduled}
            </p>

            <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">

              <div
                className="h-full bg-purple-500 rounded-full"
                style={{
                  width: `${data.total > 0
                    ? Math.min(
                      (data.scheduled / data.total) * 100,
                      100
                    )
                    : 0
                    }%`,
                }}
              />

            </div>

          </div>


          {/* Published */}

          <div className="border rounded-lg p-4">

            <div className="flex items-center justify-between">

              <p className="text-sm text-gray-500">
                Published
              </p>

              <span className="text-lg">
                🚀
              </span>

            </div>

            <p className="text-2xl font-bold mt-2">
              {data.published}
            </p>

            <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">

              <div
                className="h-full bg-green-500 rounded-full"
                style={{
                  width: `${data.total > 0
                    ? Math.min(
                      (data.published / data.total) * 100,
                      100
                    )
                    : 0
                    }%`,
                }}
              />

            </div>

          </div>

        </div>


        {/* AI Coverage */}

        <div className="border rounded-lg p-4 mt-4">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

            <div>

              <p className="font-medium">
                AI Coverage
              </p>

              <p className="text-sm text-gray-500 mt-1">
                {data.aiReady} of {data.total} reels
                have AI analysis.
              </p>

            </div>

            <p className="text-xl font-bold">
              {data.total > 0
                ? Math.round(
                  (data.aiReady / data.total) * 100
                )
                : 0}
              %
            </p>

          </div>

          <div className="h-3 bg-gray-100 rounded-full mt-3 overflow-hidden">

            <div
              className="h-full bg-black rounded-full transition-all"
              style={{
                width: `${data.total > 0
                  ? Math.min(
                    (data.aiReady / data.total) * 100,
                    100
                  )
                  : 0
                  }%`,
              }}
            />

          </div>

        </div>

      </div>

      {/* -------------------------------- */}
      {/* NEXT SCHEDULED REEL */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex items-center justify-between gap-3">

          <div>
            <h2 className="text-lg font-semibold">
              Next Scheduled Reel
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Your next upcoming publishing slot.
            </p>
          </div>

          <span className="text-2xl">
            📅
          </span>

        </div>

        {data.nextScheduled ? (

          <div className="mt-4 border rounded-xl p-5">

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

              {/* Reel Info */}

              <div className="min-w-0">

                <div className="flex items-center gap-2">

                  <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                    Scheduled
                  </span>

                </div>

                <h3 className="text-xl font-semibold mt-3 truncate">
                  {data.nextScheduled.title}
                </h3>

                <p className="text-gray-500 mt-2">
                  Scheduled for
                </p>

                <p className="text-lg font-medium mt-1">

                  {data.nextScheduled.scheduled_for
                    ? new Date(
                      data.nextScheduled.scheduled_for
                    ).toLocaleString(
                      "en-IN",
                      {
                        timeZone:
                          "Asia/Kolkata",
                        dateStyle:
                          "full",
                        timeStyle:
                          "short",
                      }
                    )
                    : "No schedule time"}

                </p>

                <p className="text-xs text-gray-400 mt-1">
                  India Standard Time
                </p>

              </div>


              {/* Actions */}

              <div className="flex flex-col sm:flex-row lg:flex-col gap-2">

                <Link
                  href={`/content-library/${data.nextScheduled.id}`}
                  className="bg-black text-white px-4 py-2.5 rounded-lg text-sm font-medium text-center hover:bg-gray-800 transition"
                >
                  Manage Reel
                </Link>

                <Link
                  href="/calendar"
                  className="border px-4 py-2.5 rounded-lg text-sm font-medium text-center hover:bg-gray-50 transition"
                >
                  View Calendar
                </Link>

              </div>

            </div>

          </div>

        ) : (

          <div className="mt-4 border rounded-xl p-8 text-center">

            <div className="text-4xl">
              📅
            </div>

            <h3 className="font-semibold mt-3">
              No upcoming reels
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Schedule your next reel to see it here.
            </p>

            <Link
              href="/content-library"
              className="inline-block mt-4 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              Go to Content Library
            </Link>

          </div>

        )}

      </div>

      {/* -------------------------------- */}
      {/* QUICK ACTIONS */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <h2 className="text-lg font-semibold">
          Quick Actions
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Jump directly to the tools you
          use most.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">

          <button
            type="button"
            onClick={() =>
              setIsUploadOpen(true)
            }
            className="mt-3 bg-black text-white px-4 py-2 rounded-lg text-sm"
          >
            + Upload First Reel
          </button>

          <Link
            href="/ai-studio"
            className="border rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <p className="font-semibold">
              🤖 AI Studio
            </p>

            <p className="text-sm text-gray-500 mt-1">
              View AI content
            </p>
          </Link>

          <Link
            href="/calendar"
            className="border rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <p className="font-semibold">
              📅 Calendar
            </p>

            <p className="text-sm text-gray-500 mt-1">
              Manage schedule
            </p>
          </Link>

          <Link
            href="/analytics"
            className="border rounded-lg p-4 hover:bg-gray-50 transition"
          >
            <p className="font-semibold">
              📊 Analytics
            </p>

            <p className="text-sm text-gray-500 mt-1">
              View performance
            </p>
          </Link>

        </div>

      </div>

      {/* -------------------------------- */}
      {/* AI INTELLIGENCE */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              AI Intelligence
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Overview of your AI-powered content analysis.
            </p>
          </div>

          <Link
            href="/ai-studio"
            className="text-sm font-medium hover:underline"
          >
            Open AI Studio →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {/* Total Content */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Total Content
            </p>

            <p className="text-2xl font-bold mt-1">
              {data.total}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              All content
            </p>
          </div>

          {/* AI Ready */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              AI Ready
            </p>

            <p className="text-2xl font-bold mt-1">
              {data.aiReady}
            </p>

            <p className="text-xs text-green-600 mt-1">
              Analysis available
            </p>
          </div>

          {/* AI Coverage */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              AI Coverage
            </p>

            <p className="text-2xl font-bold mt-1">
              {data.total > 0
                ? Math.round(
                  (data.aiReady / data.total) * 100
                )
                : 0}
              %
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Content analyzed
            </p>
          </div>

          {/* AI Pending */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              AI Pending
            </p>

            <p className="text-2xl font-bold mt-1">
              {data.aiPending}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Awaiting analysis
            </p>
          </div>
        </div>

        {/* AI Insights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {/* Top Category */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Top Category
            </p>

            <p className="text-lg font-semibold mt-1 truncate">
              {data.topCategory || "—"}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Most analyzed content type
            </p>
          </div>

          {/* Top Tone */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Top Tone
            </p>

            <p className="text-lg font-semibold mt-1 truncate">
              {data.topTone || "—"}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Most common content tone
            </p>
          </div>

          {/* Average Confidence */}
          <div className="border rounded-lg p-4">
            <p className="text-sm text-gray-500">
              Avg. AI Confidence
            </p>

            <p className="text-2xl font-bold mt-1">
              {data.averageConfidence}%
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Across analyzed content
            </p>
          </div>
        </div>

        {/* AI Insight Summary */}
        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <div className="text-xl">
              🧠
            </div>

            <div>
              <p className="text-sm font-medium">
                AI Insight
              </p>

              {data.aiReady > 0 ? (
                <p className="text-sm text-gray-600 mt-1">
                  Most analyzed content is{" "}
                  <span className="font-medium text-gray-900">
                    {data.topCategory || "General"}
                  </span>{" "}
                  with a dominant{" "}
                  <span className="font-medium text-gray-900">
                    {data.topTone || "Neutral"}
                  </span>{" "}
                  tone and an average AI confidence of{" "}
                  <span className="font-medium text-gray-900">
                    {data.averageConfidence}%
                  </span>.
                </p>
              ) : (
                <p className="text-sm text-gray-600 mt-1">
                  No AI analysis is available yet. Analyze your
                  content to generate intelligence insights.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* AI Status */}
        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                AI Analysis Status
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Real video analysis using your local AI pipeline.
              </p>
            </div>

            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${data.aiReady > 0
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
                }`}
            >
              {data.aiReady > 0
                ? "AI Active"
                : "No Analysis Yet"}
            </span>
          </div>
        </div>
      </div>


      {/* -------------------------------- */}
      {/* ACTION NEEDED */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex items-center justify-between">

          <div>
            <div className="flex items-center gap-2">

              <h2 className="text-lg font-semibold">
                Action Needed
              </h2>

              {data.actionNeeded.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                  {data.actionNeeded.length}
                </span>
              )}

            </div>

            <p className="text-sm text-gray-500 mt-1">
              Content that needs your attention.
            </p>
          </div>

          <Link
            href="/content-library"
            className="text-sm font-medium hover:underline"
          >
            Content Library →
          </Link>

        </div>

        <div className="mt-4 space-y-3">

          {data.actionNeeded.length === 0 ? (

            <div className="border rounded-lg p-6 text-center">

              <div className="text-3xl">
                ✅
              </div>

              <p className="font-medium mt-2">
                Everything is up to date
              </p>

              <p className="text-sm text-gray-500 mt-1">
                No content currently needs action.
              </p>

            </div>

          ) : (

            data.actionNeeded.map(
              (item) => (

                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >

                  <div className="min-w-0">

                    <p className="font-medium truncate">
                      {item.title}
                    </p>

                    <p className="text-sm text-gray-500 mt-1">
                      {item.status === "uploaded"
                        ? "AI analysis / content preparation needed"
                        : "Ready to be scheduled"}
                    </p>

                  </div>

                  <Link
                    href={`/content-library/${item.id}`}
                    className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 text-center"
                  >
                    {item.status === "uploaded"
                      ? "Analyze"
                      : "Schedule"}
                  </Link>

                </div>

              )
            )

          )}

        </div>

      </div>


      {/* -------------------------------- */}
      {/* PUBLISHING ACTIVITY */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Publishing Activity
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Recently published content.
            </p>
          </div>

          <Link
            href="/analytics"
            className="text-sm font-medium hover:underline"
          >
            View Analytics →
          </Link>

        </div>

        <div className="mt-4 space-y-3">

          {data.publishingActivity.length === 0 ? (

            <div className="border rounded-lg p-6 text-center">

              <p className="text-gray-500">
                No content has been published yet.
              </p>

            </div>

          ) : (

            data.publishingActivity.map(
              (item) => (

                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >

                  <div className="min-w-0">

                    <p className="font-medium truncate">
                      {item.title}
                    </p>

                    <p className="text-sm text-gray-500 mt-1">
                      Published{" "}
                      {item.published_at
                        ? new Date(
                          item.published_at
                        ).toLocaleString(
                          "en-IN",
                          {
                            timeZone:
                              "Asia/Kolkata",
                            dateStyle:
                              "medium",
                            timeStyle:
                              "short",
                          }
                        )
                        : ""}
                    </p>

                  </div>

                  <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                    Published
                  </span>

                </div>

              )
            )

          )}

        </div>

      </div>

      {/* -------------------------------- */}
      {/* UPCOMING SCHEDULE */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Upcoming Schedule
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Your next scheduled reels.
            </p>
          </div>

          <Link
            href="/calendar"
            className="text-sm font-medium hover:underline"
          >
            View Calendar →
          </Link>

        </div>

        <div className="mt-4 space-y-3">

          {data.upcoming.length === 0 ? (

            <div className="border rounded-lg p-6 text-center">
              <p className="text-gray-500">
                No upcoming scheduled reels.
              </p>

              <Link
                href="/content-library"
                className="inline-block mt-3 text-sm font-medium"
              >
                Go to Content Library →
              </Link>
            </div>

          ) : (

            data.upcoming.map(
              (item) => (

                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >

                  <div>
                    <p className="font-medium">
                      {item.title}
                    </p>

                    <p className="text-sm text-gray-500 mt-1">
                      {item.scheduled_for
                        ? new Date(
                          item.scheduled_for
                        ).toLocaleString(
                          "en-IN",
                          {
                            timeZone:
                              "Asia/Kolkata",
                            dateStyle:
                              "medium",
                            timeStyle:
                              "short",
                          }
                        )
                        : "No date"}
                    </p>
                  </div>

                  <Link
                    href={`/content-library/${item.id}`}
                    className="text-sm border px-3 py-2 rounded-lg hover:bg-gray-50 text-center"
                  >
                    Manage
                  </Link>

                </div>

              )
            )

          )}

        </div>

      </div>

      {/* -------------------------------- */}
      {/* RECENT CONTENT */}
      {/* -------------------------------- */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="text-lg font-semibold">
              Recent Content
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Latest activity in your library.
            </p>
          </div>

          <Link
            href="/content-library"
            className="text-sm font-medium hover:underline"
          >
            View All →
          </Link>

        </div>

        <div className="mt-4 space-y-3">

          {data.recent.length === 0 ? (

            <div className="border rounded-lg p-6 text-center">
              <p className="text-gray-500">
                No content yet.
              </p>

              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setIsUploadOpen(true)
                  }
                >
                  + Upload First Reel
                </Button>
              </div>
            </div>

          ) : (

            data.recent.map(
              (item) => (

                <div
                  key={item.id}
                  className="border rounded-lg p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >

                  <div className="min-w-0">

                    <p className="font-medium truncate">
                      {item.title}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {item.created_at
                        ? new Date(
                          item.created_at
                        ).toLocaleString(
                          "en-IN",
                          {
                            timeZone:
                              "Asia/Kolkata",
                            dateStyle:
                              "medium",
                            timeStyle:
                              "short",
                          }
                        )
                        : ""}
                    </p>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <span
                      className={`text-xs px-3 py-1 rounded-full ${getStatusClass(
                        item.status
                      )}`}
                    >
                      {getStatusLabel(
                        item.status
                      )}
                    </span>

                    {item.status ===
                      "uploaded" && (
                        <Link
                          href={`/content-library/${item.id}`}
                          className="text-sm border px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          Analyze
                        </Link>
                      )}

                    {item.status ===
                      "ready" && (
                        <Link
                          href={`/content-library/${item.id}`}
                          className="text-sm border px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          Schedule
                        </Link>
                      )}

                    {item.status ===
                      "scheduled" && (
                        <Link
                          href="/calendar"
                          className="text-sm border px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          View Schedule
                        </Link>
                      )}

                    {item.status ===
                      "published" && (
                        <Link
                          href={`/content-library/${item.id}`}
                          className="text-sm border px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          View Published
                        </Link>
                      )}

                    <Link
                      href={`/content-library/${item.id}`}
                      className="text-sm bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800"
                    >
                      Manage
                    </Link>

                  </div>

                </div>

              )
            )

          )}

        </div>

      </div>

      {/* -------------------------------- */}
      {/* UPLOAD MODAL */}
      {/* -------------------------------- */}

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