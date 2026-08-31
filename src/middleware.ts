import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "session";

function getSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

// Lightweight check here: just verifies the JWT signature/expiry so we can
// redirect unauthenticated users fast, at the edge, without a DB round trip.
// Route handlers still call getCurrentUser() for the authoritative,
// revocation-aware check before touching any data.
async function hasValidToken(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthed = await hasValidToken(req);

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtected = pathname.startsWith("/mail");

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/mail/inbox";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/mail/:path*", "/login", "/signup"],
};
