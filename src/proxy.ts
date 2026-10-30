import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccessRoute, isPublicRoute } from "./lib/route-access";

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  if (isPublicRoute(pathname)) return;

  await auth.protect();
  const { sessionClaims } = await auth();
  if (!canAccessRoute(pathname, sessionClaims?.metadata?.role)) {
    return NextResponse.redirect(new URL("/tools", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
