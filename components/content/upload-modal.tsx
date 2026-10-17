"use client";

import { useState } from "react";

import Button from "@/components/ui/button";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (
    title: string,
    file: File
  ) => Promise<void>;
}

export default function UploadModal({
  open,
  onClose,
  onUpload,
}: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (!file || loading) return;

    try {
      setError(null);
      setLoading(true);

      const uploadTitle =
        title.trim() || file.name;

      await onUpload(
        uploadTitle,
        file
      );

      setTitle("");
      setFile(null);
      setError(null);

      onClose();
    } catch (error) {
      console.error(
        "Upload modal error:",
        error
      );

      setError(
        "Upload failed. Please check the file and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0] || null;

    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.type.startsWith("video/")) {
      setFile(null);
      setError(
        "Please select a valid video file."
      );
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  }

  function handleClose() {
    if (loading) return;

    setTitle("");
    setFile(null);
    setError(null);

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
      >
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="upload-modal-title"
                className="text-xl font-bold"
              >
                Upload New Reel
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Add a video to your content library.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              aria-label="Close upload modal"
              className="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {error && (
          <div
            className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
            role="alert"
          >
            <div>
              <p className="text-sm font-medium">
                Upload failed
              </p>
              <p className="mt-1 text-xs">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setError(null)}
              disabled={loading}
              aria-label="Dismiss upload error"
              className="rounded-md px-1.5 py-0.5 text-sm hover:bg-red-100 disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label
              htmlFor="reel-title"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Video Title
            </label>

            <input
              id="reel-title"
              type="text"
              placeholder="Enter video title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              disabled={loading}
              className="w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2 focus:ring-black/20 disabled:bg-gray-100"
            />
          </div>

          {/* File */}
          <div>
            <label
              htmlFor="reel-file"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Video File
            </label>

            <input
              id="reel-file"
              type="file"
              accept="video/*"
              disabled={loading}
              onChange={handleFileChange}
              className="w-full text-sm"
            />

            {file && (
              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                <p className="truncate text-xs font-medium text-gray-700">
                  {file.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            loading={loading}
            disabled={!file}
          >
            Upload Reel
          </Button>
        </div>
      </div>
    </div>
  );
}
