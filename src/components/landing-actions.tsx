"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/**
 * Signing in from the landing page always lands on the board: the sign-in page
 * honors redirect_url over its /tools fallback and passes it on to sign-up.
 */
const SIGN_IN_TO_BOARD = "/sign-in?redirect_url=%2Ftools";

// Clerk keeps `__client_uat` (last sign-in time, "0" when signed out) as a
// readable cookie on the app's domain. Reading it lets this static page skip
// Clerk's script; it only picks a link, and every protected page still checks.
const SIGNED_IN_COOKIE = /(?:^|;\s*)__client_uat=[1-9]/u;

const hasSession = () => SIGNED_IN_COOKIE.test(document.cookie);

const noSubscription = () => () => undefined;

/** Server render and first paint assume a signed-out visitor. */
function useHasSession() {
  return useSyncExternalStore(noSubscription, hasSession, () => false);
}

export function HeaderSignIn() {
  if (useHasSession()) return null;
  return (
    <Button asChild variant="ghost">
      <Link href={SIGN_IN_TO_BOARD}>Sign in</Link>
    </Button>
  );
}

export function PrimaryCta() {
  const signedIn = useHasSession();
  return (
    <Button asChild className="h-12 px-6 text-base" size="lg">
      <Link href={signedIn ? "/tools" : SIGN_IN_TO_BOARD}>
        {signedIn ? "Go to the board" : "Sign in to lend or borrow"}
        <ArrowRight aria-hidden />
      </Link>
    </Button>
  );
}
