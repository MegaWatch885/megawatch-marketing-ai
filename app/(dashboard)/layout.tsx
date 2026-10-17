"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between border-b bg-white px-4 py-3">
        <div>
          <h1 className="font-bold">MegaWatch</h1>
          <p className="text-xs text-gray-500">Social Handle</p>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg border px-3 py-2 text-lg"
          aria-label="Toggle navigation"
        >
          ☰
        </button>
      </header>

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Overlay */}
            <button
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            />

            {/* Sidebar */}
            <div className="relative z-10 h-full w-64 bg-white shadow-xl">
              <div className="flex justify-end p-3">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg border px-3 py-2"
                  aria-label="Close navigation"
                >
                  ✕
                </button>
              </div>

              <Sidebar />
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}