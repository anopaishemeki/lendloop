"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  ArrowDownToLine,
  ClipboardList,
  LayoutGrid,
  type LucideIcon,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import { firstName } from "../../convex/lib/users";

const TOOL_FORM_PATH = /^\/tools\/(?:new|[^/]+\/edit)$/u;

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive?: (path: string) => boolean;
};

const NAV: NavItem[] = [
  { href: "/tools", icon: LayoutGrid, label: "All tools" },
  {
    href: "/my/listings",
    icon: Wrench,
    isActive: (path: string) =>
      path === "/my/listings" || TOOL_FORM_PATH.test(path),
    label: "My listings",
  },
  { href: "/my/requests", icon: ClipboardList, label: "My requests" },
  { href: "/my/incoming", icon: ArrowDownToLine, label: "Incoming" },
];

// Shown only to admins; /admin and every admin function also check the role.
const ADMIN_NAV: NavItem = {
  href: "/admin",
  icon: ShieldCheck,
  label: "Admin",
};

/** Nav links with the current page highlighted; `className` sets the shape. */
export function NavLinks({
  items,
  className = "rounded-full px-3 py-1.5",
}: {
  items: NavItem[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <>
      {items.map(({ href, icon: Icon, isActive, label }) => {
        const active = isActive ? isActive(pathname) : pathname === href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              className,
              active &&
                "bg-secondary text-secondary-foreground hover:bg-secondary"
            )}
            href={href}
            key={href}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export function SiteHeader() {
  const me = useQuery(api.users.me);
  const items = me?.isAdmin ? [...NAV, ADMIN_NAV] : NAV;

  return (
    <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo href="/tools" />
        <nav
          aria-label="Main"
          className="hidden flex-1 items-center gap-1 md:flex"
        >
          <NavLinks items={items} />
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {me ? (
            <span className="text-muted-foreground hidden text-sm lg:inline">
              Hi, {firstName(me.name)}
            </span>
          ) : null}
          <UserButton />
        </div>
      </div>
      <nav
        aria-label="Main"
        className="-mt-1 flex gap-1 overflow-x-auto px-4 pb-2 md:hidden"
      >
        <NavLinks items={items} />
      </nav>
    </header>
  );
}
