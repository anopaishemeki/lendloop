import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

const fraunces = localFont({
  display: "swap",
  src: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
});

export const metadata: Metadata = {
  description:
    "A neighborhood tool-lending board. Borrow what you need. Lend what you don't.",
  title: { default: "LendLoop", template: "%s · LendLoop" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${fraunces.variable} font-sans`}
      >
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
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
