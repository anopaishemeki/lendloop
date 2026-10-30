"use client";

import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { CategoryFilter } from "@/components/tools/category-filter";
import { ToolCard } from "@/components/tools/tool-card";
import { Button } from "@/components/ui/button";
import { api } from "../../../../convex/_generated/api";
import {
  TOOL_CATEGORIES,
  type ToolCategory,
} from "../../../../convex/lib/validators";

function parseCategory(value: string | null): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((category) => category === value);
}

function ToolBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = parseCategory(searchParams.get("category"));
  const tools = useQuery(api.tools.list, { category });

  const setCategory = (next: ToolCategory | undefined) => {
    router.replace(next ? `/tools?category=${next}` : "/tools", {
      scroll: false,
    });
  };

  return (
    <>
      <CategoryFilter onChange={setCategory} value={category} />
      {tools === undefined ? <ListSkeleton /> : null}
      {tools?.length === 0 ? (
        <EmptyState title="No tools here yet">
          <p className="text-muted-foreground text-sm">
            Be the first to lend something in this category.
          </p>
        </EmptyState>
      ) : null}
      {tools && tools.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool._id} tool={tool} />
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function ToolsPage() {
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
        description="Everything your neighbors are happy to lend."
        title="All tools"
      />
      <Suspense fallback={<ListSkeleton />}>
        <ToolBrowser />
      </Suspense>
    </>
  );
}
