import { Suspense } from "react";
import { AdminLoans } from "@/components/admin/admin-loans";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoansPage() {
  return (
    <>
      <AdminPageHeader
        description="Every loan in the neighborhood, newest first."
        title="Loans"
      />
      {/* AdminLoans reads ?status, which needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <AdminLoans />
      </Suspense>
    </>
  );
}
