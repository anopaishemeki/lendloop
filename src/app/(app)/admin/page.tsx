"use client";

import { AdminLoans } from "@/components/admin/admin-loans";
import { AdminTools } from "@/components/admin/admin-tools";
import { AdminUsers } from "@/components/admin/admin-users";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  return (
    <>
      <PageHeader
        description="Oversee loans, moderate listings and recognise reliable lenders."
        title="Admin"
      />
      <Tabs defaultValue="loans">
        <TabsList>
          <TabsTrigger value="loans">All loans</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="lenders">Lenders</TabsTrigger>
        </TabsList>
        <TabsContent className="pt-4" value="loans">
          <AdminLoans />
        </TabsContent>
        <TabsContent className="pt-4" value="listings">
          <AdminTools />
        </TabsContent>
        <TabsContent className="pt-4" value="lenders">
          <AdminUsers />
        </TabsContent>
      </Tabs>
    </>
  );
}
