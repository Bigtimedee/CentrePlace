import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite-only(.*)",
  "/forgot-password(.*)",
  "/reset-password(.*)",
  "/api/trpc(.*)",
  "/api/admin/invite(.*)", // protected by its own admin check
  "/api/admin/users(.*)", // protected by its own admin check
  "/clerk(.*)",
]);

// Cookie set when a user arrives with a valid Clerk invitation ticket.
// Allows them to complete multi-step sign-up (including via Google OAuth)
// without the ticket being present on each sub-route.
const SIGNUP_SESSION_COOKIE = "cp_signup_allowed";

export default clerkMiddleware(async (auth, request) => {
  const { pathname, searchParams } = request.nextUrl;

  // ── Invite-only sign-up ──────────────────────────────────────────────────
  // Block direct sign-up access unless the user has a valid Clerk invitation
  // ticket or a session cookie set from a prior ticket verification.
  // Google OAuth-based sign-ups for invited users work because the cookie
  // persists through the OAuth redirect chain (sameSite: "lax").
  if (pathname.startsWith("/sign-up")) {
    const ticket = searchParams.get("__clerk_ticket");
    const hasSession = request.cookies.has(SIGNUP_SESSION_COOKIE);

    if (!ticket && !hasSession) {
      return NextResponse.redirect(new URL("/invite-only", request.url));
    }

    if (ticket && !hasSession) {
      const response = NextResponse.next();
      response.cookies.set(SIGNUP_SESSION_COOKIE, "1", {
        maxAge: 60 * 60, // 1 hour — enough to complete sign-up
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/sign-up",
      });
      return response;
    }
  }

  // ── Route protection ─────────────────────────────────────────────────────
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
