import type { ReactNode } from "react";
import { ProfileGate } from "@/components/profile-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ProfileGate>{children}</ProfileGate>;
}
