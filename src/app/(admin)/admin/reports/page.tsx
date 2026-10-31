import { Suspense } from "react";
import { AdminReports } from "@/components/admin/admin-reports";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminReportsPage() {
  return (
    <>
      <AdminPageHeader
        description="Listings neighbors have flagged. Remove the listing or dismiss the report."
        title="Reports"
      />
      {/* AdminReports reads ?status, which needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <AdminReports />
      </Suspense>
    </>
  );
}
