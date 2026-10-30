import type { ReactNode } from "react";
import { ProfileGate } from "@/components/profile-gate";
import { SiteHeader } from "@/components/site-header";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ProfileGate>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </ProfileGate>
  );
}
