import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminUsers } from "@/components/admin/admin-users";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminNeighborsPage() {
  return (
    <>
      <AdminPageHeader
        description="Mark reliable lenders as Trusted Lenders. The badge shows on their listings."
        title="Neighbors"
      />
      {/* Filters live in the URL, which needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <AdminUsers />
      </Suspense>
    </>
  );
}
