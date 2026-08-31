import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function loadOwnedMessage(id: string, userId: string) {
  const message = await db.message.findUnique({ where: { id }, include: { attachments: true } });
  if (!message || message.ownerId !== userId) return null;
  return message;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const message = await loadOwnedMessage(params.id, user.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ message });
}

const FOLDERS = ["INBOX", "SENT", "DRAFTS", "TRASH", "SPAM", "ARCHIVE"] as const;

const patchSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  folder: z.enum(FOLDERS).optional(),
});

// PATCH /api/messages/:id — mark read/unread, star/unstar, or move between
// folders (archive, trash, spam, back to inbox, etc).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const message = await loadOwnedMessage(params.id, user.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await db.message.update({
    where: { id: params.id },
    data: parsed.data,
    include: { attachments: true },
  });

  return NextResponse.json({ message: updated });
}

// DELETE /api/messages/:id — move to Trash on first delete, permanently
// remove (including attachment rows, via cascade) if it's already in Trash.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const message = await loadOwnedMessage(params.id, user.id);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (message.folder === "TRASH" || message.folder === "DRAFTS") {
    await db.message.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true, permanent: true });
  }

  const updated = await db.message.update({
    where: { id: params.id },
    data: { folder: "TRASH" },
  });
  return NextResponse.json({ deleted: true, permanent: false, message: updated });
}
