"use client";

import { useEffect, useState } from "react";

import {
  getContent,
} from "@/services/content.service";

import ContentCard from "@/components/content/content-card";

export default function ContentLibraryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  async function loadData() {
    const data = await getContent();

    setItems(data || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = items.filter(
    (item) =>
      item.title
        ?.toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Content Library
          </h1>

          <p className="text-gray-500">
            Manage uploaded reels
          </p>
        </div>

        <button
          className="bg-black text-white px-4 py-2 rounded-lg"
        >
          + Upload Reel
        </button>
      </div>

      <input
        type="text"
        placeholder="Search content..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        className="border p-3 rounded-lg w-full"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 bg-white">
          <p className="text-sm text-gray-500">
            Total Content
          </p>

          <h2 className="text-2xl font-bold">
            {items.length}
          </h2>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border rounded-xl p-10 text-center">
          <h2 className="text-xl font-semibold">
            No Content Yet
          </h2>

          <p className="text-gray-500 mt-2">
            Upload your first Reel.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
            />
          ))}
        </div>
      )}
    </div>
  );
}