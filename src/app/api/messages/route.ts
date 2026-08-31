import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

const FOLDERS = ["INBOX", "SENT", "DRAFTS", "TRASH", "SPAM", "ARCHIVE"] as const;

// GET /api/messages?folder=INBOX&q=keyword&from=&to=&subject=&starred=1&dateFrom=&dateTo=&page=1
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const folder = params.get("folder");
  const q = params.get("q")?.trim();
  const from = params.get("from")?.trim();
  const to = params.get("to")?.trim();
  const subject = params.get("subject")?.trim();
  const starredOnly = params.get("starred") === "1";
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = 25;

  const where: Prisma.MessageWhereInput = { ownerId: user.id };

  if (folder && (FOLDERS as readonly string[]).includes(folder)) {
    where.folder = folder as (typeof FOLDERS)[number];
  }
  if (starredOnly) where.isStarred = true;
  if (from) where.fromAddress = { contains: from, mode: "insensitive" };
  if (to) where.toAddresses = { has: to.toLowerCase() };
  if (subject) where.subject = { contains: subject, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.sentAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { bodyText: { contains: q, mode: "insensitive" } },
      { fromAddress: { contains: q, mode: "insensitive" } },
      { toAddresses: { has: q.toLowerCase() } },
    ];
  }

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where,
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { attachments: true },
    }),
    db.message.count({ where }),
  ]);

  return NextResponse.json({ messages, total, page, pageSize });
}

const attachmentRefSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  storageKey: z.string(),
});

const draftSchema = z.object({
  id: z.string().uuid().optional(), // present when updating an existing draft
  to: z.array(z.string().email()).default([]),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  subject: z.string().default(""),
  bodyText: z.string().default(""),
  bodyHtml: z.string().optional(),
  attachments: z.array(attachmentRefSchema).default([]),
  threadId: z.string().optional(),
  inReplyToId: z.string().optional(),
});

// POST /api/messages — create or update a draft (autosave).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft data" }, { status: 400 });
  }
  const d = parsed.data;

  if (d.id) {
    const existing = await db.message.findUnique({ where: { id: d.id } });
    if (!existing || existing.ownerId !== user.id || existing.folder !== "DRAFTS") {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    await db.attachment.deleteMany({ where: { messageId: d.id } });
    const updated = await db.message.update({
      where: { id: d.id },
      data: {
        toAddresses: d.to,
        ccAddresses: d.cc,
        bccAddresses: d.bcc,
        subject: d.subject,
        bodyText: d.bodyText,
        bodyHtml: d.bodyHtml,
        attachments: {
          create: d.attachments.map((a) => ({ ...a })),
        },
      },
      include: { attachments: true },
    });
    return NextResponse.json({ message: updated });
  }

  const created = await db.message.create({
    data: {
      ownerId: user.id,
      folder: "DRAFTS",
      isDraft: true,
      isRead: true,
      fromAddress: user.email,
      fromName: user.displayName,
      toAddresses: d.to,
      ccAddresses: d.cc,
      bccAddresses: d.bcc,
      subject: d.subject,
      bodyText: d.bodyText,
      bodyHtml: d.bodyHtml,
      threadId: d.threadId ?? randomUUID(),
      inReplyToId: d.inReplyToId,
      attachments: { create: d.attachments.map((a) => ({ ...a })) },
    },
    include: { attachments: true },
  });

  return NextResponse.json({ message: created });
}
