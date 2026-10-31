import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AdminUsers } from "@/components/admin/admin-users";

export default function AdminNeighborsPage() {
  return (
    <>
      <AdminPageHeader
        description="Mark reliable lenders as Trusted Lenders. The badge shows on their listings."
        title="Neighbors"
      />
      <AdminUsers />
    </>
  );
}
