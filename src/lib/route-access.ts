// Pure route rules for src/proxy.ts. The proxy only improves UX (redirects);
// every Convex function re-checks identity and role on its own.

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up"] as const;
const ADMIN_PREFIX = "/admin";

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicRoute(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some(
    (path) => path !== "/" && matchesPrefix(pathname, path)
  );
}

export function isAdminRoute(pathname: string) {
  return matchesPrefix(pathname, ADMIN_PREFIX);
}

export function canAccessRoute(pathname: string, role: string | undefined) {
  return !isAdminRoute(pathname) || role === "admin";
}
