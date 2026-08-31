"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMail } from "@/context/MailContext";

const FOLDERS = ["inbox", "starred", "sent", "drafts", "archive", "spam", "trash"];

export default function TopBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openCompose } = useMail();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/mail/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="h-14 flex items-center px-4 gap-3">
        <form onSubmit={handleSubmit} className="flex-1 max-w-xl">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mail — sender, subject, or keyword"
            className="w-full rounded bg-accentSoft/70 border border-transparent focus-visible:outline-accent focus-visible:bg-white px-3 py-2 text-sm"
          />
        </form>
        <button
          onClick={() => openCompose()}
          className="sm:hidden shrink-0 rounded bg-accent text-white text-sm font-medium px-3 py-2"
        >
          Compose
        </button>
      </div>

      {/* Folder switcher for small screens, where the sidebar is hidden */}
      <div className="sm:hidden flex gap-1 overflow-x-auto px-3 pb-2">
        {FOLDERS.map((f) => (
          <button
            key={f}
            onClick={() => router.push(`/mail/${f}`)}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-ink capitalize hover:bg-accentSoft"
          >
            {f}
          </button>
        ))}
      </div>
    </header>
  );
}
