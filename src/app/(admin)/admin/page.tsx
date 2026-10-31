import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminPageHeader } from "@/components/admin/admin-shell";

export default function AdminOverviewPage() {
  return (
    <>
      <AdminPageHeader
        description="How the neighborhood library is doing, and what needs your attention."
        title="Overview"
      />
      <AdminOverview />
    </>
  );
}
