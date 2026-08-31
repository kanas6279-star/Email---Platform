import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { MAIL_DOMAIN } from "@/lib/mailer";

const signupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32)
    .regex(/^[a-z0-9._-]+$/, "Use lowercase letters, numbers, dots, dashes, or underscores only"),
  displayName: z.string().min(1).max(80),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(clientKeyFromRequest(req, "signup"), 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { username, displayName, password } = parsed.data;
  const email = `${username}@${MAIL_DOMAIN}`;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "That username is already taken" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { username, email, displayName, passwordHash },
  });

  // TODO(v2): send a real verification email instead of auto-verifying.
  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent") ?? undefined);
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
}
