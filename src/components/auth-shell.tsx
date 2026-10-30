import { Quote } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

/** Split layout for sign-in and sign-up: brand panel beside the Clerk form. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="bg-terracotta/30 absolute -top-24 -right-24 size-80 rounded-full blur-3xl" />
        <Logo className="[&_span:first-child]:bg-primary-foreground [&_span:first-child]:text-primary relative" />
        <figure className="relative max-w-md space-y-5">
          <Quote aria-hidden className="size-8 opacity-60" />
          <blockquote className="font-serif text-3xl leading-snug">
            Most tools spend their lives on a shelf. On our street, they get
            passed around.
          </blockquote>
          <figcaption className="text-primary-foreground/75 text-sm">
            Borrow what you need. Lend what you don&apos;t.
          </figcaption>
        </figure>
        <p className="text-primary-foreground/60 relative text-xs">
          Your contact details are never shown to other neighbors.
        </p>
      </aside>
      <main className="bg-paper flex flex-col items-center justify-center gap-8 p-6">
        <Logo className="lg:hidden" />
        {children}
      </main>
    </div>
  );
}
