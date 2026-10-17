"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(
        "If an account exists for this email, a password reset link will be sent. Check your inbox and spam folder."
      );
    } catch {
      setError("Unable to send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-lg"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Forgot Password?
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter your email to request a password reset link.
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
          <p
            role="status"
            className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
          >
            {success}
          </p>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <p className="text-center text-sm text-gray-600">
          Remember your password?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

