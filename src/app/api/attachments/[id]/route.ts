import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readAttachment } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const attachment = await db.attachment.findUnique({
    where: { id: params.id },
    include: { message: true },
  });
  if (!attachment || attachment.message.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await readAttachment(attachment.storageKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment.filename.replace(/"/g, "")}"`,
      "Content-Length": String(attachment.sizeBytes),
      // Never let an uploaded document execute as HTML/script in the browser.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
