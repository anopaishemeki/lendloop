import { roleFromMetadata } from "../../convex/lib/roles";

// Pure route rules for src/proxy.ts. The proxy only improves UX (redirects);
// every Convex function re-checks identity and role on its own.

const PUBLIC_PREFIXES = ["/sign-in", "/sign-up"] as const;
const ADMIN_PREFIX = "/admin";

export function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
  );
}

export function isAdminRoute(pathname: string) {
  return matchesPrefix(pathname, ADMIN_PREFIX);
}

export function canAccessRoute(pathname: string, metadata: unknown) {
  return !isAdminRoute(pathname) || roleFromMetadata(metadata) === "admin";
}
