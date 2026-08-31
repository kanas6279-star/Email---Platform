import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE = "session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 14);

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is missing or too short. Set a long random value in .env"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Creates a DB-backed session (so it can be revoked on logout / "sign out
// everywhere") and returns a signed JWT that references it.
export async function createSession(userId: string, userAgent?: string) {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: { userId, expiresAt, userAgent },
  });

  const token = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecretKey());

  return { token, expiresAt };
}

export async function verifySessionToken(
  token: string
): Promise<{ userId: string; sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const sid = payload.sid as string;
    const uid = payload.uid as string;
    if (!sid || !uid) return null;

    // Confirm the session hasn't been revoked (logout) or expired server-side.
    const session = await db.session.findUnique({ where: { id: sid } });
    if (!session || session.expiresAt < new Date()) return null;

    return { userId: uid, sessionId: sid };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

// Reads the session cookie for the current request, validates it, and
// returns the logged-in user (or null). Use in route handlers / server
// components — for middleware use verifySessionToken directly with the
// cookie read from the NextRequest.
export async function getCurrentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await verifySessionToken(token);
  if (!result) return null;

  return db.user.findUnique({ where: { id: result.userId } });
}

export async function revokeSession(sessionId: string) {
  await db.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export { SESSION_COOKIE };
