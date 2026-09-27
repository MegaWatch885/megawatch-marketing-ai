import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 border-r p-4">
      <nav className="flex flex-col gap-3">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/content-library">Content Library</Link>
        <Link href="/ai-studio">AI Studio</Link>
        <Link href="/calendar">Calendar</Link>
      </nav>
    </aside>
  );
}