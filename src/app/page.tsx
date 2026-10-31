import { Show, SignInButton } from "@clerk/nextjs";
import {
  ArrowRight,
  CalendarRange,
  HandHeart,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { Eyebrow } from "@/components/eyebrow";
import { Logo } from "@/components/logo";
import { PublicToolList } from "@/components/public-tool-list";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/tool-labels";
import { TOOL_CATEGORIES } from "../../convex/lib/validators";

const STEPS = [
  {
    body: "Add the drill, ladder or tent that sits idle. Neighbors see the name, category and condition; never your contact details.",
    icon: HandHeart,
    title: "List what you own",
  },
  {
    body: "Pick the days you need something. The owner approves or declines, and you both get an email.",
    icon: CalendarRange,
    title: "Request the dates",
  },
  {
    body: "Borrow, use, bring it back. A friendly reminder goes out if a return is running late.",
    icon: PackageCheck,
    title: "Return and repeat",
  },
];

/**
 * Signing in from the landing page always lands on the board. Clerk would
 * otherwise return to "/" (the button passes the current page as redirect_url,
 * which beats the /tools fallback). Sign-ins started from a protected page keep
 * returning there, so this is forced here only, not app-wide.
 */
function SignInToBoard({ children }: { children: ReactNode }) {
  return (
    <SignInButton
      forceRedirectUrl="/tools"
      mode="redirect"
      signUpForceRedirectUrl="/tools"
    >
      {children}
    </SignInButton>
  );
}

function PrimaryCta() {
  return (
    <>
      <Show when="signed-out">
        <SignInToBoard>
          <Button className="h-12 px-6 text-base" size="lg">
            Sign in to lend or borrow
            <ArrowRight aria-hidden />
          </Button>
        </SignInToBoard>
      </Show>
      <Show when="signed-in">
        <Button asChild className="h-12 px-6 text-base" size="lg">
          <Link href="/tools">
            Go to the board
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </Show>
    </>
  );
}

/** A decorative stack of category tiles beside the hero copy. */
function HeroShelf() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm">
      <div className="bg-accent/60 absolute -inset-6 rotate-3 rounded-[2rem]" />
      <div className="bg-card relative grid grid-cols-2 gap-3 rounded-[1.75rem] border p-5 shadow-lg">
        {TOOL_CATEGORIES.slice(0, 6).map((category) => (
          <div
            className="bg-background flex items-center gap-2.5 rounded-xl border px-3 py-2.5"
            key={category}
          >
            <CategoryIcon category={category} size="sm" />
            <span className="text-sm font-medium">
              {CATEGORY_LABELS[category]}
            </span>
          </div>
        ))}
        <div className="bg-primary text-primary-foreground col-span-2 mt-1 flex items-center justify-between rounded-xl px-4 py-3">
          <span className="font-display text-lg">Shared, not stored.</span>
          <ShieldCheck className="size-5" />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Show when="signed-out">
          <SignInToBoard>
            <Button variant="ghost">Sign in</Button>
          </SignInToBoard>
        </Show>
      </header>

      <main className="flex-1">
        <section className="bg-paper">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
            <div className="space-y-7">
              <p className="bg-card inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
                <span className="bg-terracotta size-2 rounded-full" />
                Your neighborhood tool library
              </p>
              <h1 className="font-display text-5xl leading-[1.05] font-semibold sm:text-6xl">
                Borrow what you need.{" "}
                <em className="text-primary not-italic">
                  Lend what you don&apos;t.
                </em>
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
                LendLoop is a lending board for the people on your street. List
                the tools gathering dust, borrow the ones you need for a
                weekend, and keep good things in use.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <PrimaryCta />
                <a
                  className="text-muted-foreground hover:text-foreground text-sm font-medium underline-offset-4 hover:underline"
                  href="#available"
                >
                  See what&apos;s available
                </a>
              </div>
            </div>
            <HeroShelf />
          </div>
        </section>

        <section className="bg-card/50 border-y">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-3xl font-semibold">
              How it works
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map(({ body, icon: Icon, title }, i) => (
                <li className="bg-card rounded-2xl border p-6" key={title}>
                  <div className="flex items-center justify-between">
                    <span className="bg-secondary text-secondary-foreground inline-flex size-11 items-center justify-center rounded-xl">
                      <Icon aria-hidden className="size-5" />
                    </span>
                    <span className="text-muted-foreground/40 font-display text-4xl">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-display mt-5 text-xl font-semibold">
                    {title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:px-6"
          id="available"
        >
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <Eyebrow>On the shelf today</Eyebrow>
              <h2 className="font-display text-3xl font-semibold">
                Available right now
              </h2>
            </div>
            <p className="text-muted-foreground max-w-sm text-sm">
              Sign in to see who&apos;s lending, check dates and send a request.
            </p>
          </div>
          <PublicToolList />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
