"use client";

import { useMutation, useQuery } from "convex/react";
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

export default function EditToolPage() {
  const router = useRouter();
  const { toolId } = useParams<{ toolId: Id<"tools"> }>();
  const mine = useQuery(api.tools.listMine);
  const update = useMutation(api.tools.update);
  const tool = mine?.find((item) => item._id === toolId);

  const handleSubmit = async (values: ToolFormValues) => {
    try {
      await update({ ...values, toolId });
      toast.success("Listing updated");
      router.push("/my/listings");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (mine === undefined) return <Skeleton className="h-80 max-w-xl" />;

  if (!tool) {
    return (
      <EmptyState title="You can only edit your own listings">
        <Button asChild variant="outline">
          <Link href="/my/listings">Back to my listings</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader title={`Edit ${tool.name}`} />
      <ToolForm
        initial={{
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          name: tool.name,
        }}
        onCancel={() => router.back()}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
      />
    </>
  );
}
