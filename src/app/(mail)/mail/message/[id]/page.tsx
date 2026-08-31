"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMail } from "@/context/MailContext";

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface MessageDetail {
  id: string;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  isStarred: boolean;
  isRead: boolean;
  folder: string;
  sentAt: string;
  threadId: string;
  attachments: Attachment[];
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function MessagePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { openCompose, notifyChanged } = useMail();
  const [message, setMessage] = useState<MessageDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages/${params.id}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setMessage(data.message);
        if (!data.message.isRead) {
          fetch(`/api/messages/${params.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
          }).then(() => notifyChanged());
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function patch(data: Record<string, unknown>) {
    if (!message) return;
    const res = await fetch(`/api/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    setMessage(json.message);
    notifyChanged();
  }

  async function moveTo(folder: string) {
    await patch({ folder });
    router.push(`/mail/${folder.toLowerCase()}`);
  }

  async function handleDelete() {
    if (!message) return;
    await fetch(`/api/messages/${message.id}`, { method: "DELETE" });
    notifyChanged();
    router.push(message.folder === "TRASH" ? "/mail/trash" : "/mail/inbox");
  }

  function reply(all: boolean) {
    if (!message) return;
    const to = [message.fromAddress];
    const cc = all ? message.ccAddresses.filter((a) => a !== message.fromAddress) : [];
    openCompose({
      to,
      cc,
      subject: message.subject.startsWith("Re: ") ? message.subject : `Re: ${message.subject}`,
      bodyText: `\n\n---\nOn ${new Date(message.sentAt).toLocaleString()}, ${
        message.fromName || message.fromAddress
      } wrote:\n${message.bodyText}`,
      threadId: message.threadId,
      inReplyToId: message.id,
    });
  }

  function forward() {
    if (!message) return;
    openCompose({
      to: [],
      subject: message.subject.startsWith("Fwd: ") ? message.subject : `Fwd: ${message.subject}`,
      bodyText: `\n\n---------- Forwarded message ----------\nFrom: ${
        message.fromName || message.fromAddress
      }\nSubject: ${message.subject}\n\n${message.bodyText}`,
      threadId: message.threadId,
    });
  }

  if (notFound) {
    return <div className="p-8 text-sm text-muted">This message doesn't exist or was deleted.</div>;
  }
  if (!message) {
    return <div className="p-8 text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => router.back()} className="text-sm text-muted hover:text-ink">
          ← Back
        </button>
        <div className="flex-1" />
        <button onClick={() => patch({ isStarred: !message.isStarred })} className="text-sm text-muted hover:text-ink">
          {message.isStarred ? "★ Starred" : "☆ Star"}
        </button>
        <button onClick={() => patch({ isRead: false })} className="text-sm text-muted hover:text-ink">
          Mark unread
        </button>
        {message.folder !== "ARCHIVE" && (
          <button onClick={() => moveTo("ARCHIVE")} className="text-sm text-muted hover:text-ink">
            Archive
          </button>
        )}
        {message.folder !== "SPAM" ? (
          <button onClick={() => moveTo("SPAM")} className="text-sm text-muted hover:text-ink">
            Mark as spam
          </button>
        ) : (
          <button onClick={() => moveTo("INBOX")} className="text-sm text-muted hover:text-ink">
            Not spam
          </button>
        )}
        <button onClick={handleDelete} className="text-sm text-flag hover:opacity-80">
          Delete
        </button>
      </div>

      <h1 className="font-display text-2xl text-ink mb-3">{message.subject || "(no subject)"}</h1>

      <div className="flex items-start justify-between border-b border-line pb-4 mb-4">
        <div>
          <p className="text-sm text-ink font-medium">
            {message.fromName || message.fromAddress}{" "}
            <span className="text-muted font-normal">&lt;{message.fromAddress}&gt;</span>
          </p>
          <p className="text-xs text-muted">
            to {message.toAddresses.join(", ")}
            {message.ccAddresses.length > 0 && `, cc ${message.ccAddresses.join(", ")}`}
          </p>
        </div>
        <p className="text-xs text-muted shrink-0 ml-3">
          {new Date(message.sentAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      <div className="text-sm text-ink whitespace-pre-wrap leading-relaxed mb-6">{message.bodyText}</div>

      {message.attachments.length > 0 && (
        <div className="mb-6">
          <p className="text-xs text-muted mb-2">{message.attachments.length} attachment(s)</p>
          <ul className="flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <li key={a.id}>
                <a
                  href={`/api/attachments/${a.id}`}
                  className="flex items-center gap-2 text-xs bg-accentSoft rounded px-3 py-2 hover:opacity-80"
                >
                  <span>📎 {a.filename}</span>
                  <span className="text-muted">{formatBytes(a.sizeBytes)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-line">
        <button
          onClick={() => reply(false)}
          className="rounded border border-line px-4 py-2 text-sm hover:bg-accentSoft"
        >
          Reply
        </button>
        <button
          onClick={() => reply(true)}
          className="rounded border border-line px-4 py-2 text-sm hover:bg-accentSoft"
        >
          Reply all
        </button>
        <button
          onClick={forward}
          className="rounded border border-line px-4 py-2 text-sm hover:bg-accentSoft"
        >
          Forward
        </button>
      </div>
    </div>
  );
}
