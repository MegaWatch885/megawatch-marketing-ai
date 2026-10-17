
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    label: "Content Library",
    href: "/content-library",
  },
  {
    label: "AI Studio",
    href: "/ai-studio",
  },
  {
    label: "Calendar",
    href: "/calendar",
  },
  {
    label: "Analytics",
    href: "/analytics",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Logout failed. Please try again."
      );
      setLoggingOut(false);
    }
  }

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r bg-white p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold">MegaWatch</h2>
        <p className="text-sm text-gray-500">Social Handle</p>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-4 py-3 transition ${
                isActive
                  ? "bg-black font-medium text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t pt-4">
        {logoutError && (
          <p className="mb-3 break-words text-sm text-red-600">
            {logoutError}
          </p>
        )}

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}

