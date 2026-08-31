import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { MAIL_DOMAIN } from "@/lib/mailer";

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Rate limit by IP + attempted identifier to slow down credential stuffing
  // without letting one client lock out a shared IP entirely.
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const rl = checkRateLimit(
    clientKeyFromRequest(req, `login:${parsed.data.usernameOrEmail}`),
    Number(process.env.LOGIN_RATE_LIMIT_PER_15MIN ?? 10),
    15 * 60 * 1000
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { usernameOrEmail, password } = parsed.data;
  const email = usernameOrEmail.includes("@")
    ? usernameOrEmail.toLowerCase()
    : `${usernameOrEmail.toLowerCase()}@${MAIL_DOMAIN}`;

  const user = await db.user.findUnique({ where: { email } });

  // Compare against a dummy hash when the user doesn't exist so response
  // timing doesn't reveal whether the account is real.
  const validPassword = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$12$invalidsaltinvalidsaltinvalidsal.");

  if (!user || !validPassword) {
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent") ?? undefined);
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
}
