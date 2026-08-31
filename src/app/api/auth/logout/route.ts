import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, revokeSession, clearSessionCookie } from "@/lib/auth";

export async function POST() {
  const token = cookies().get("session")?.value;
  if (token) {
    const result = await verifySessionToken(token);
    if (result) {
      await revokeSession(result.sessionId);
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
