import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">LendLoop</h1>
      <p className="text-muted-foreground text-lg">
        Borrow what you need. Lend what you don&apos;t.
      </p>
      <SignInButton mode="redirect">
        <Button className="w-fit" size="lg">
          Sign in to lend or borrow
        </Button>
      </SignInButton>
    </main>
  );
}
