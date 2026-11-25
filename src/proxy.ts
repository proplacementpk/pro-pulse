/** Runs before every page: keeps signed-out visitors on the sign-in screen and renews the
 *  session shortly before it runs out, so nobody is thrown out in the middle of their work. */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/config";
import { cookieOptions, expiry, seal, unseal } from "@/lib/session";
import { auth } from "@/lib/supabase";

const OPEN = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isOpen = OPEN.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const session = await unseal(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    if (isOpen) return NextResponse.next();
    const to = new URL("/login", request.url);
    if (pathname !== "/") to.searchParams.set("next", pathname + search);
    return NextResponse.redirect(to);
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.expires - now > 90) return NextResponse.next();

  // the access token is about to end: swap it for a new one
  try {
    const t = await auth.refresh(session.refresh);
    const sealed = await seal({ access: t.access_token, refresh: t.refresh_token, expires: expiry(t.expires_in), uid: session.uid });
    request.cookies.set(SESSION_COOKIE, sealed); // so the page being rendered right now sees it
    const res = NextResponse.next({ request: { headers: request.headers } });
    res.cookies.set(SESSION_COOKIE, sealed, cookieOptions(SESSION_DAYS));
    return res;
  } catch {
    const res = isOpen ? NextResponse.next() : NextResponse.redirect(new URL("/login?reason=ended", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  // everything except Next's own files and the images in /public
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.svg|logo-dark.svg|mark.png).*)"],
};
