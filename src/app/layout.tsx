import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { ThemeProviders } from "@/components/providers";
import { SiteAnalytics } from "@/components/site-analytics";
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
      <body className={`${GeistSans.variable} ${fraunces.variable} font-sans`}>
        <ThemeProviders>{children}</ThemeProviders>
        <SiteAnalytics />
      </body>
    </html>
  );
}
