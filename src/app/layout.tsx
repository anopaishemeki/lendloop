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
            variables: {
              borderRadius: "0.75rem",
              colorPrimary: "var(--primary)",
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
