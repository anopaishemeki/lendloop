"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ToolForm, type ToolFormValues } from "@/components/tools/tool-form";
import { errorMessage } from "@/lib/errors";
import { api } from "../../../../../convex/_generated/api";

export default function NewToolPage() {
  const router = useRouter();
  const create = useMutation(api.tools.create);

  const handleSubmit = async (values: ToolFormValues) => {
    try {
      await create(values);
      toast.success(`${values.name.trim()} is now listed`);
      router.push("/my/listings");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        description="Neighbors will see the name, category, condition and description."
        title="List a tool"
      />
      <ToolForm
        onCancel={() => router.back()}
        onSubmit={handleSubmit}
        submitLabel="List tool"
      />
    </>
  );
}
