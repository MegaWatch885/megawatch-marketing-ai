"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Button from "@/components/ui/button";
import {
    getContentAnalytics,
    getPublishingActivity,
} from "@/services/analytics.service";

import {
    getPerformanceByContentId,
    getPerformanceHistory,
    type ContentPerformance,
} from "@/services/performance.service";

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type AnalyticsData = {
    total: number;
    uploaded: number;
    processing: number;
    ready: number;
    scheduled: number;
    published: number;

    recent: {
        id: string;
        title: string;
        status: string;
        created_at: string;
        scheduled_for: string | null;
        published_at: string | null;


        content_ai?:
        | {
            category: string | null;
            tone: string | null;
            confidence: number | null;
        }
        | {
            category: string | null;
            tone: string | null;
            confidence: number | null;
        }[]
        | null;
    }[];
};

function AnalyticsPageContent() {
    const [analytics, setAnalytics] =
        useState<AnalyticsData | null>(null);

    const [publishingActivity, setPublishingActivity] =
        useState<
            {
                id: string;
                title: string;
                published_at: string | null;
                content_ai?: {
                    category: string | null;
                    tone: string | null;
                    confidence: number | null;
                }[] | null;
            }[]
        >([]);


    const [publishedAI, setPublishedAI] = useState<{
        analyzed: number;
        averageConfidence: number;
        topCategory: string | null;
        topTone: string | null;
    }>({
        analyzed: 0,
        averageConfidence: 0,
        topCategory: null,
        topTone: null,
    });

    const [selectedPerformance, setSelectedPerformance] = useState<{
        id: string;
        title: string;
        published_at: string | null;
        category: string | null;
        tone: string | null;
        confidence: number | null;
    } | null>(null);

    const [performanceData, setPerformanceData] = useState<
        ContentPerformance[]
    >([]);

    const [performanceHistory, setPerformanceHistory] = useState<
        ContentPerformance[]
    >([]);


    const [loading, setLoading] = useState(true);

    const searchParams = useSearchParams();
    const selectedContentId = searchParams.get("contentId");

    async function loadAnalytics() {
        try {
            setLoading(true);

            const [analyticsData, publishingData] =
                await Promise.all([
                    getContentAnalytics(),
                    getPublishingActivity(),
                ]);

            setAnalytics(analyticsData);
            setPublishingActivity(publishingData);

            console.log("Publishing Data:", publishingData);

            const analyzedItems = publishingData
                .map((item) => ({
                    ...item,
                    ai: Array.isArray(item.content_ai)
                        ? item.content_ai[0]
                        : item.content_ai,
                }))
                .filter(
                    (item) =>
                        item.ai &&
                        typeof item.ai.confidence === "number"
                );

            const confidenceTotal = analyzedItems.reduce(
                (sum, item) => sum + (item.ai?.confidence ?? 0),
                0
            );

            const categoryCounts: Record<string, number> = {};
            const toneCounts: Record<string, number> = {};

            analyzedItems.forEach((item) => {
                const category = item.ai?.category;
                const tone = item.ai?.tone;

                if (category) {
                    categoryCounts[category] =
                        (categoryCounts[category] || 0) + 1;
                }

                if (tone) {
                    toneCounts[tone] =
                        (toneCounts[tone] || 0) + 1;
                }
            });

            const topCategory =
                Object.entries(categoryCounts).sort(
                    (a, b) => b[1] - a[1]
                )[0]?.[0] ?? null;

            const topTone =
                Object.entries(toneCounts).sort(
                    (a, b) => b[1] - a[1]
                )[0]?.[0] ?? null;

            setPublishedAI({
                analyzed: analyzedItems.length,
                averageConfidence:
                    analyzedItems.length > 0
                        ? Math.round(confidenceTotal / analyzedItems.length)
                        : 0,
                topCategory,
                topTone,
            });

            if (selectedContentId) {
                const selected = publishingData.find(
                    (item) => item.id === selectedContentId
                );

                console.log("Selected Published Item:", selected);

                if (selected) {
                    const ai = Array.isArray(selected.content_ai)
                        ? selected.content_ai[0]
                        : selected.content_ai;

                    setSelectedPerformance({
                        id: selected.id,
                        title: selected.title,
                        published_at: selected.published_at,
                        category: ai?.category ?? null,
                        tone: ai?.tone ?? null,
                        confidence: ai?.confidence ?? null,
                    });
                }
            }

            if (selectedContentId) {
                try {
                    const [performance, history] = await Promise.all([
                        getPerformanceByContentId(selectedContentId),
                        getPerformanceHistory(selectedContentId),
                    ]);

                    setPerformanceData(performance);
                    setPerformanceHistory(history);

                    console.log(
                        "Selected Content Performance:",
                        performance
                    );

                    console.log(
                        "Selected Content Performance History:",
                        history
                    );
                } catch (error) {
                    console.error(
                        "Failed to load performance data:",
                        error
                    );

                    setPerformanceData([]);
                    setPerformanceHistory([]);
                }
            } else {
                setPerformanceData([]);
                setPerformanceHistory([]);
            }
        }
        catch (error) {
            console.error("Analytics load error:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div>
                    <div className="h-9 w-32 rounded-lg bg-gray-200" />
                    <div className="h-4 w-72 rounded bg-gray-100 mt-2" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div
                            key={index}
                            className="border rounded-xl p-6 bg-white"
                        >
                            <div className="h-4 w-24 rounded bg-gray-200" />
                            <div className="h-9 w-14 rounded bg-gray-200 mt-3" />
                        </div>
                    ))}
                </div>

                <div className="border rounded-xl p-6 bg-white">
                    <div className="h-6 w-40 rounded bg-gray-200" />
                    <div className="space-y-4 mt-5">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="border-b pb-3">
                                <div className="h-4 w-48 rounded bg-gray-200" />
                                <div className="h-3 w-40 rounded bg-gray-100 mt-2" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border rounded-xl p-6 bg-white">
                    <div className="h-6 w-56 rounded bg-gray-200" />
                    <div className="space-y-4 mt-5">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="border-b pb-3">
                                <div className="h-4 w-48 rounded bg-gray-200" />
                                <div className="h-3 w-36 rounded bg-gray-100 mt-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="w-full max-w-md bg-white border rounded-xl p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
                        !
                    </div>
                    <h2 className="text-xl font-semibold mt-4">
                        Analytics unavailable
                    </h2>
                    <p className="text-gray-500 mt-2">
                        We couldn't load your analytics data. Please try again.
                    </p>
                    <div className="mt-5">
                        <Button type="button" onClick={loadAnalytics}>
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const cards = [
        { title: "Total Reels", value: analytics.total },
        { title: "Uploaded", value: analytics.uploaded },
        { title: "Processing", value: analytics.processing },
        { title: "Ready", value: analytics.ready },
        { title: "Scheduled", value: analytics.scheduled },
        { title: "Published", value: analytics.published },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Analytics</h1>
                <p className="text-gray-500 mt-1">
                    Overview of your content performance
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                    <div key={card.title} className="border rounded-xl p-6 bg-white">
                        <p className="text-gray-500">{card.title}</p>
                        <p className="text-3xl font-bold mt-2">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Published AI Performance*/}

            {publishedAI.analyzed > 0 && (
                <div className="mt-6">
                    <h2 className="text-lg font-semibold mb-3">
                        🧠 Published AI Performance
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="rounded-xl border bg-white p-5">
                            <p className="text-sm text-gray-500">
                                AI Analyzed
                            </p>
                            <p className="text-2xl font-bold mt-1">
                                {publishedAI.analyzed}
                            </p>
                        </div>

                        <div className="rounded-xl border bg-white p-5">
                            <p className="text-sm text-gray-500">
                                Avg Confidence
                            </p>
                            <p className="text-2xl font-bold mt-1">
                                {publishedAI.averageConfidence}%
                            </p>
                        </div>

                        <div className="rounded-xl border bg-white p-5">
                            <p className="text-sm text-gray-500">
                                Top Category
                            </p>
                            <p className="text-lg font-semibold mt-1">
                                {publishedAI.topCategory || "—"}
                            </p>
                        </div>

                        <div className="rounded-xl border bg-white p-5">
                            <p className="text-sm text-gray-500">
                                Top Tone
                            </p>
                            <p className="text-lg font-semibold mt-1">
                                {publishedAI.topTone || "—"}
                            </p>
                        </div>
                    </div>
                </div>
            )}


            {/* Selected Published Content */}

            {selectedPerformance && (
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                                🎯 Selected Published Content
                            </p>

                            <h2 className="text-xl font-bold mt-1">
                                {selectedPerformance.title}
                            </h2>

                            {selectedPerformance.published_at && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Published{" "}
                                    {new Date(
                                        selectedPerformance.published_at
                                    ).toLocaleString("en-IN", {
                                        timeZone: "Asia/Kolkata",
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                    })}{" "}
                                    (IST)
                                </p>
                            )}
                        </div>

                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">
                            🚀 Published
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                        <div className="rounded-lg bg-gray-50 border p-4">
                            <p className="text-xs text-gray-500">
                                AI Category
                            </p>
                            <p className="font-semibold mt-1">
                                {selectedPerformance.category || "—"}
                            </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 border p-4">
                            <p className="text-xs text-gray-500">
                                AI Tone
                            </p>
                            <p className="font-semibold mt-1">
                                {selectedPerformance.tone || "—"}
                            </p>
                        </div>

                        <div className="rounded-lg bg-gray-50 border p-4">
                            <p className="text-xs text-gray-500">
                                AI Confidence
                            </p>
                            <p className="font-semibold mt-1">
                                {selectedPerformance.confidence ?? 0}%
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-lg border bg-purple-50 p-4">
                        <p className="text-sm font-semibold text-purple-800">
                            📊 Performance Tracking
                        </p>

                        <p className="text-sm text-purple-700 mt-1">
                            This content is published and ready for external
                            platform performance data.
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="text-xs px-3 py-1 rounded-full bg-white border text-gray-600">
                                🚀 Published
                            </span>

                            <span className="text-xs px-3 py-1 rounded-full bg-white border text-gray-600">
                                🧠 AI Analyzed
                            </span>

                            <span className="text-xs px-3 py-2 rounded-lg bg-purple-100 text-purple-700">
                                {performanceData.length > 0
                                    ? `📈 ${performanceData.length} Performance Record${performanceData.length > 1 ? "s" : ""
                                    }`
                                    : "📈 Metrics Pending"}
                            </span>
                        </div>
                    </div>

                    {selectedPerformance && (
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="rounded-lg border bg-white p-4">
                                <p className="text-xs text-gray-500">Views</p>
                                <p className="text-2xl font-bold mt-1">
                                    {performanceData.length > 0
                                        ? performanceData[0].views.toLocaleString()
                                        : "—"}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <p className="text-xs text-gray-500">Likes</p>
                                <p className="text-2xl font-bold mt-1">
                                    {performanceData.length > 0
                                        ? performanceData[0].likes.toLocaleString()
                                        : "—"}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <p className="text-xs text-gray-500">Comments</p>
                                <p className="text-2xl font-bold mt-1">
                                    {performanceData.length > 0
                                        ? performanceData[0].comments.toLocaleString()
                                        : "—"}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <p className="text-xs text-gray-500">Shares</p>
                                <p className="text-2xl font-bold mt-1">
                                    {performanceData.length > 0
                                        ? performanceData[0].shares.toLocaleString()
                                        : "—"}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <p className="text-xs text-gray-500">Saves</p>
                                <p className="text-2xl font-bold mt-1">
                                    {performanceData.length > 0
                                        ? performanceData[0].saves.toLocaleString()
                                        : "—"}
                                </p>
                            </div>

                            <div className="rounded-lg border bg-white p-4">
                                <p className="text-xs text-gray-500">Engagement Rate</p>
                                <p className="text-2xl font-bold mt-1">
                                    {performanceData.length > 0
                                        ? `${Number(
                                            performanceData[0].engagement_rate
                                        ).toFixed(2)}%`
                                        : "—"}
                                </p>
                            </div>
                        </div>
                    )}



                    {selectedPerformance && performanceHistory.length > 0 && (
                        <div className="mt-6">
                            <div className="rounded-lg border bg-white p-5">
                                <h3 className="text-lg font-semibold">
                                    📈 Views Growth
                                </h3>

                                <p className="text-sm text-gray-500 mt-1 mb-4">
                                    Views growth across recorded performance snapshots.
                                </p>

                                <div className="w-full">
                                    <div className="h-[320px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={performanceHistory.map((snapshot) => ({
                                                    date: new Date(
                                                        snapshot.recorded_at
                                                    ).toLocaleDateString(),
                                                    views: snapshot.views,
                                                }))}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="date" />
                                                <YAxis />
                                                <Tooltip />
                                                <Line
                                                    type="monotone"
                                                    dataKey="views"
                                                    strokeWidth={2}
                                                    dot={{ r: 4 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedPerformance && performanceHistory.length > 0 && (
                        <div className="mt-6 rounded-lg border bg-white p-5">
                            <h3 className="text-lg font-semibold">
                                📊 Engagement Rate Trend
                            </h3>

                            <p className="text-sm text-gray-500 mt-1 mb-4">
                                Engagement rate across recorded performance snapshots.
                            </p>

                            <div className="h-[320px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={performanceHistory.map((snapshot) => ({
                                            date: new Date(
                                                snapshot.recorded_at
                                            ).toLocaleDateString(),
                                            engagementRate: Number(
                                                snapshot.engagement_rate
                                            ),
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />

                                        <XAxis dataKey="date" />

                                        <YAxis
                                            tickFormatter={(value) => `${value}%`}
                                        />

                                        <Tooltip
                                            formatter={(value) =>
                                                `${Number(value).toFixed(2)}%`
                                            }
                                        />

                                        <Line
                                            type="monotone"
                                            dataKey="engagementRate"
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {selectedPerformance && performanceHistory.length >= 2 && (
                        <div className="mt-6 rounded-lg border bg-white p-5">
                            <h3 className="text-lg font-semibold">
                                🧠 Performance Insights
                            </h3>

                            <p className="text-sm text-gray-500 mt-1 mb-4">
                                Growth insights based on recorded performance snapshots.
                            </p>

                            {(() => {
                                const first = performanceHistory[0];
                                const latest = performanceHistory[performanceHistory.length - 1];
                                const firstViews = Number(first.views) || 0;
                                const latestViews = Number(latest.views) || 0;
                                const firstEngagement = Number(first.engagement_rate) || 0;
                                const latestEngagement = Number(latest.engagement_rate) || 0;
                                const viewsGrowth = firstViews > 0 ? ((latestViews - firstViews) / firstViews) * 100 : null;
                                const engagementChange = latestEngagement - firstEngagement;
                                const trend = engagementChange > 0.1 ? "Improving" : engagementChange < -0.1 ? "Declining" : "Stable";

                                const trendClass =
                                    trend === "Improving"
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : trend === "Declining"
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : "bg-gray-50 text-gray-700 border-gray-200";

                                return (
                                    <div className="space-y-4">
                                        <div
                                            className={`inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium ${trendClass}`}
                                        >
                                            {trend === "Improving"
                                                ? "📈"
                                                : trend === "Declining"
                                                    ? "📉"
                                                    : "➖"}{" "}
                                            {trend}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="rounded-lg bg-gray-50 border p-4">
                                                <p className="text-xs text-gray-500">
                                                    Views Growth
                                                </p>

                                                <p className={`text-2xl font-bold mt-1 
                                                ${viewsGrowth === null || viewsGrowth === 0 ? "text-gray-700" : viewsGrowth > 0 ? "text-green-600" : "text-red-600"}`}
                                                > {viewsGrowth === null ? "N/A" : `${viewsGrowth > 0 ? "+" : ""}
                                                 ${viewsGrowth.toFixed(1)}%`}

                                                </p>

                                                <p className="text-sm text-gray-600 mt-1">
                                                    From the first recorded snapshot to the latest.
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-gray-50 border p-4">
                                                <p className="text-xs text-gray-500">
                                                    Engagement Change
                                                </p>

                                                <p className={`text-2xl font-bold mt-1 ${engagementChange > 0.1 ? "text-green-600" : engagementChange < -0.1 ? "text-red-600" : "text-gray-700"}`}
                                                > {engagementChange >= 0 ? "+" : ""} {engagementChange.toFixed(2)}

                                                </p>

                                                <p className="text-sm text-gray-600 mt-1">
                                                    Percentage-point change in engagement rate.
                                                </p>
                                            </div>


                                        </div>


                                        <div className="rounded-lg border bg-blue-50 p-4">
                                            <p className="text-sm font-semibold text-blue-900">
                                                📌 Performance Summary
                                            </p>


                                            <p className="text-sm text-blue-800 mt-2">
                                                {viewsGrowth === null
                                                    ? "View growth cannot be calculated because the first snapshot has zero views."
                                                    : viewsGrowth > 0
                                                        ? "Your content is gaining views"
                                                        : viewsGrowth < 0
                                                            ? "Your content views are declining"
                                                            : "Your content views are unchanged"}
                                                <>
                                                    {" Engagement is "}
                                                    {trend === "Improving"
                                                        ? "improving."
                                                        : trend === "Declining"
                                                            ? "declining."
                                                            : "relatively stable."}
                                                </>
                                            </p>


                                        </div>


                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {selectedPerformance && performanceHistory.length > 0 && (
                        <div className="mt-6 rounded-lg border bg-white p-5">
                            <div className="mb-4">
                                <h3 className="text-lg font-semibold">
                                    📈 Performance History
                                </h3>

                                <p className="text-sm text-gray-500 mt-1">
                                    Historical performance snapshots for this published content.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left">
                                            <th className="pb-3 pr-4">Date</th>
                                            <th className="pb-3 pr-4">Views</th>
                                            <th className="pb-3 pr-4">Likes</th>
                                            <th className="pb-3 pr-4">Comments</th>
                                            <th className="pb-3 pr-4">Shares</th>
                                            <th className="pb-3 pr-4">Saves</th>
                                            <th className="pb-3">Engagement</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {performanceHistory.map((snapshot) => (
                                            <tr
                                                key={snapshot.id}
                                                className="border-b last:border-0"
                                            >
                                                <td className="py-3 pr-4 whitespace-nowrap">
                                                    {new Date(
                                                        snapshot.recorded_at
                                                    ).toLocaleDateString()}
                                                </td>

                                                <td className="py-3 pr-4">
                                                    {snapshot.views.toLocaleString()}
                                                </td>

                                                <td className="py-3 pr-4">
                                                    {snapshot.likes.toLocaleString()}
                                                </td>

                                                <td className="py-3 pr-4">
                                                    {snapshot.comments.toLocaleString()}
                                                </td>

                                                <td className="py-3 pr-4">
                                                    {snapshot.shares.toLocaleString()}
                                                </td>

                                                <td className="py-3 pr-4">
                                                    {snapshot.saves.toLocaleString()}
                                                </td>

                                                <td className="py-3">
                                                    {Number(
                                                        snapshot.engagement_rate
                                                    ).toFixed(2)}
                                                    %
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            )
            }

            <div className="border rounded-xl p-6 bg-white">
                <h2 className="text-xl font-semibold mb-4">Recent Content</h2>

                {analytics.recent.length === 0 ? (
                    <div className="py-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
                            🎬
                        </div>
                        <p className="font-medium mt-3">No content yet</p>
                        <p className="text-gray-500 text-sm mt-1">
                            Your recent content activity will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {analytics.recent.map((item) => (
                            <div key={item.id} className="flex items-center justify-between border-b pb-3">
                                <div>
                                    <p className="font-medium">{item.title}</p>
                                    <p className="text-sm text-gray-500">
                                        Created {new Date(item.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                                    </p>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-gray-100 text-sm">
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="border rounded-xl p-6 bg-white">
                <h2 className="text-xl font-semibold mb-4">Recent Published Content</h2>

                {publishingActivity.length === 0 ? (
                    <div className="py-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
                            📢
                        </div>
                        <p className="font-medium mt-3">No published content yet</p>
                        <p className="text-gray-500 text-sm mt-1">
                            Published reels will appear here after they go live.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {publishingActivity.map((item) => {
                            const ai = Array.isArray(item.content_ai)
                                ? item.content_ai[0]
                                : null;

                            return (
                                <div
                                    key={item.id}
                                    className={
                                        item.id === selectedContentId
                                            ? "ring-2 ring-purple-500 ring-offset-2 rounded-xl"
                                            : ""
                                    }
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div>

                                            {item.id === selectedContentId && (
                                                <div className="mb-2 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                                                    🎯 Selected from AI Studio · Performance View
                                                </div>
                                            )}
                                            <p className="font-medium">{item.title}</p>

                                            <p className="text-sm text-gray-500 mt-1">
                                                Published{" "}
                                                {item.published_at
                                                    ? new Date(item.published_at).toLocaleString(
                                                        "en-IN",
                                                        {
                                                            timeZone: "Asia/Kolkata",
                                                            dateStyle: "medium",
                                                            timeStyle: "short",
                                                        }
                                                    )
                                                    : "Unknown"}
                                            </p>
                                        </div>

                                        <Link
                                            href={`/content-library/${item.id}`}
                                            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition text-center"
                                        >
                                            📊 View Performance
                                        </Link>
                                    </div>

                                    {ai && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {ai.category && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                                                    🎬 {ai.category}
                                                </span>
                                            )}

                                            {ai.tone && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700">
                                                    🎭 {ai.tone}
                                                </span>
                                            )}

                                            {typeof ai.confidence === "number" && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">
                                                    🤖 {ai.confidence}% AI confidence
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div >
    );
}

export default function AnalyticsPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-6 animate-pulse">
                    <div className="h-9 w-40 rounded-lg bg-gray-200" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="h-28 rounded-xl bg-gray-200" />
                        <div className="h-28 rounded-xl bg-gray-200" />
                        <div className="h-28 rounded-xl bg-gray-200" />
                    </div>
                </div>
            }
        >
            <AnalyticsPageContent />
        </Suspense>
    );
}