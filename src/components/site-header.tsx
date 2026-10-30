"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

const TOOL_FORM_PATH = /^\/tools\/(?:new|[^/]+\/edit)$/u;

type NavItem = {
  href: string;
  label: string;
  isActive?: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/tools", label: "All tools" },
  {
    href: "/my/listings",
    isActive: (path: string) =>
      path === "/my/listings" || TOOL_FORM_PATH.test(path),
    label: "My listings",
  },
  { href: "/my/requests", label: "My requests" },
  { href: "/my/incoming", label: "Incoming" },
];

// Shown only to admins; /admin and every admin function also check the role.
const ADMIN_NAV: NavItem = { href: "/admin", label: "Admin" };

export function SiteHeader() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const items = me?.isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  return (
    <header className="bg-background/90 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link className="font-semibold tracking-tight" href="/tools">
          LendLoop
        </Link>
        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm">
          {items.map(({ href, isActive, label }) => {
            const active = isActive ? isActive(pathname) : pathname === href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
                  active && "bg-secondary text-foreground"
                )}
                href={href}
                key={href}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <UserButton />
      </div>
    </header>
  );
}
