import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProfileGate } from "@/components/profile-gate";

/** Every /admin page renders inside the portal's sidebar shell. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileGate>
      <AdminShell>{children}</AdminShell>
    </ProfileGate>
  );
}
