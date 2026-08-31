"use client";

import { useEffect, useRef, useState } from "react";
import { useMail } from "@/context/MailContext";

interface AttachmentRef {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

function parseAddresses(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ComposeModal() {
  const { composeOpen, composePrefill, closeCompose, notifyChanged } = useMail();
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [to, setTo] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!composeOpen) return;
    setDraftId(composePrefill?.draftId);
    setTo((composePrefill?.to ?? []).join(", "));
    setCc((composePrefill?.cc ?? []).join(", "));
    setBcc((composePrefill?.bcc ?? []).join(", "));
    setShowCcBcc(Boolean(composePrefill?.cc?.length || composePrefill?.bcc?.length));
    setSubject(composePrefill?.subject ?? "");
    setBody(composePrefill?.bodyText ?? "");
    setAttachments([]);
    setError(null);
  }, [composeOpen, composePrefill]);

  if (!composeOpen) return null;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/attachments/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        setAttachments((prev) => [...prev, data]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(storageKey: string) {
    setAttachments((prev) => prev.filter((a) => a.storageKey !== storageKey));
  }

  async function saveDraftAndClose() {
    const hasContent = to || cc || bcc || subject || body || attachments.length;
    if (hasContent) {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId,
          to: parseAddresses(to),
          cc: parseAddresses(cc),
          bcc: parseAddresses(bcc),
          subject,
          bodyText: body,
          attachments,
          threadId: composePrefill?.threadId,
          inReplyToId: composePrefill?.inReplyToId,
        }),
      }).catch(() => {});
      notifyChanged();
    }
    closeCompose();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const toList = parseAddresses(to);
    if (toList.length === 0) {
      setError("Add at least one recipient");
      return;
    }
    setSending(true);
    setError(null);
    const res = await fetch("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        draftId,
        to: toList,
        cc: parseAddresses(cc),
        bcc: parseAddresses(bcc),
        subject: subject || "(no subject)",
        bodyText: body,
        attachments,
        threadId: composePrefill?.threadId,
        inReplyToId: composePrefill?.inReplyToId,
      }),
    });
    setSending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't send that message. Try again.");
      return;
    }
    notifyChanged();
    closeCompose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:p-6 bg-ink/20">
      <div className="w-full sm:w-[560px] max-h-full sm:max-h-[85vh] bg-white sm:rounded-lg shadow-xl border border-line flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-sm font-medium text-ink">New message</h2>
          <button
            onClick={saveDraftAndClose}
            aria-label="Save and close"
            className="text-muted hover:text-ink text-sm"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSend} className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-4 py-2 border-b border-line flex items-center gap-2">
            <label htmlFor="to" className="text-sm text-muted w-10">To</label>
            <input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@example.com, another@example.com"
              className="flex-1 text-sm py-1 outline-none"
            />
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-accent"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="px-4 py-2 border-b border-line flex items-center gap-2">
                <label htmlFor="cc" className="text-sm text-muted w-10">Cc</label>
                <input
                  id="cc"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="flex-1 text-sm py-1 outline-none"
                />
              </div>
              <div className="px-4 py-2 border-b border-line flex items-center gap-2">
                <label htmlFor="bcc" className="text-sm text-muted w-10">Bcc</label>
                <input
                  id="bcc"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  className="flex-1 text-sm py-1 outline-none"
                />
              </div>
            </>
          )}

          <div className="px-4 py-2 border-b border-line">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full text-sm py-1 outline-none"
            />
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            className="flex-1 min-h-[180px] px-4 py-3 text-sm outline-none resize-none"
          />

          {attachments.length > 0 && (
            <ul className="px-4 pb-2 flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li
                  key={a.storageKey}
                  className="flex items-center gap-2 text-xs bg-accentSoft rounded px-2 py-1"
                >
                  <span className="truncate max-w-[160px]">{a.filename}</span>
                  <span className="text-muted">{formatBytes(a.sizeBytes)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.storageKey)}
                    aria-label={`Remove ${a.filename}`}
                    className="text-muted hover:text-flag"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="px-4 pb-2 text-sm text-flag" role="alert">
              {error}
            </p>
          )}

          <div className="px-4 py-3 border-t border-line flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={sending}
                className="rounded bg-accent text-white text-sm font-medium px-5 py-2 hover:opacity-90 disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
              <label className="text-sm text-muted hover:text-ink cursor-pointer">
                {uploading ? "Uploading…" : "Attach files"}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
