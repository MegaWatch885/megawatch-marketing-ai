"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { getScheduledContent, rescheduleContent } from "@/services/content.service";
import Button from "@/components/ui/button";

type ScheduledContent = {
  id: string;
  title: string;
  status: string;
  scheduled_for: string | null;
};

function CalendarPageContent() {
  const router = useRouter();

  const searchParams = useSearchParams();
  const selectedContentId = searchParams.get("contentId");

  const [items, setItems] = useState<ScheduledContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function loadScheduledContent() {
    try {
      setLoading(true);
      setLoadError(false);

      const data = await getScheduledContent();
      setItems(data || []);
    } catch (error) {
      console.error("Calendar load error:", error);
      setItems([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScheduledContent();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const scheduledByDate = useMemo(() => {
    const grouped: Record<string, ScheduledContent[]> = {};

    items.forEach((item) => {
      if (!item.scheduled_for) return;

      const date = new Date(item.scheduled_for).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item);
    });

    return grouped;
  }, [items]);

  function getDateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function previousMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  async function handleReschedule(id: string) {
    if (!newSchedule || savingId) return;

    try {
      setSavingId(id);
      setFeedback(null);

      const selectedDate = new Date(newSchedule);

      if (Number.isNaN(selectedDate.getTime())) {
        setFeedback({
          type: "error",
          message: "Please select a valid date and time.",
        });
        return;
      }

      const scheduledFor = selectedDate.toISOString();
      await rescheduleContent(id, scheduledFor);

      setNewSchedule("");
      setReschedulingId(null);

      await loadScheduledContent();

      setFeedback({
        type: "success",
        message: "Reel rescheduled successfully.",
      });
    } catch (error) {
      console.error("Reschedule error:", error);

      setFeedback({
        type: "error",
        message: "Reschedule failed. Please try again.",
      });
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-9 w-36 rounded-lg bg-gray-200" />
            <div className="h-4 w-56 rounded bg-gray-100 mt-2" />
          </div>
          <div className="h-10 w-20 rounded-lg bg-gray-200" />
        </div>

        <div className="border rounded-xl bg-white p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="h-9 w-9 rounded-lg bg-gray-200" />
            <div className="h-6 w-36 rounded bg-gray-200" />
            <div className="h-9 w-9 rounded-lg bg-gray-200" />
          </div>

          <div className="grid grid-cols-7 border-b">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="p-3">
                <div className="h-4 w-10 mx-auto rounded bg-gray-100" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="min-h-32 border-r border-b p-2">
                <div className="h-4 w-5 rounded bg-gray-200" />
                <div className="h-6 w-full rounded bg-gray-100 mt-3" />
                <div className="h-6 w-4/5 rounded bg-gray-100 mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-md bg-white border rounded-xl p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
            !
          </div>
          <h2 className="text-xl font-semibold mt-4">Calendar unavailable</h2>
          <p className="text-gray-500 mt-2">
            We couldn't load your scheduled content. Please try again.
          </p>
          <div className="mt-5">
            <Button type="button" onClick={loadScheduledContent}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasScheduledContent = items.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calendar</h1>
          <p className="text-gray-500 mt-1">Manage your scheduled Reels</p>
        </div>

        <Button type="button" variant="secondary" onClick={goToToday}>
          Today
        </Button>
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
              {feedback.type === "success"
                ? "Reschedule successful"
                : "Reschedule failed"}
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

      {!hasScheduledContent && (
        <div className="bg-white border rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-semibold">No scheduled Reels yet</h2>
            <p className="text-sm text-gray-500 mt-1">
              Schedule a Reel from its content details page and it will appear here.
            </p>
          </div>
          <Button type="button" onClick={() => router.push("/content-library")}>
            Go to Content Library
          </Button>
        </div>
      )}

      <div className="border rounded-xl bg-white p-4">
        <div className="flex items-center justify-between mb-6">
          <Button type="button" variant="secondary" size="sm" onClick={previousMonth} aria-label="Previous month">
            ←
          </Button>
          <h2 className="text-xl font-semibold">{monthName}</h2>
          <Button type="button" variant="secondary" size="sm" onClick={nextMonth} aria-label="Next month">
            →
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-3 text-center font-semibold text-gray-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-32 border-r border-b bg-gray-50" />;
            }

            const dateKey = getDateKey(day);
            const scheduled = scheduledByDate[dateKey] || [];
            const today = new Date();
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            return (
              <div key={day} className={`min-h-32 border-r border-b p-2 ${isToday ? "bg-blue-50" : "bg-white"}`}>
                <div className={`text-sm font-semibold mb-2 ${isToday ? "text-blue-600" : "text-gray-700"}`}>
                  {day}
                </div>

                <div className="space-y-1">
                  {scheduled.map((item) => {
                    const isSelected = item.id === selectedContentId;

                    return (
                      <div
                        key={item.id}
                        className={`space-y-1 rounded-lg ${isSelected
                          ? "ring-2 ring-purple-500 ring-offset-1"
                          : ""
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => router.push(`/content-library/${item.id}`)}
                          className={`w-full text-left rounded-md px-2 py-1 text-xs ${isSelected
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 hover:bg-blue-200 text-blue-800"
                            }`}
                        >
                          <div className="font-medium truncate">
                            {isSelected ? "🎯 " : "🎬 "}
                            {item.title}
                          </div>
                          <div className="text-blue-600">
                            {new Date(item.scheduled_for!).toLocaleTimeString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </button>


                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(`/content-library/${item.id}`)
                          }
                          className="px-2 py-1 text-xs text-purple-600 hover:text-purple-700"
                        >
                          🎯 Open Content
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setReschedulingId(item.id)}
                          className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          Reschedule
                        </Button>


                        {reschedulingId === item.id && (
                          <div className="bg-white border rounded-md p-2 space-y-2">
                            <input
                              type="datetime-local"
                              value={newSchedule}
                              onChange={(e) => setNewSchedule(e.target.value)}
                              className="w-full border rounded p-1 text-xs"
                            />

                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleReschedule(item.id)}
                                disabled={!newSchedule}
                                loading={savingId === item.id}
                                className="px-2 py-1 text-xs"
                              >
                                Save
                              </Button>

                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setReschedulingId(null);
                                  setNewSchedule("");
                                }}
                                className="px-2 py-1 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-9 w-36 rounded-lg bg-gray-200" />
          <div className="border rounded-xl bg-white p-4">
            <div className="h-8 w-40 rounded bg-gray-200" />
          </div>
        </div>
      }
    >
      <CalendarPageContent />
    </Suspense>
  );
}