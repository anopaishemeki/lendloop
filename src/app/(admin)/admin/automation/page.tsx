import { Suspense } from "react";
import { AdminAutomation } from "@/components/admin/admin-automation";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminAutomationPage() {
  return (
    <>
      <AdminPageHeader
        description="Emails sent through n8n, so a failed delivery is never silent."
        title="Automation"
      />
      {/* Filters live in the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <AdminAutomation />
      </Suspense>
    </>
  );
}
