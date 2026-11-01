"use client";

import { usePaginatedQuery } from "convex/react";
import { Wrench } from "lucide-react";
import { LoadMoreButton } from "@/components/load-more";
import { PageHeader } from "@/components/page-header";
import { ListToolButton } from "@/components/tools/list-tool-button";
import { OwnToolActions } from "@/components/tools/own-tool-actions";
import { ToolGrid } from "@/components/tools/tool-grid";
import { api } from "../../../../../convex/_generated/api";

const PAGE_SIZE = 24;

export default function MyListingsPage() {
  const tools = usePaginatedQuery(
    api.tools.listMine,
    {},
    { initialNumItems: PAGE_SIZE }
  );

  return (
    <>
      <PageHeader
        action={<ListToolButton />}
        description="Tools you're lending to the neighborhood. Keep them up to date so neighbors know what to expect."
        eyebrow="Your shelf"
        title="My listings"
      />
      <ToolGrid
        actions={(tool) => <OwnToolActions tool={tool} />}
        emptyAction={<ListToolButton />}
        emptyHint="A ladder, a tent, a stand mixer: what do you have that sits idle?"
        emptyIcon={Wrench}
        emptyTitle="You haven't listed anything yet"
        label="Your tools"
        tools={tools.status === "LoadingFirstPage" ? undefined : tools.results}
      />
      <LoadMoreButton
        className="mx-auto mt-8 flex"
        pageSize={PAGE_SIZE}
        query={tools}
      />
    </>
  );
}
