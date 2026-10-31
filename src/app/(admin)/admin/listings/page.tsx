import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminTools } from "@/components/admin/admin-tools";

export default function AdminListingsPage() {
  return (
    <>
      <AdminPageHeader
        description="Remove any listing that breaks the rules. Open requests are declined and their borrowers notified."
        title="Listings"
      />
      <AdminTools />
    </>
  );
}
