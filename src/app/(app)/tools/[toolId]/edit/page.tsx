"use client";

import { useMutation, useQuery } from "convex/react";
import { Lock, type LucideIcon, SearchX } from "lucide-react";
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

const BACK = "/my/listings";

function CannotEdit({ icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <EmptyState icon={icon} title={title}>
      <Button asChild variant="outline">
        <Link href={BACK}>Back to my listings</Link>
      </Button>
    </EmptyState>
  );
}

export default function EditToolPage() {
  const router = useRouter();
  // The URL segment may not be a tool id at all; tools.get answers null then.
  const { toolId } = useParams<{ toolId: string }>();
  const tool = useQuery(api.tools.get, { toolId });
  const update = useMutation(api.tools.update);

  if (tool === undefined) return <Skeleton className="h-80 max-w-xl" />;
  // Removed, never existed, or not a tool id: one message for all three.
  if (tool === null)
    return <CannotEdit icon={SearchX} title="Listing not found" />;
  if (!tool.isMine) {
    return (
      <CannotEdit icon={Lock} title="You can only edit your own listings" />
    );
  }

  const handleSubmit = async (values: ToolFormValues) => {
    try {
      await update({ ...values, toolId: tool._id });
      toast.success("Listing updated");
      router.push(BACK);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

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
