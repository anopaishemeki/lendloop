"use client";

import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { RemoveToolButton } from "@/components/tools/remove-tool-button";
import { ToolCard } from "@/components/tools/tool-card";
import { Button } from "@/components/ui/button";
import { api } from "../../../../../convex/_generated/api";

export default function MyListingsPage() {
  const tools = useQuery(api.tools.listMine);

  return (
    <>
      <PageHeader
        action={
          <Button asChild>
            <Link href="/tools/new">
              <Plus aria-hidden />
              List a tool
            </Link>
          </Button>
        }
        description="Tools you're lending to the neighborhood."
        title="My listings"
      />
      {tools === undefined ? <ListSkeleton /> : null}
      {tools?.length === 0 ? (
        <EmptyState title="You haven't listed anything yet">
          <p className="text-muted-foreground text-sm">
            A ladder, a tent, a stand mixer: what do you have that sits idle?
          </p>
        </EmptyState>
      ) : null}
      {tools && tools.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard
              actions={
                <>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/tools/${tool._id}/edit`}>Edit</Link>
                  </Button>
                  <RemoveToolButton toolId={tool._id} toolName={tool.name} />
                </>
              }
              key={tool._id}
              tool={tool}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
