"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMail } from "@/context/MailContext";

interface MessageRow {
  id: string;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  subject: string;
  bodyText: string;
  isRead: boolean;
  isStarred: boolean;
  folder: string;
  sentAt: string;
  attachments: { id: string }[];
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessageList({
  folder,
  q,
  starredOnly,
}: {
  folder?: string;
  q?: string;
  starredOnly?: boolean;
}) {
  const router = useRouter();
  const { refreshToken, notifyChanged, openCompose } = useMail();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (folder) params.set("folder", folder.toUpperCase());
    if (q) params.set("q", q);
    if (starredOnly) params.set("starred", "1");
    setLoading(true);
    fetch(`/api/messages?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []))
      .finally(() => setLoading(false));
  }, [folder, q, starredOnly, refreshToken]);

  async function toggleStar(e: React.MouseEvent, m: MessageRow) {
    e.stopPropagation();
    const next = !m.isStarred;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, isStarred: next } : x)));
    await fetch(`/api/messages/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: next }),
    });
  }

  function openMessage(m: MessageRow) {
    if (m.folder === "DRAFTS") {
      openCompose({
        draftId: m.id,
        to: m.toAddresses,
        subject: m.subject,
        bodyText: m.bodyText,
      });
      return;
    }
    router.push(`/mail/message/${m.id}`);
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted">Loading…</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="p-16 text-center">
        <p className="text-ink text-sm font-medium mb-1">Nothing here</p>
        <p className="text-muted text-sm">
          {q ? "No messages match that search." : "This folder is empty."}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {messages.map((m) => {
        const displayName =
          folder === "sent" ? m.toAddresses.join(", ") : m.fromName || m.fromAddress;
        return (
          <li
            key={m.id}
            onClick={() => openMessage(m)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accentSoft/40 ${
              !m.isRead ? "bg-white" : "bg-paper"
            }`}
          >
            <button
              onClick={(e) => toggleStar(e, m)}
              aria-label={m.isStarred ? "Unstar message" : "Star message"}
              className={`shrink-0 text-lg leading-none ${m.isStarred ? "text-flag" : "text-line"}`}
            >
              ★
            </button>
            <div className="min-w-0 flex-1 flex items-baseline gap-3">
              <span
                className={`w-48 shrink-0 truncate text-sm ${
                  !m.isRead ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                {displayName}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className={!m.isRead ? "font-semibold text-ink" : "text-ink"}>
                  {m.subject || "(no subject)"}
                </span>
                <span className="text-muted"> — {m.bodyText.slice(0, 80)}</span>
              </span>
              {m.attachments.length > 0 && (
                <span className="shrink-0 text-muted text-xs">📎</span>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted w-16 text-right">
              {formatDate(m.sentAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
