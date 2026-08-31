import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { scoreSpam, SPAM_THRESHOLD, usernameFromAddress } from "@/lib/mailer";
import { saveAttachment, isAttachmentTypeAllowed } from "@/lib/storage";

// Postmark (or whichever inbound-parsing provider you choose) posts here for
// every message sent to an address on our domain. Configure this URL as the
// server's "Inbound Webhook URL" in the Postmark dashboard, with the query
// string `?secret=...` matching POSTMARK_INBOUND_WEBHOOK_SECRET, so we can
// confirm the request really came from the provider and not a random client.
//
// Postmark's inbound payload shape: https://postmarkapp.com/developer/webhooks/inbound-webhook

interface PostmarkAttachment {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
}

interface PostmarkInboundPayload {
  From: string;
  FromName?: string;
  To: string;
  Cc?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  MessageID?: string;
  Attachments?: PostmarkAttachment[];
}

function parseAddressList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim().match(/<(.+)>/)?.[1] ?? v.trim())
    .filter(Boolean)
    .map((v) => v.toLowerCase());
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.POSTMARK_INBOUND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as PostmarkInboundPayload | null;
  if (!payload) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const toAddresses = parseAddressList(payload.To);
  const ccAddresses = parseAddressList(payload.Cc);
  const fromAddress = payload.From?.toLowerCase() ?? "unknown@unknown";
  const subject = payload.Subject ?? "(no subject)";
  const bodyText = payload.TextBody ?? "";

  const spam = scoreSpam({ subject, bodyText, fromAddress });
  const threadId = randomUUID();

  let delivered = 0;
  for (const address of toAddresses) {
    const username = usernameFromAddress(address);
    const recipient = await db.user.findFirst({ where: { username } });
    if (!recipient) continue; // no local mailbox for this address — drop it

    const attachmentsData = (payload.Attachments ?? [])
      .filter((a) => isAttachmentTypeAllowed(a.Name))
      .map(async (a) => {
        const buffer = Buffer.from(a.Content, "base64");
        const storageKey = await saveAttachment(buffer, a.Name);
        return {
          filename: a.Name,
          mimeType: a.ContentType,
          sizeBytes: a.ContentLength,
          storageKey,
        };
      });

    const attachments = await Promise.all(attachmentsData);

    await db.message.create({
      data: {
        ownerId: recipient.id,
        folder: spam.score >= SPAM_THRESHOLD ? "SPAM" : "INBOX",
        isRead: false,
        fromAddress,
        fromName: payload.FromName,
        toAddresses,
        ccAddresses,
        bccAddresses: [],
        subject,
        bodyText,
        bodyHtml: payload.HtmlBody,
        threadId,
        externalId: payload.MessageID,
        spamScore: spam.score,
        spamReasons: spam.reasons,
        attachments: { create: attachments },
      },
    });
    delivered++;
  }

  return NextResponse.json({ delivered });
}
