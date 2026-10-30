"use client";

import { useMutation, useQuery } from "convex/react";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ToolForm, type ToolFormValues } from "@/components/tools/tool-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

const BACK = "/my/listings";

export default function EditToolPage() {
  const router = useRouter();
  const { toolId } = useParams<{ toolId: Id<"tools"> }>();
  const tool = useQuery(api.tools.get, { toolId });
  const update = useMutation(api.tools.update);

  const handleSubmit = async (values: ToolFormValues) => {
    try {
      await update({ ...values, toolId });
      toast.success("Listing updated");
      router.push(BACK);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (tool === undefined) return <Skeleton className="h-80 max-w-xl" />;

  if (!tool.isMine) {
    return (
      <EmptyState icon={Lock} title="You can only edit your own listings">
        <Button asChild variant="outline">
          <Link href={BACK}>Back to my listings</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        description="Changes show up for neighbors right away."
        eyebrow="Your listing"
        title={`Edit ${tool.name}`}
      />
      <ToolForm
        availability={tool.availability}
        initial={{
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          name: tool.name,
        }}
        onCancel={() => router.push(BACK)}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
      />
    </>
  );
}
