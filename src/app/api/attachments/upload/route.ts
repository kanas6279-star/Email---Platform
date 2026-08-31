import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveAttachment, isAttachmentTypeAllowed } from "@/lib/storage";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

const MAX_MB = Number(process.env.MAX_ATTACHMENT_MB ?? 25);

// POST /api/attachments/upload — multipart/form-data with a single "file"
// field. Returns metadata the client attaches to a draft or send request;
// no Message/Attachment DB row is created until that draft/message is saved,
// so an abandoned upload doesn't leave orphaned attachment records.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(clientKeyFromRequest(req, `upload:${user.id}`), 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!isAttachmentTypeAllowed(file.name)) {
    return NextResponse.json(
      { error: "This file type isn't allowed for security reasons (executables/scripts)." },
      { status: 415 }
    );
  }

  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File exceeds the ${MAX_MB}MB limit` }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // NOTE: for production, run the buffer through an antivirus scanner
  // (e.g. ClamAV) here before it's persisted, and reject on a positive hit.
  const storageKey = await saveAttachment(buffer, file.name);

  return NextResponse.json({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    storageKey,
  });
}
