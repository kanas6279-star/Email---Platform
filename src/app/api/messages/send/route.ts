import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  isInternalAddress,
  sendExternalMail,
  scoreSpam,
  SPAM_THRESHOLD,
} from "@/lib/mailer";
import { readAttachment } from "@/lib/storage";

const attachmentRefSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  storageKey: z.string(),
});

const sendSchema = z.object({
  draftId: z.string().uuid().optional(),
  to: z.array(z.string().email()).min(1, "Add at least one recipient"),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  subject: z.string().default("(no subject)"),
  bodyText: z.string().default(""),
  bodyHtml: z.string().optional(),
  attachments: z.array(attachmentRefSchema).default([]),
  threadId: z.string().optional(),
  inReplyToId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(
    `send:${user.id}`,
    Number(process.env.SEND_RATE_LIMIT_PER_HOUR ?? 100),
    60 * 60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "You've hit the sending limit for now. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;
  const threadId = d.threadId ?? randomUUID();
  const allRecipients = [...d.to, ...d.cc, ...d.bcc];

  // 1. Record the sender's own copy in Sent.
  const sentCopy = await db.message.create({
    data: {
      ownerId: user.id,
      folder: "SENT",
      isRead: true,
      fromAddress: user.email,
      fromName: user.displayName,
      toAddresses: d.to,
      ccAddresses: d.cc,
      bccAddresses: d.bcc,
      subject: d.subject,
      bodyText: d.bodyText,
      bodyHtml: d.bodyHtml,
      threadId,
      inReplyToId: d.inReplyToId,
      attachments: { create: d.attachments.map((a) => ({ ...a })) },
    },
    include: { attachments: true },
  });

  // 2. Deliver to any recipients who are on our own domain directly into
  // their mailbox — no need to round-trip through the internet for those.
  const internalAddresses = [...new Set(allRecipients.filter(isInternalAddress))];
  const spam = scoreSpam({ subject: d.subject, bodyText: d.bodyText, fromAddress: user.email });

  for (const address of internalAddresses) {
    const recipient = await db.user.findUnique({ where: { email: address } });
    if (!recipient) continue; // address looks internal but no such mailbox exists
    await db.message.create({
      data: {
        ownerId: recipient.id,
        folder: spam.score >= SPAM_THRESHOLD ? "SPAM" : "INBOX",
        isRead: false,
        fromAddress: user.email,
        fromName: user.displayName,
        toAddresses: d.to,
        ccAddresses: d.cc,
        bccAddresses: d.bcc,
        subject: d.subject,
        bodyText: d.bodyText,
        bodyHtml: d.bodyHtml,
        threadId,
        inReplyToId: d.inReplyToId,
        spamScore: spam.score,
        spamReasons: spam.reasons,
        attachments: { create: d.attachments.map((a) => ({ ...a })) },
      },
    });
  }

  // 3. Deliver to everyone else over the internet via the mail provider.
  const hasExternalRecipient = allRecipients.some((a) => !isInternalAddress(a));
  if (hasExternalRecipient) {
    const attachmentsForSend = await Promise.all(
      d.attachments.map(async (a) => ({
        filename: a.filename,
        mimeType: a.mimeType,
        contentBase64: (await readAttachment(a.storageKey)).toString("base64"),
      }))
    );
    try {
      await sendExternalMail({
        from: user.email,
        fromName: user.displayName,
        to: d.to,
        cc: d.cc,
        bcc: d.bcc,
        subject: d.subject,
        bodyText: d.bodyText,
        bodyHtml: d.bodyHtml,
        attachments: attachmentsForSend,
      });
    } catch (err) {
      // The Sent copy and any internal deliveries already succeeded; surface
      // the external delivery failure without losing those.
      console.error("External delivery failed:", err);
      return NextResponse.json(
        {
          message: sentCopy,
          warning: "Saved and delivered to platform recipients, but external delivery failed.",
        },
        { status: 207 }
      );
    }
  }

  // 4. Clean up the draft this send originated from, if any.
  if (d.draftId) {
    await db.message
      .deleteMany({ where: { id: d.draftId, ownerId: user.id, folder: "DRAFTS" } })
      .catch(() => {});
  }

  return NextResponse.json({ message: sentCopy });
}
