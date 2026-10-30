import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { PublicToolList } from "@/components/public-tool-list";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-10 px-4 py-16 sm:px-6">
      <section className="flex flex-col gap-4">
        <p className="text-primary text-sm font-medium">LendLoop</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Borrow what you need. Lend what you don&apos;t.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          A tool-lending board for your neighborhood. List the drill you use
          twice a year, borrow the ladder you need this weekend.
        </p>
        <Show when="signed-out">
          <SignInButton mode="redirect">
            <Button className="w-fit" size="lg">
              Sign in to lend or borrow
            </Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Button asChild className="w-fit" size="lg">
            <Link href="/tools">Go to the board</Link>
          </Button>
        </Show>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Available right now</h2>
        <PublicToolList />
      </section>
    </main>
  );
}
