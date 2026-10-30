import "@fontsource-variable/fraunces";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  description:
    "A neighborhood tool-lending board. Borrow what you need. Lend what you don't.",
  title: { default: "LendLoop", template: "%s · LendLoop" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <ClerkProvider
          appearance={{
            variables: {
              borderRadius: "0.75rem",
              colorPrimary: "#2f6b4f",
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
