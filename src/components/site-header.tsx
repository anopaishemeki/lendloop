"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

const NAV = [
  { href: "/tools", label: "All tools" },
  { href: "/my/listings", label: "My listings" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const me = useQuery(api.users.me);
  const links = me?.isAdmin
    ? [...NAV, { href: "/admin", label: "Admin" }]
    : NAV;

  return (
    <header className="bg-background/90 sticky top-0 z-10 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link className="font-semibold tracking-tight" href="/tools">
          LendLoop
        </Link>
        <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm">
          {links.map(({ href, label }) => (
            <Link
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
                pathname.startsWith(href) && "bg-secondary text-foreground"
              )}
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <UserButton />
      </div>
    </header>
  );
}
