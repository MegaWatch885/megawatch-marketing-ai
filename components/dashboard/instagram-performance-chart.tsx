
    "use client";

    import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    } from "recharts";

    interface PerformancePoint {
    date: string;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    }

    interface InstagramPerformanceChartProps {
    data: PerformancePoint[];
    }

    export default function InstagramPerformanceChart({
    data,
    }: InstagramPerformanceChartProps) {
    const chartData = data.map((item) => ({
        ...item,
        date: new Date(`${item.date}T00:00:00`).toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
        }
        ),
    }));

    return (
        <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
            Instagram Performance Trend
            </h2>
            <p className="mt-1 text-sm text-gray-500">
            Daily views and reach from saved Instagram snapshots
            </p>
        </div>

        {chartData.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center text-center text-sm text-gray-500">
            No performance history available yet. Sync Instagram to collect data.
            </div>
        ) : (
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                data={chartData}
                margin={{
                    top: 10,
                    right: 20,
                    left: 10,
                    bottom: 5,
                }}
                >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="date" />

                <YAxis
                    tickFormatter={(value) =>
                    new Intl.NumberFormat("en-IN", {
                        notation: "compact",
                    }).format(value)
                    }
                />

                <Tooltip
                    formatter={(value, name) => [
                    new Intl.NumberFormat("en-IN").format(
                        Number(value ?? 0)
                    ),
                    String(name),
                    ]}
                />

                <Legend />

                <Line
                    type="monotone"
                    dataKey="views"
                    name="Views"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                />

                <Line
                    type="monotone"
                    dataKey="reach"
                    name="Reach"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                />
                </LineChart>
            </ResponsiveContainer>
            </div>
        )}
        </section>
    );
    }

