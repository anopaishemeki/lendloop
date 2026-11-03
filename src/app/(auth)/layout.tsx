import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

/** Sign-in and sign-up need Clerk, so they get the full app providers. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
