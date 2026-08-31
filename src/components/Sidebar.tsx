"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMail } from "@/context/MailContext";

const FOLDERS: { key: string; label: string }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "starred", label: "Starred" },
  { key: "sent", label: "Sent" },
  { key: "drafts", label: "Drafts" },
  { key: "archive", label: "Archive" },
  { key: "spam", label: "Spam" },
  { key: "trash", label: "Trash" },
];

export default function Sidebar({ displayName, email }: { displayName: string; email: string }) {
  const pathname = usePathname();
  const { openCompose } = useMail();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="w-56 shrink-0 border-r border-line bg-paper h-full flex flex-col">
      <div className="px-4 pt-5 pb-4">
        <span className="font-display text-xl text-ink">Postbox</span>
      </div>

      <div className="px-3 pb-4">
        <button
          onClick={() => openCompose()}
          className="w-full rounded bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90"
        >
          Compose
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {FOLDERS.map((f) => {
          const active = pathname === `/mail/${f.key}`;
          return (
            <Link
              key={f.key}
              href={`/mail/${f.key}`}
              className={`block rounded px-3 py-2 text-sm ${
                active ? "bg-accentSoft text-accent font-medium" : "text-ink hover:bg-accentSoft/60"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-line">
        <p className="text-sm text-ink truncate">{displayName}</p>
        <p className="text-xs text-muted truncate mb-2">{email}</p>
        <button onClick={handleLogout} className="text-xs text-accent underline">
          Sign out
        </button>
      </div>
    </aside>
  );
}
