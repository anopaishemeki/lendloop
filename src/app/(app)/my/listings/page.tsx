"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ListToolButton } from "@/components/tools/list-tool-button";
import { RemoveToolButton } from "@/components/tools/remove-tool-button";
import { ToolGrid } from "@/components/tools/tool-grid";
import { Button } from "@/components/ui/button";
import { api } from "../../../../../convex/_generated/api";

export default function MyListingsPage() {
  const tools = useQuery(api.tools.listMine);

  return (
    <>
      <PageHeader
        action={<ListToolButton />}
        description="Tools you're lending to the neighborhood."
        title="My listings"
      />
      <ToolGrid
        actions={(tool) => (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/tools/${tool._id}/edit`}>Edit</Link>
            </Button>
            <RemoveToolButton toolId={tool._id} toolName={tool.name} />
          </>
        )}
        emptyHint="A ladder, a tent, a stand mixer: what do you have that sits idle?"
        emptyTitle="You haven't listed anything yet"
        tools={tools}
      />
    </>
  );
}
