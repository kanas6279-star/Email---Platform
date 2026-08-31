import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

// Files land here for local/dev use. In production, set
// ATTACHMENT_STORAGE=s3 and fill in the S3_* env vars — swap the two
// functions below for calls to your S3 client (see README for a snippet).
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function saveAttachment(
  buffer: Buffer,
  originalFilename: string
): Promise<string> {
  if (process.env.ATTACHMENT_STORAGE === "s3") {
    throw new Error(
      "S3 storage isn't wired up yet — see README.md 'Attachment storage' section for the snippet to add here."
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${randomUUID()}-${safeName}`;
  await writeFile(path.join(UPLOAD_DIR, storageKey), buffer);
  return storageKey;
}

export async function readAttachment(storageKey: string): Promise<Buffer> {
  if (process.env.ATTACHMENT_STORAGE === "s3") {
    throw new Error("S3 storage isn't wired up yet — see README.md.");
  }
  return readFile(path.join(UPLOAD_DIR, storageKey));
}

// A conservative allow-list. Executables, scripts, and other formats that
// can run code on double-click are blocked outright rather than merely
// scanned, since scanning can't catch novel malware.
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".msi", ".scr", ".com", ".pif",
  ".js", ".vbs", ".ps1", ".jar", ".apk", ".app", ".dmg",
];

export function isAttachmentTypeAllowed(filename: string) {
  const lower = filename.toLowerCase();
  return !BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
