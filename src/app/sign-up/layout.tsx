import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
