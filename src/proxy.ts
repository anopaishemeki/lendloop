import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccessRoute, isPublicRoute } from "./lib/route-access";

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  if (isPublicRoute(pathname)) return;

  const { sessionClaims } = await auth.protect();
  // Navigation only: Convex enforces the role on every admin function. When the
  // session token carries no `metadata` claim (see README, Clerk setup), let
  // the request through and the admin portal decides from Convex instead.
  if (
    sessionClaims.metadata !== undefined &&
    !canAccessRoute(pathname, sessionClaims.metadata)
  ) {
    return NextResponse.redirect(new URL("/tools", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
