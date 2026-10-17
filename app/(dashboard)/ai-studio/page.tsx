"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { getAllAIAnalysis } from "@/services/ai.service";


export default function AIStudioPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [toneFilter, setToneFilter] =
    useState("all");
  const [platformFilter, setPlatformFilter] =
    useState("all");
  const [confidenceFilter, setConfidenceFilter] =
    useState("all");

  const [sortBy, setSortBy] = useState("newest");

  const [copied, setCopied] =
    useState<string | null>(null);

  // --------------------------------
  // LOAD AI DATA
  // --------------------------------

  async function loadData() {
    try {
      setLoading(true);

      const data =
        await getAllAIAnalysis();

      setItems(data || []);
    } catch (error) {
      console.error(
        "AI Studio load error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // --------------------------------
  // COPY
  // --------------------------------

  async function handleCopy(
    text: string,
    key: string
  ) {
    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(key);

      setTimeout(() => {
        setCopied(null);
      }, 1500);
    } catch (error) {
      console.error(
        "Copy failed:",
        error
      );
    }
  }


  // --------------------------------
  // COPY ALL
  // --------------------------------


  async function handleCopyAll(item: any) {
    const text = `
Title: ${item.content?.title || "Untitled Content"}

Category: ${item.category || "Not available"}
Tone: ${item.tone || "Not available"}
Topic: ${item.topic || "Not available"}
Audience: ${item.audience_cues || "Not available"}

Caption 1:
${item.caption_1 || ""}

Caption 2:
${item.caption_2 || ""}

Caption 3:
${item.caption_3 || ""}

Hashtags:
${item.hashtags || ""}

CTA:
${item.cta || ""}

Platform:
${item.platform_fit || "General"}

Confidence:
${item.confidence || 0}%
`.trim();

    await handleCopy(
      text,
      `all-${item.id}`
    );
  }

  // --------------------------------
  // UNIQUE FILTER OPTIONS
  // --------------------------------

  const categories = Array.from(
    new Set(
      items
        .map((item) => item.category)
        .filter(Boolean)
    )
  );

  const tones = Array.from(
    new Set(
      items
        .map((item) => item.tone)
        .filter(Boolean)
    )
  );

  const platforms = Array.from(
    new Set(
      items
        .map((item) => item.platform_fit)
        .filter(Boolean)
    )
  );

  // --------------------------------
  // FILTER AI RESULTS
  // --------------------------------

  const filteredItems = items.filter(
    (item) => {
      const title =
        item.content?.title || "";

      const matchesSearch =
        title
          .toLowerCase()
          .includes(
            search.toLowerCase()
          );

      const matchesCategory =
        categoryFilter === "all" ||
        item.category ===
        categoryFilter;

      const matchesTone =
        toneFilter === "all" ||
        item.tone === toneFilter;

      const matchesPlatform =
        platformFilter === "all" ||
        item.platform_fit ===
        platformFilter;

      const confidence =
        Number(item.confidence || 0);

      const matchesConfidence =
        confidenceFilter === "all" ||
        (confidenceFilter ===
          "high" &&
          confidence >= 80) ||
        (confidenceFilter ===
          "medium" &&
          confidence >= 60 &&
          confidence < 80) ||
        (confidenceFilter ===
          "low" &&
          confidence < 60);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesTone &&
        matchesPlatform &&
        matchesConfidence
      );
    }
  );


  // --------------------------------
  // SORT items
  // --------------------------------



  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "highest-confidence":
        return (
          Number(b.confidence || 0) -
          Number(a.confidence || 0)
        );

      case "lowest-confidence":
        return (
          Number(a.confidence || 0) -
          Number(b.confidence || 0)
        );

      case "category":
        return String(a.category || "").localeCompare(
          String(b.category || "")
        );

      case "newest":
      default:
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
    }
  });

  // --------------------------------
  // CLEAR FILTERS
  // --------------------------------

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setToneFilter("all");
    setPlatformFilter("all");
    setConfidenceFilter("all");
    setSortBy("newest");
  }

  const hasActiveFilters =
    search !== "" ||
    categoryFilter !== "all" ||
    toneFilter !== "all" ||
    platformFilter !== "all" ||
    confidenceFilter !== "all";

  // --------------------------------
  // COUNTS
  // --------------------------------

  const averageConfidence =
    items.length > 0
      ? Math.round(
        items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.confidence || 0
            ),
          0
        ) / items.length
      )
      : 0;

  const highConfidenceCount =
    items.filter(
      (item) =>
        Number(item.confidence || 0) >=
        80
    ).length;


  const categoryCounts: Record<string, number> = {};

  const toneCounts: Record<string, number> = {};

  items.forEach((item) => {
    if (item.category) {
      categoryCounts[item.category] =
        (categoryCounts[item.category] || 0) + 1;
    }

    if (item.tone) {
      toneCounts[item.tone] =
        (toneCounts[item.tone] || 0) + 1;
    }
  });

  const topCategory =
    Object.entries(categoryCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || "—";

  const topTone =
    Object.entries(toneCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0] || "—";

  const highConfidencePercentage =
    items.length > 0
      ? Math.round(
        (highConfidenceCount / items.length) * 100
      )
      : 0;


  const bestAIItem =
    items.length > 0
      ? [...items].sort(
        (a, b) =>
          Number(b.confidence || 0) -
          Number(a.confidence || 0)
      )[0]
      : null;


  const lowConfidenceCount = items.filter(
    (item) =>
      Number(item.confidence || 0) < 60
  ).length;

  const recommendation =
    items.length === 0
      ? "Generate AI analysis for your content to unlock recommendations."
      : lowConfidenceCount > 0
        ? `${lowConfidenceCount} ${lowConfidenceCount === 1
          ? "analysis needs"
          : "analyses need"
        } review because of low AI confidence.`
        : `Your AI library is performing consistently with an average confidence of ${averageConfidence}%.`;

  // --------------------------------
  // LOADING
  // --------------------------------

  if (loading) {
    return (
      <div className="space-y-6">

        <div>
          <h1 className="text-3xl font-bold">
            AI Studio
          </h1>

          <p className="text-gray-500 mt-1">
            AI-generated captions,
            hashtags and content insights.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-10 text-center">
          <p className="text-gray-500">
            Loading AI analysis...
          </p>
        </div>

      </div>
    );
  }

  // --------------------------------
  // EMPTY
  // --------------------------------

  if (items.length === 0) {
    return (
      <div className="space-y-6">

        <div>
          <h1 className="text-3xl font-bold">
            AI Studio
          </h1>

          <p className="text-gray-500 mt-1">
            AI-generated captions,
            hashtags and content insights.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-10 text-center">

          <div className="text-5xl mb-4">
            🤖
          </div>

          <h2 className="text-xl font-semibold">
            No AI Analysis Yet
          </h2>

          <p className="text-gray-500 mt-2">
            Generate AI analysis from a
            content detail page.
          </p>

        </div>

      </div>
    );
  }

  // --------------------------------
  // MAIN
  // --------------------------------

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div>
        <h1 className="text-3xl font-bold">
          AI Studio
        </h1>

        <p className="text-gray-500 mt-1">
          AI-generated captions,
          hashtags and content insights.
        </p>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Total AI Analysis
          </p>

          <p className="text-2xl font-bold mt-1">
            {items.length}
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Average Confidence
          </p>

          <p className="text-2xl font-bold mt-1">
            {averageConfidence}%
          </p>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            High Confidence
          </p>

          <p className="text-2xl font-bold mt-1">
            {highConfidenceCount}
          </p>
        </div>

      </div>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Category */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Top Category
          </p>

          <p className="text-lg font-semibold mt-1">
            {topCategory}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Most analyzed content type
          </p>
        </div>

        {/* Top Tone */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            Top Tone
          </p>

          <p className="text-lg font-semibold mt-1">
            {topTone}
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Most common content tone
          </p>
        </div>

        {/* High Confidence Rate */}
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">
            High Confidence Rate
          </p>

          <p className="text-2xl font-bold mt-1">
            {highConfidencePercentage}%
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Analyses with 80%+ confidence
          </p>
        </div>
      </div>

      {/* AI Insight Summary */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="text-xl">
            🧠
          </div>

          <div>
            <h2 className="text-sm font-semibold">
              AI Insight
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              Your analyzed content is primarily{" "}
              <span className="font-medium text-gray-900">
                {topCategory}
              </span>
              , with{" "}
              <span className="font-medium text-gray-900">
                {topTone}
              </span>{" "}
              as the dominant tone. Average AI confidence is{" "}
              <span className="font-medium text-gray-900">
                {averageConfidence}%
              </span>
              .
            </p>

            <p className="text-xs text-gray-500 mt-2">
              Based on {items.length} AI{" "}
              {items.length === 1
                ? "analysis"
                : "analyses"}.
            </p>
          </div>
        </div>
      </div>


      {/* BEST AI CONTENT */}

      {bestAIItem && (
        <div className="bg-white border rounded-xl p-5">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex-1">

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                  🏆 Best AI Content
                </span>

                <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                  {bestAIItem.confidence}% confidence
                </span>
              </div>

              <h2 className="text-xl font-bold mt-3">
                {bestAIItem.content?.title ||
                  "Untitled Content"}
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                {bestAIItem.category || "—"} •{" "}
                {bestAIItem.topic || "—"} •{" "}
                {bestAIItem.tone || "—"}
              </p>

              <p className="text-sm text-gray-600 mt-3">
                {bestAIItem.caption_1 ||
                  "No caption available."}
              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              <Link
                href={`/content-library/${bestAIItem.content?.id}`}
                className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 transition"
              >
                🎯 Open Content
              </Link>

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    [
                      bestAIItem.caption_1,
                      bestAIItem.caption_2,
                      bestAIItem.caption_3,
                      bestAIItem.hashtags,
                      bestAIItem.cta,
                    ]
                      .filter(Boolean)
                      .join("\n\n"),
                    `${bestAIItem.id}-best`
                  )
                }
                className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                {copied === `${bestAIItem.id}-best`
                  ? "✓ Copied"
                  : "📋 Copy Output"}
              </button>

            </div>

          </div>

        </div>
      )}


      {/* SMART RECOMMENDATIONS */}

      <div className="bg-white border rounded-xl p-5">

        <div className="flex items-start gap-3">

          <div className="text-2xl">
            🧠
          </div>

          <div className="flex-1">

            <h2 className="text-lg font-semibold">
              Smart Recommendations
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Actionable insights based on your current AI analysis.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">

              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500">
                  Content Focus
                </p>

                <p className="font-medium mt-1">
                  {topCategory}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Most common category
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500">
                  Dominant Tone
                </p>

                <p className="font-medium mt-1">
                  {topTone}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Most common tone
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <p className="text-xs text-gray-500">
                  Recommended Action
                </p>

                <p className="font-medium mt-1">
                  {lowConfidenceCount > 0
                    ? "Review AI results"
                    : "Keep publishing"}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {recommendation}
                </p>
              </div>

            </div>

          </div>

        </div>

      </div>


      {/* AI STUDIO STATUS */}

      <div className="bg-gray-50 border rounded-xl p-4">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          <div>
            <p className="text-sm font-medium text-gray-900">
              AI Studio Status
            </p>

            <p className="text-xs text-gray-500 mt-1">
              {items.length} AI analyses available
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
              🤖 AI Ready
            </span>

            <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700">
              📊 {highConfidenceCount} High Confidence
            </span>

            {lowConfidenceCount > 0 && (
              <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
                ⚠️ {lowConfidenceCount} Review
              </span>
            )}

          </div>

        </div>

      </div>

      {/* FILTERS */}

      <div className="bg-white border rounded-xl p-4">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">

          {/* SEARCH */}

          <input
            type="text"
            placeholder="Search by Reel title..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-black"
          />

          {/* CATEGORY */}

          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(
                e.target.value
              )
            }
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">
              All Categories
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              )
            )}
          </select>

          {/* TONE */}

          <select
            value={toneFilter}
            onChange={(e) =>
              setToneFilter(
                e.target.value
              )
            }
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">
              All Tones
            </option>

            {tones.map((tone) => (
              <option
                key={tone}
                value={tone}
              >
                {tone}
              </option>
            ))}
          </select>

          {/* PLATFORM */}

          <select
            value={platformFilter}
            onChange={(e) =>
              setPlatformFilter(
                e.target.value
              )
            }
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">
              All Platforms
            </option>

            {platforms.map(
              (platform) => (
                <option
                  key={platform}
                  value={platform}
                >
                  {platform}
                </option>
              )
            )}
          </select>

          {/* CONFIDENCE */}

          <select
            value={confidenceFilter}
            onChange={(e) =>
              setConfidenceFilter(
                e.target.value
              )
            }
            className="border rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">
              All Confidence
            </option>

            <option value="high">
              High — 80%+
            </option>

            <option value="medium">
              Medium — 60–79%
            </option>

            <option value="low">
              Low — Below 60%
            </option>
          </select>

        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Sort
          </label>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="newest">
              Newest
            </option>

            <option value="highest-confidence">
              Highest Confidence
            </option>

            <option value="lowest-confidence">
              Lowest Confidence
            </option>

            <option value="category">
              Category A–Z
            </option>
          </select>
        </div>

        {/* FILTER FOOTER */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">

          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-700">
              {filteredItems.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">
              {items.length}
            </span>{" "}
            AI analyses
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm border px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              Clear Filters
            </button>
          )}

        </div>

      </div>

      {/* RESULTS */}

      {filteredItems.length === 0 ? (

        <div className="bg-white border rounded-xl p-10 text-center">

          <div className="text-5xl mb-4">
            🔎
          </div>

          <h2 className="text-xl font-semibold">
            No AI Results Found
          </h2>

          <p className="text-gray-500 mt-2">
            No AI analysis matches your
            current filters.
          </p>

          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Clear Filters
          </button>

        </div>

      ) : (

        <div className="space-y-6">

          {sortedItems.map(
            (item) => (

              <div
                key={item.id}
                className="bg-white border rounded-xl p-6 space-y-6"
              >

                {/* CONTENT HEADER */}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                  <div>
                    <h2 className="text-xl font-bold">
                      {item.content?.title ||
                        "Untitled Content"}
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      {item.category} •{" "}
                      {item.topic}
                    </p>
                  </div>

                  {/* WORKFLOW PROGRESS */}

                  <div className="mt-4 mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-700">
                        Workflow Progress
                      </p>

                      <span className="text-xs text-gray-500">
                        {item.content?.status === "published"
                          ? "4/4"
                          : item.content?.status === "scheduled"
                            ? "3/4"
                            : item.content?.status === "ready"
                              ? "2/4"
                              : "1/4"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">

                      <div
                        className={`h-1.5 flex-1 rounded-full ${item.content?.status
                          ? "bg-green-500"
                          : "bg-gray-200"
                          }`}
                      />

                      <div
                        className={`h-1.5 flex-1 rounded-full ${["ready", "scheduled", "published"].includes(
                          item.content?.status
                        )
                          ? "bg-green-500"
                          : "bg-gray-200"
                          }`}
                      />

                      <div
                        className={`h-1.5 flex-1 rounded-full ${["scheduled", "published"].includes(
                          item.content?.status
                        )
                          ? "bg-green-500"
                          : "bg-gray-200"
                          }`}
                      />

                      <div
                        className={`h-1.5 flex-1 rounded-full ${item.content?.status === "published"
                          ? "bg-green-500"
                          : "bg-gray-200"
                          }`}
                      />

                    </div>

                    <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                      <span>Uploaded</span>
                      <span>AI Ready</span>
                      <span>Scheduled</span>
                      <span>Published</span>
                    </div>
                  </div>

                  {/* CURRENT WORKFLOW STAGE */}

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                    <div>
                      <p className="text-xs text-gray-500">
                        Current Stage
                      </p>

                      <p className="text-sm font-semibold text-gray-900">
                        {item.content?.status === "uploaded" && "📤 Uploaded"}
                        {item.content?.status === "ready" && "🤖 AI Ready"}
                        {item.content?.status === "scheduled" && "📅 Scheduled"}
                        {item.content?.status === "published" && "🚀 Published"}
                        {!item.content?.status && "⚪ Unknown"}
                      </p>

                      <p className="text-xs text-gray-500 mt-1">
                        {item.content?.status === "uploaded" &&
                          "AI analysis is ready to be reviewed."}

                        {item.content?.status === "ready" &&
                          "Content is ready for scheduling."}

                        {item.content?.status === "scheduled" &&
                          "Waiting for the scheduled publishing time."}

                        {item.content?.status === "published" &&
                          "Workflow completed successfully."}

                        {!item.content?.status &&
                          "Review the content workflow status."}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">

                      <p className="text-xs text-gray-500">
                        Next Action
                      </p>

                      <p className="text-sm font-medium text-gray-700">
                        {item.content?.status === "uploaded" &&
                          "🔍 Review AI analysis"}

                        {item.content?.status === "ready" &&
                          "📅 Schedule content"}

                        {item.content?.status === "scheduled" &&
                          "⏳ Waiting for publish"}

                        {item.content?.status === "published" &&
                          "✅ Workflow complete"}

                        {!item.content?.status &&
                          "Review content"}
                      </p>

                    </div>

                  </div>

                  {/* WORFLOW ACTON*/}

                  <div className="flex flex-wrap items-center gap-2 mt-3">

                    {item.content?.status === "uploaded" && (
                      <>
                        <Link
                          href={`/content-library/${item.content?.id}`}
                          className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                        >
                          🔍 Analyze
                        </Link>

                        <span className="text-xs px-3 py-2 rounded-lg bg-yellow-50 text-yellow-700 border border-yellow-100">
                          ⏳ AI Review Needed
                        </span>
                      </>
                    )}

                    {item.content?.status === "ready" && (
                      <>
                        <Link
                          href={`/content-library/${item.content?.id}`}
                          className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                        >
                          📅 Schedule
                        </Link>

                        <span className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-100">
                          ✅ Ready to Schedule
                        </span>
                      </>
                    )}

                    {item.content?.status === "scheduled" && (
                      <Link
                        href={`/calendar?contentId=${item.content?.id}`}
                        className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                      >
                        📅 View in Calendar
                      </Link>
                    )}

                    {item.content?.status === "published" &&
                      item.content?.published_at && (
                        <>
                          
                          <Link
                            href={`/analytics?contentId=${item.content?.id}`}
                            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                          >
                            📊 View Performance
                          </Link>

                          <span className="text-xs px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-100">
                            🚀 Published
                          </span>
                        </>
                      )}

                    {!item.content?.status && (
                      <span className="text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-600">
                        ⚪ Status Unknown
                      </span>
                    )}

                    <span className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                      🤖 AI Analysis Ready
                    </span>

                  </div>

                  {/* WORKFLOW CONTEXT */}

                  {item.content?.status === "published" &&
                    item.content?.published_at && (
                      <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

                          <div>
                            <span className="font-medium">
                              🚀 Published on{" "}
                            </span>

                            <span className="font-semibold">
                              {new Date(
                                item.content.published_at
                              ).toLocaleString("en-IN", {
                                timeZone: "Asia/Kolkata",
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>

                            <span className="text-green-500 ml-1">
                              (IST)
                            </span>
                          </div>

                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                            📊 Performance Ready
                          </span>

                        </div>

                      </div>
                    )}


                  {/* BADGES*/}

                  <div className="flex items-center gap-2 flex-wrap">

                    {bestAIItem?.id === item.id && (
                      <span className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                        🏆 Best AI Score
                      </span>
                    )}

                    {Number(item.confidence || 0) < 60 && (
                      <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                        ⚠️ Needs Review
                      </span>
                    )}

                    <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">
                      🤖 AI Ready
                    </span>

                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700">
                      {item.confidence}%
                      confidence
                    </span>



                    <Link
                      href={`/content-library/${item.content?.id}`}
                      className="text-xs px-3 py-1 rounded-full bg-black text-white hover:bg-gray-800 transition"
                    >
                      Open Content →
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAll(item)
                      }
                      className="text-xs px-3 py-1 rounded-full border bg-white hover:bg-gray-50 transition"
                    >
                      {copied === `all-${item.id}`
                        ? "✓ Copied"
                        : "📋 Copy All"}
                    </button>

                  </div>

                </div>


                {/* CONTENT ACTIONS */}

                <div className="flex flex-wrap items-center gap-2 border-t border-b py-3">

                  <Link
                    href={`/content-library/${item.content?.id}`}
                    className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
                  >
                    🎯 Open Content
                  </Link>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        [
                          item.caption_1,
                          item.caption_2,
                          item.caption_3,
                          item.hashtags,
                          item.cta,
                        ]
                          .filter(Boolean)
                          .join("\n\n"),
                        `${item.id}-all`
                      )
                    }
                    className="text-sm border px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    {copied === `${item.id}-all`
                      ? "✓ Copied All"
                      : "📋 Copy All"}
                  </button>

                </div>

                {/* INSIGHTS */}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">
                      Category
                    </p>

                    <p className="font-medium mt-1">
                      {item.category ||
                        "Not available"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">
                      Tone
                    </p>

                    <p className="font-medium mt-1">
                      {item.tone ||
                        "Not available"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">
                      Audience
                    </p>

                    <p className="font-medium mt-1">
                      {item.audience_cues ||
                        "Not available"}
                    </p>
                  </div>

                </div>

                {/* CAPTIONS */}

                <div>

                  <h3 className="font-semibold mb-3">
                    Generated Captions
                  </h3>

                  <div className="space-y-3">

                    {/* CAPTION 1 */}

                    <div className="border rounded-lg p-4">

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">
                            Caption 1
                          </p>

                          <p className="text-sm">
                            {item.caption_1 ||
                              "No caption"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              item.caption_1 ||
                              "",
                              `${item.id}-caption1`
                            )
                          }
                          className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          {copied ===
                            `${item.id}-caption1`
                            ? "Copied!"
                            : "Copy"}
                        </button>

                      </div>

                    </div>

                    {/* CAPTION 2 */}

                    <div className="border rounded-lg p-4">

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">
                            Caption 2
                          </p>

                          <p className="text-sm">
                            {item.caption_2 ||
                              "No caption"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              item.caption_2 ||
                              "",
                              `${item.id}-caption2`
                            )
                          }
                          className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          {copied ===
                            `${item.id}-caption2`
                            ? "Copied!"
                            : "Copy"}
                        </button>

                      </div>

                    </div>

                    {/* CAPTION 3 */}

                    <div className="border rounded-lg p-4">

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">
                            Caption 3
                          </p>

                          <p className="text-sm">
                            {item.caption_3 ||
                              "No caption"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              item.caption_3 ||
                              "",
                              `${item.id}-caption3`
                            )
                          }
                          className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                        >
                          {copied ===
                            `${item.id}-caption3`
                            ? "Copied!"
                            : "Copy"}
                        </button>

                      </div>

                    </div>

                  </div>

                </div>

                {/* HASHTAGS + CTA */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* HASHTAGS */}

                  <div className="border rounded-lg p-4">

                    <div className="flex items-center justify-between gap-3">

                      <p className="text-sm font-semibold">
                        Hashtags
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            item.hashtags ||
                            "",
                            `${item.id}-hashtags`
                          )
                        }
                        className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        {copied ===
                          `${item.id}-hashtags`
                          ? "Copied!"
                          : "Copy"}
                      </button>

                    </div>

                    <p className="text-sm text-gray-600 mt-3">
                      {item.hashtags ||
                        "No hashtags"}
                    </p>

                  </div>

                  {/* CTA */}

                  <div className="border rounded-lg p-4">

                    <div className="flex items-center justify-between gap-3">

                      <p className="text-sm font-semibold">
                        CTA
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            item.cta || "",
                            `${item.id}-cta`
                          )
                        }
                        className="text-sm border px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      >
                        {copied ===
                          `${item.id}-cta`
                          ? "Copied!"
                          : "Copy"}
                      </button>

                    </div>

                    <p className="text-sm text-gray-600 mt-3">
                      {item.cta ||
                        "No CTA"}
                    </p>

                  </div>

                </div>

                {/* PLATFORM */}

                <div className="rounded-lg bg-gray-50 p-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-xs text-gray-500">
                        Platform Fit
                      </p>

                      <p className="font-medium mt-1">
                        {item.platform_fit ||
                          "Not available"}
                      </p>
                    </div>

                    <span className="text-sm font-semibold">
                      {item.confidence}%
                    </span>

                  </div>

                </div>

              </div>

            )
          )}

        </div>

      )}

    </div>
  );
}