
"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (!sessionData.session) {
        setError(
          "Your reset session is missing or expired. Please request a new password reset link."
        );
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-lg"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Choose a new password for your account.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {success && (
          <div
            role="status"
            className="space-y-3 rounded-lg bg-green-50 p-3 text-sm text-green-700"
          >
            <p>Your password has been updated successfully.</p>
            <Link
              href="/login"
              className="inline-block font-semibold underline"
            >
              Go to Login
            </Link>
          </div>
        )}

        {!success && (
          <>
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                New Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
                placeholder="Enter password again"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

