"use client";

import { usePaginatedQuery } from "convex/react";
import { SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadMoreButton } from "@/components/load-more";
import { RequestDialog } from "@/components/loans/request-dialog";
import { PageHeader } from "@/components/page-header";
import { ReportDialog } from "@/components/reports/report-dialog";
import { CategoryFilter } from "@/components/tools/category-filter";
import { ListToolButton } from "@/components/tools/list-tool-button";
import { EditToolLink } from "@/components/tools/own-tool-actions";
import { ToolGrid } from "@/components/tools/tool-grid";
import { api } from "../../../../convex/_generated/api";
import {
  TOOL_CATEGORIES,
  type ToolCategory,
} from "../../../../convex/lib/validators";

const TOOLS_PAGE_SIZE = 24;

function parseCategory(value: string | null): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((category) => category === value);
}

function ToolBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = parseCategory(searchParams.get("category"));
  const tools = usePaginatedQuery(
    api.tools.list,
    { category },
    { initialNumItems: TOOLS_PAGE_SIZE }
  );

  const setCategory = (next: ToolCategory | undefined) => {
    router.replace(next ? `/tools?category=${next}` : "/tools", {
      scroll: false,
    });
  };

  return (
    <>
      <CategoryFilter onChange={setCategory} value={category} />
      <ToolGrid
        actions={(tool) =>
          tool.isMine ? (
            <EditToolLink toolId={tool._id} />
          ) : (
            <>
              <RequestDialog
                category={tool.category}
                toolId={tool._id}
                toolName={tool.name}
              />
              <ReportDialog toolId={tool._id} toolName={tool.name} />
            </>
          )
        }
        emptyAction={<ListToolButton />}
        emptyHint="Be the first to lend something in this category."
        emptyIcon={SearchX}
        emptyTitle="Nothing here yet"
        label="Neighborhood tools"
        tools={tools.status === "LoadingFirstPage" ? undefined : tools.results}
      />
      <LoadMoreButton
        className="mx-auto mt-8 flex"
        pageSize={TOOLS_PAGE_SIZE}
        query={tools}
      />
    </>
  );
}

export default function ToolsPage() {
  return (
    <>
      <PageHeader
        action={<ListToolButton />}
        description="Everything your neighbors are happy to lend. Pick a tool and ask for the days you need it."
        eyebrow="The neighborhood shelf"
        title="All tools"
      />
      <Suspense
        fallback={
          <ToolGrid
            emptyHint=""
            emptyTitle=""
            label="Neighborhood tools"
            tools={undefined}
          />
        }
      >
        <ToolBrowser />
      </Suspense>
    </>
  );
}
