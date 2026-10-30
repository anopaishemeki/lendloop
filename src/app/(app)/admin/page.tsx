"use client";

import { useQuery } from "convex/react";
import { BadgeCheck, ClipboardList, ShieldOff, Wrench } from "lucide-react";
import Link from "next/link";
import { AdminLoans } from "@/components/admin/admin-loans";
import { AdminTools } from "@/components/admin/admin-tools";
import { AdminUsers } from "@/components/admin/admin-users";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../../../convex/_generated/api";

export default function AdminPage() {
  const me = useQuery(api.users.me);

  // The proxy and every admin function enforce the role; this only avoids
  // rendering queries that would fail when a stale session reaches the page.
  if (me && !me.isAdmin) {
    return (
      <EmptyState icon={ShieldOff} title="Admins only">
        <Button asChild variant="outline">
          <Link href="/tools">Back to all tools</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        description="Oversee loans, moderate listings and recognise reliable lenders."
        eyebrow="Neighborhood admin"
        title="Admin"
      />
      <Tabs defaultValue="loans">
        <TabsList className="h-11 rounded-full p-1">
          <TabsTrigger className="rounded-full px-4" value="loans">
            <ClipboardList aria-hidden />
            All loans
          </TabsTrigger>
          <TabsTrigger className="rounded-full px-4" value="listings">
            <Wrench aria-hidden />
            Listings
          </TabsTrigger>
          <TabsTrigger className="rounded-full px-4" value="lenders">
            <BadgeCheck aria-hidden />
            Lenders
          </TabsTrigger>
        </TabsList>
        <TabsContent className="pt-6" value="loans">
          <AdminLoans />
        </TabsContent>
        <TabsContent className="pt-6" value="listings">
          <AdminTools />
        </TabsContent>
        <TabsContent className="pt-6" value="lenders">
          <AdminUsers />
        </TabsContent>
      </Tabs>
    </>
  );
}
