import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminTools } from "@/components/admin/admin-tools";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminListingsPage() {
  return (
    <>
      <AdminPageHeader
        description="Remove any listing that breaks the rules. Open requests are declined and their borrowers notified."
        title="Listings"
      />
      {/* AdminTools reads ?condition, which needs a Suspense boundary. */}
      <Suspense fallback={<Skeleton className="h-48" />}>
        <AdminTools />
      </Suspense>
    </>
  );
}
