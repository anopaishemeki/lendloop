"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  Gauge,
  ShieldOff,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/empty-state";
import { Logo } from "@/components/logo";
import { PageHeader } from "@/components/page-header";
import { type NavItem, NavLinks } from "@/components/site-header";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { NameWithBadge } from "@/components/trusted-lender-badge";
import { Button } from "@/components/ui/button";
import { matchesPrefix } from "@/lib/route-access";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";

const section = (href: string) => (path: string) => matchesPrefix(path, href);

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", icon: Gauge, label: "Overview" },
  {
    href: "/admin/loans",
    icon: ClipboardList,
    isActive: section("/admin/loans"),
    label: "Loans",
  },
  {
    href: "/admin/listings",
    icon: Wrench,
    isActive: section("/admin/listings"),
    label: "Listings",
  },
  {
    href: "/admin/neighbors",
    icon: BadgeCheck,
    isActive: section("/admin/neighbors"),
    label: "Neighbors",
  },
  {
    href: "/admin/automation",
    icon: Workflow,
    isActive: section("/admin/automation"),
    label: "Automation",
  },
];

function AdminNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <nav
      aria-label="Admin"
      className={cn(
        "flex gap-1",
        orientation === "vertical"
          ? "flex-col"
          : "-mx-4 overflow-x-auto px-4 pb-2"
      )}
    >
      <NavLinks className="gap-2.5 rounded-lg px-3 py-2" items={ADMIN_NAV} />
    </nav>
  );
}

/** Every admin page's header: the portal eyebrow plus the page's title. */
export function AdminPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageHeader
      description={description}
      eyebrow="Admin portal"
      title={title}
    />
  );
}

function BackToApp() {
  return (
    <Link
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      href="/tools"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Back to LendLoop
    </Link>
  );
}

/**
 * The admin portal frame: a sidebar on large screens, a top bar with a
 * scrolling nav on small ones, and the current admin page as the outlet.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);

  // src/proxy.ts and every admin function enforce the role; this only avoids
  // rendering admin queries for a stale session that still reaches the page.
  if (me && !me.isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24">
        <EmptyState icon={ShieldOff} title="Admins only">
          <Button asChild variant="outline">
            <Link href="/tools">Back to all tools</Link>
          </Button>
        </EmptyState>
      </main>
    );
  }

  return (
    <div className="flex min-h-svh">
      <aside className="bg-card/70 sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo href="/admin" />
          <p className="text-muted-foreground mt-1 pl-10 text-xs font-semibold tracking-wider uppercase">
            Admin portal
          </p>
        </div>
        <div className="mt-8 flex-1">
          <AdminNav orientation="vertical" />
        </div>
        <div className="space-y-4 border-t px-2 pt-4">
          <BackToApp />
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <UserButton />
            {me ? (
              <NameWithBadge
                className="text-sm"
                isTrustedLender={me.isTrustedLender}
              >
                <span className="truncate">{me.name}</span>
              </NameWithBadge>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 sticky top-0 z-20 border-b px-4 pt-3 backdrop-blur-md lg:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Logo href="/admin" />
            <div className="flex items-center gap-3">
              <BackToApp />
              <ThemeSwitcher />
              <UserButton />
            </div>
          </div>
          <AdminNav orientation="horizontal" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
