"use client";

import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { CategoryFilter } from "@/components/tools/category-filter";
import { ListToolButton } from "@/components/tools/list-tool-button";
import { ToolGrid } from "@/components/tools/tool-grid";
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
      <ToolGrid
        emptyHint="Be the first to lend something in this category."
        emptyTitle="No tools here yet"
        tools={tools}
      />
    </>
  );
}

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        action={<ListToolButton />}
        description="Everything your neighbors are happy to lend."
        title="All tools"
      />
      <Suspense
        fallback={<ToolGrid emptyHint="" emptyTitle="" tools={undefined} />}
      >
        <ToolBrowser />
      </Suspense>
    </>
  );
}
