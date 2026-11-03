"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

// Next only inlines NEXT_PUBLIC_* when the full member expression is written out.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Clerk and the Convex client, for the signed-in app, the admin portal and the
 * sign-in pages. The landing page renders on the server without them, so its
 * visitors never download Clerk's script or open a Convex connection.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        // Clerk fades colorBorder itself, so it gets the opaque
        // --border-strong (--border is translucent in dark mode).
        variables: {
          borderRadius: "0.75rem",
          colorBackground: "var(--card)",
          colorBorder: "var(--border-strong)",
          colorDanger: "var(--destructive)",
          colorForeground: "var(--foreground)",
          colorInput: "var(--card)",
          colorInputForeground: "var(--foreground)",
          colorMuted: "var(--muted)",
          colorMutedForeground: "var(--muted-foreground)",
          colorNeutral: "var(--foreground)",
          colorPrimary: "var(--primary)",
          colorPrimaryForeground: "var(--primary-foreground)",
          colorRing: "var(--ring)",
          fontFamily: "var(--font-geist-sans)",
        },
      }}
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
        <Toaster richColors />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
